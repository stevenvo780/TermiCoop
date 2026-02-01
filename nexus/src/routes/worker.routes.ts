import { Router } from 'express';
import { WorkerController } from '../controllers/worker.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', WorkerController.list);
router.post('/', WorkerController.create);
router.post('/share', WorkerController.share);
router.post('/unshare', WorkerController.unshare);
router.get('/:id/shares', WorkerController.getShares);
router.delete('/:id', WorkerController.delete);

export default router;
