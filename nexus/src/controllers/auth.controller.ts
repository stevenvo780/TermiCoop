
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserModel } from '../models/user.model';
import { getUserPlan, getLimitsForPlan } from '../services/plan-limits';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!password) {
        res.status(400).json({ error: 'Contraseña requerida' });
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
        res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        return;
      }
      const requiredToken = (process.env.NEXUS_SETUP_TOKEN || '').trim();
      if (requiredToken && setupToken !== requiredToken) {
        res.status(403).json({ error: 'Token de configuración inválido' });
        return;
      }
      const result = await AuthService.register(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async getMe(req: Request, res: Response) {
    if (!req.user) { res.status(401).json({ error: 'No autorizado' }); return; }
    const plan = await getUserPlan(req.user.userId);
    const limits = getLimitsForPlan(plan);
    res.json({ user: { ...req.user, plan, limits } });
  }

  static async setup(req: Request, res: Response) {
    try {
      const { password, setupToken } = req.body || {};
      if (!password) {
        res.status(400).json({ error: 'Contraseña requerida' });
        return;
      }
      const requiredToken = (process.env.NEXUS_SETUP_TOKEN || '').trim();
      const userCount = await UserModel.count();
      if (userCount > 0) {
        res.status(400).json({ error: 'Ya está configurado' });
        return;
      }
      if (requiredToken && setupToken !== requiredToken) {
        res.status(403).json({ error: 'Token de configuración inválido' });
        return;
      }
      const result = await AuthService.register('admin', password, true);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async changePassword(req: Request, res: Response) {
    if (!req.user) { res.status(401).json({ error: 'No autorizado' }); return; }
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
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
