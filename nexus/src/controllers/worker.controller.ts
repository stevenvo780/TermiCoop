
import { Request, Response } from 'express';
import { WorkerModel } from '../models/worker.model';
import { UserModel } from '../models/user.model';

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

    // Notify target user
    const io = req.app.get('io');
    if (io) {
      // We need to find the socket ID for this user.
      // Since we don't track user->socket mappings globally in a simple way in the controller,
      // we can broadcast to all sockets and let them filter, OR (better) loop through sockets.
      // Based on socket.ts logic, we can iterate sockets.
      console.log(`[Share] Broadcasting share of ${workerId} to user ${targetUser.id} (${targetUser.username})`);
      io.sockets.sockets.forEach((socket: any) => {
        const socketUser = socket.data?.user;
        if (socket.data?.role === 'client' && socketUser?.userId === targetUser.id) {
          console.log(`[Share] Found socket for user ${targetUser.id}: ${socket.id}`);
          // Trigger a refresh of the worker list for this user
          socket.emit('worker-shared', { workerId, name: worker.name, owner: req.user?.username });
          // Also force update their list immediately
          // We can't easily call sendWorkerListToSocket here without importing it or duplicating logic.
          // But the client can listen to 'worker-shared' and request the list or we can just send 'workers' event if we fetch it.
          // Let's just emit 'worker-shared' and let client handle refresh, OR fetch and emit.
          WorkerModel.getAccessibleWorkers(targetUser.id).then((list) => {
            console.log(`[Share] Emitting updated worker list to ${socket.id} (count: ${list.length})`);
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

    if (worker.status === 'online') {
      res.status(409).json({ error: 'Cannot delete an online worker' });
      return;
    }

    await WorkerModel.delete(id);
    res.json({ success: true });
  }
}
