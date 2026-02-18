
import { Request, Response } from 'express';
import { WorkerModel } from '../models/worker.model';
import { UserModel } from '../models/user.model';
import { workers as connectedWorkers } from '../socket';
import { canCreateWorker, canShareWorker } from '../services/plan-limits';
import type { Server } from 'socket.io';

export class WorkerController {
  static async list(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const workers = await WorkerModel.getAccessibleWorkers(req.user.userId);
    res.json(workers);
  }

  static async join(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const { code, workerId } = req.body;
    const joinCode = String(code || workerId || '').trim();

    if (!joinCode) {
      res.status(400).json({ error: 'Código requerido' });
      return;
    }

    const worker = await WorkerModel.findById(joinCode);
    if (!worker) { res.status(404).json({ error: 'Código inválido' }); return; }

    if (worker.owner_id !== req.user.userId) {
      await WorkerModel.share(worker.id, req.user.userId, 'control');
    }

    res.json({ success: true });
  }
  static async create(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'Nombre requerido' }); return; }

    // Verificar límite de workers por plan
    const check = await canCreateWorker(req.user.userId);
    if (!check.allowed) {
      res.status(403).json({
        error: check.reason,
        code: 'PLAN_LIMIT_WORKERS',
        current: check.current,
        max: check.max,
      });
      return;
    }

    const worker = await WorkerModel.create(req.user.userId, name);
    res.json(worker);
  }

  static async share(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const { workerId, targetUsername } = req.body;

    if (!targetUsername) { res.status(400).json({ error: 'Nombre de usuario requerido' }); return; }

    // Verificar que el plan permite compartir
    const shareCheck = await canShareWorker(req.user.userId);
    if (!shareCheck.allowed) {
      res.status(403).json({
        error: shareCheck.reason,
        code: 'PLAN_LIMIT_SHARE',
      });
      return;
    }

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker no encontrado' }); return; }

    const canManage = worker.owner_id === req.user.userId || req.user.isAdmin;

    if (!canManage) {
      res.status(403).json({ error: 'Solo el propietario o admin puede compartir' });
      return;
    }

    const targetUser = await UserModel.findByUsername(targetUsername);
    if (!targetUser) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

    if (targetUser.id === worker.owner_id) {
      res.status(400).json({ error: 'No puedes compartir con el propietario' });
      return;
    }

    const enforcedPermission = 'control' as const;
    await WorkerModel.share(workerId, targetUser.id, enforcedPermission);

    // Notify target user via Socket.IO
    const io = req.app.get('io');
    if (io) {
      console.log(`[Share] Broadcasting share of ${workerId} to user ${targetUser.id} (${targetUser.username})`);
      io.sockets.sockets.forEach((socket: any) => {
        const socketUser = socket.data?.user;
        if (socket.data?.role === 'client' && socketUser?.userId === targetUser.id) {
          socket.emit('worker-shared', { workerId, name: worker.name, owner: req.user?.username });

          // Refresh worker list for the user
          WorkerModel.getAccessibleWorkers(targetUser.id).then((list) => {
            socket.emit('workers', list);
          });
        }
      });
    }

    const shares = await WorkerModel.getShares(workerId);
    res.json({
      success: true,
      user: { id: targetUser.id, username: targetUser.username, permission: enforcedPermission },
      shares
    });
  }

  static async getShares(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const workerId = req.params.id as string;

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker no encontrado' }); return; }

    const canManage = worker.owner_id === req.user.userId || req.user.isAdmin;

    if (!canManage) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const shares = await WorkerModel.getShares(workerId);
    res.json(shares);
  }

  static async unshare(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const { workerId, targetUserId } = req.body;
    const normalizedUserId = Number(targetUserId);

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker no encontrado' }); return; }

    const canManage = worker.owner_id === req.user.userId || req.user.isAdmin;

    if (!canManage) {
      res.status(403).json({ error: 'Solo el propietario o admin puede quitar acceso' });
      return;
    }

    if (!Number.isFinite(normalizedUserId)) {
      res.status(400).json({ error: 'ID de usuario inválido' });
      return;
    }

    const changes = await WorkerModel.unshare(workerId, normalizedUserId);
    if (changes === 0) {
      res.status(404).json({ error: 'Compartición no encontrada' });
      return;
    }
    const shares = await WorkerModel.getShares(workerId);
    res.json({ success: true, shares });
  }

  static async delete(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const id = req.params.id as string;

    const worker = await WorkerModel.findById(id);
    if (!worker) { res.status(404).json({ error: 'Worker no encontrado' }); return; }

    if (worker.owner_id !== req.user.userId && !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const io = req.app.get('io') as Server | undefined;
    const connected = connectedWorkers.get(worker.id);
    if (connected && io) {
      const workerSocket = io.sockets.sockets.get(connected.socketId);
      if (workerSocket) {
        workerSocket.disconnect(true);
      }
      connectedWorkers.delete(worker.id);
    }

    await WorkerModel.delete(id);
    res.json({ success: true, disconnected: Boolean(connected) });
  }
}
