
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserModel } from '../models/user.model';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!password) {
        res.status(400).json({ error: 'Password required' });
        return;
      }
      const result = await AuthService.login(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { username, password, setupToken } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password too short' });
        return;
      }
      const requiredToken = (process.env.NEXUS_SETUP_TOKEN || '').trim();
      if (requiredToken && setupToken !== requiredToken) {
        res.status(403).json({ error: 'Invalid setup token' });
        return;
      }
      const result = await AuthService.register(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getMe(req: Request, res: Response) {
    res.json({ user: req.user });
  }

  static async setup(req: Request, res: Response) {
    try {
      const { password, setupToken } = req.body || {};
      if (!password) {
        res.status(400).json({ error: 'Password required' });
        return;
      }
      const requiredToken = (process.env.NEXUS_SETUP_TOKEN || '').trim();
      const userCount = await UserModel.count();
      if (userCount > 0) {
        res.status(400).json({ error: 'Already configured' });
        return;
      }
      if (requiredToken && setupToken !== requiredToken) {
        res.status(403).json({ error: 'Invalid setup token' });
        return;
      }
      const result = await AuthService.register('admin', password, true);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async changePassword(req: Request, res: Response) {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password too short' });
      return;
    }
    try {
      await AuthService.changePassword(req.user.userId, currentPassword, newPassword);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async status(req: Request, res: Response) {
    const userCount = await UserModel.count();
    res.json({
      status: 'ok',
      needsSetup: userCount === 0,
      setupTokenRequired: Boolean((process.env.NEXUS_SETUP_TOKEN || '').trim())
    });
  }
}
