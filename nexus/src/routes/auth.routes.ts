import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.get('/me', authMiddleware, AuthController.getMe);
router.post('/setup', AuthController.setup);
router.post('/password', authMiddleware, AuthController.changePassword);
router.get('/status', AuthController.status);

export default router;
