
import { Request, Response } from 'express';
import { WorkerModel } from '../models/worker.model';
import { UserModel } from '../models/user.model';
import { workers as connectedWorkers } from '../socket';
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
    if (!name) { res.status(400).json({ error: 'Name required' }); return; }

    const worker = await WorkerModel.create(req.user.userId, name);
    res.json(worker);
  }

  static async share(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const { workerId, targetUsername } = req.body;

    if (!targetUsername) { res.status(400).json({ error: 'Username required' }); return; }

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    const canManage = worker.owner_id === req.user.userId || req.user.isAdmin;

    if (!canManage) {
      res.status(403).json({ error: 'Only owner or admin can share' });
      return;
    }

    const targetUser = await UserModel.findByUsername(targetUsername);
    if (!targetUser) { res.status(404).json({ error: 'User not found' }); return; }

    if (targetUser.id === worker.owner_id) {
      res.status(400).json({ error: 'Cannot share with owner' });
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
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    const canManage = worker.owner_id === req.user.userId || req.user.isAdmin;

    if (!canManage) {
      res.status(403).json({ error: 'Forbidden' });
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
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    const canManage = worker.owner_id === req.user.userId || req.user.isAdmin;

    if (!canManage) {
      res.status(403).json({ error: 'Only owner or admin can unshare' });
      return;
    }

    if (!Number.isFinite(normalizedUserId)) {
      res.status(400).json({ error: 'Invalid targetUserId' });
      return;
    }

    const changes = await WorkerModel.unshare(workerId, normalizedUserId);
    if (changes === 0) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }
    const shares = await WorkerModel.getShares(workerId);
    res.json({ success: true, shares });
  }

  static async delete(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const id = req.params.id as string;

    const worker = await WorkerModel.findById(id);
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    if (worker.owner_id !== req.user.userId && !req.user.isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
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
