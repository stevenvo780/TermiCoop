
import crypto from 'crypto';
import db from '../config/database';
import { generateApiKey } from '../utils/crypto';

export interface Worker {
  id: string;
  owner_id: number;
  name: string;
  api_key: string;
  status: 'online' | 'offline';
  last_seen: number;
}

export interface WorkerShare {
  worker_id: string;
  user_id: number;
  permission: 'view' | 'control' | 'admin';
}

export class WorkerModel {
  static async create(ownerId: number, name: string, id?: string, fixedApiKey?: string): Promise<Worker> {
    const workerId = id || crypto.randomUUID();
    const apiKey = fixedApiKey || generateApiKey();
    const now = Date.now();

    await db.run(`
      INSERT INTO workers (id, owner_id, name, api_key, status, last_seen)
      VALUES (?, ?, ?, ?, 'offline', ?)
    `, [workerId, ownerId, name, apiKey, now]);

    return {
      id: workerId,
      owner_id: ownerId,
      name,
      api_key: apiKey,
      status: 'offline',
      last_seen: now
    };
  }

  static async findByApiKey(apiKey: string): Promise<Worker | undefined> {
    const worker = await db.get<Worker>('SELECT * FROM workers WHERE api_key = ?', [apiKey]);
    if (worker) {
      worker.last_seen = Number(worker.last_seen);
    }
    return worker;
  }

  static async findById(id: string): Promise<Worker | undefined> {
    const worker = await db.get<Worker>('SELECT * FROM workers WHERE id = ?', [id]);
    if (worker) {
      worker.last_seen = Number(worker.last_seen);
    }
    return worker;
  }

  static async getAccessibleWorkers(userId: number): Promise<(Worker & { permission: string })[]> {
    const result = await db.query<Worker & { permission: string }>(`
      SELECT w.*, 'admin' as permission 
      FROM workers w 
      WHERE w.owner_id = ?
      
      UNION
      
      SELECT w.*, ws.permission
      FROM workers w
      JOIN worker_shares ws ON w.id = ws.worker_id
      WHERE ws.user_id = ?
    `, [userId, userId]);

    return result.rows.map(w => ({
      ...w,
      last_seen: Number(w.last_seen)
    }));
  }

  static async share(workerId: string, userId: number, permission: 'view' | 'control' | 'admin'): Promise<void> {
    await db.run(`
      INSERT INTO worker_shares (worker_id, user_id, permission)
      VALUES (?, ?, ?)
      ON CONFLICT(worker_id, user_id) DO UPDATE SET permission = excluded.permission
    `, [workerId, userId, permission]);
  }

  static async unshare(workerId: string, userId: number): Promise<number> {
    const result = await db.run('DELETE FROM worker_shares WHERE worker_id = ? AND user_id = ?', [workerId, userId]);
    return result.changes || 0;
  }

  static async updateStatus(id: string, status: 'online' | 'offline'): Promise<void> {
    await db.run('UPDATE workers SET status = ?, last_seen = ? WHERE id = ?', [status, Date.now(), id]);
  }

  static async updateName(id: string, name: string): Promise<void> {
    await db.run('UPDATE workers SET name = ? WHERE id = ?', [name, id]);
  }

  static async delete(id: string): Promise<void> {
    await db.run('DELETE FROM worker_shares WHERE worker_id = ?', [id]);
    await db.run('DELETE FROM workers WHERE id = ?', [id]);
  }

  static async hasAccess(userId: number, workerId: string, requiredPermission: 'view' | 'control' | 'admin' = 'view'): Promise<boolean> {
    const worker = await this.findById(workerId);
    if (!worker) return false;
    if (worker.owner_id === userId) return true;

    const share = await db.get<{ permission: string }>('SELECT permission FROM worker_shares WHERE worker_id = ? AND user_id = ?', [workerId, userId]);
    if (!share) return false;

    // Single share mode: treat view/control as the same permission level.
    const levels = { 'view': 2, 'control': 2, 'admin': 3 };
    return levels[share.permission as keyof typeof levels] >= levels[requiredPermission];
  }

  static async getShares(workerId: string): Promise<{ userId: number; username: string; permission: string }[]> {
    const result = await db.query<{ userId: number; username: string; permission: string }>(`
      SELECT ws.user_id as "userId", u.username, ws.permission
      FROM worker_shares ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.worker_id = ?
    `, [workerId]);
    return result.rows;
  }
}
