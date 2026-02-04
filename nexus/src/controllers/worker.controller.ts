
import { Request, Response } from 'express';
import { WorkerModel } from '../models/worker.model';
import { UserModel } from '../models/user.model';

export class WorkerController {
  static async list(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const workers = await WorkerModel.getAccessibleWorkers(req.user.userId);
    res.json(workers);
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
    const { workerId, targetUsername, permission } = req.body;

    if (!targetUsername) { res.status(400).json({ error: 'Username required' }); return; }

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    if (worker.owner_id !== req.user.userId && !req.user.isAdmin) {
      res.status(403).json({ error: 'Only owner can share' });
      return;
    }

    const targetUser = await UserModel.findByUsername(targetUsername);
    if (!targetUser) { res.status(404).json({ error: 'User not found' }); return; }

    if (targetUser.id === worker.owner_id) {
      res.status(400).json({ error: 'Cannot share with owner' });
      return;
    }

    await WorkerModel.share(workerId, targetUser.id, permission || 'view');

    // Notify target user
    const io = req.app.get('io');
    if (io) {
      // We need to find the socket ID for this user.
      // Since we don't track user->socket mappings globally in a simple way in the controller,
      // we can broadcast to all sockets and let them filter, OR (better) loop through sockets.
      // Based on socket.ts logic, we can iterate sockets.
      io.sockets.sockets.forEach((socket: any) => {
        if (socket.data?.role === 'client' && socket.data?.user?.userId === targetUser.id) {
          // Trigger a refresh of the worker list for this user
          socket.emit('worker-shared', { workerId, name: worker.name, owner: req.user?.username });
          // Also force update their list immediately
          // We can't easily call sendWorkerListToSocket here without importing it or duplicating logic.
          // But the client can listen to 'worker-shared' and request the list or we can just send 'workers' event if we fetch it.
          // Let's just emit 'worker-shared' and let client handle refresh, OR fetch and emit.
          WorkerModel.getAccessibleWorkers(targetUser.id).then((list) => {
            socket.emit('workers', list);
          });
        }
      });
    }

    res.json({ success: true, user: { id: targetUser.id, username: targetUser.username, permission: permission || 'view' } });
  }

  static async getShares(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const workerId = req.params.id as string;

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    if (worker.owner_id !== req.user.userId && !req.user.isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const shares = await WorkerModel.getShares(workerId);
    res.json(shares);
  }

  static async unshare(req: Request, res: Response) {
    if (!req.user) { res.status(401).send(); return; }
    const { workerId, targetUserId } = req.body;

    const worker = await WorkerModel.findById(workerId);
    if (!worker) { res.status(404).json({ error: 'Worker not found' }); return; }

    if (worker.owner_id !== req.user.userId && !req.user.isAdmin) {
      res.status(403).json({ error: 'Only owner can unshare' });
      return;
    }

    await WorkerModel.unshare(workerId, targetUserId);
    res.json({ success: true });
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
