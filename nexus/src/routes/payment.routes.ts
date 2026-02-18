
import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Planes disponibles (público)
router.get('/plans', PaymentController.getPlans);

// Crear preferencia de pago (requiere auth)
router.post('/create-preference', authMiddleware, PaymentController.createPreference);

// Webhook de Mercado Pago (público - llamado por MP)
router.post('/webhook', PaymentController.webhook);

// Callback de retorno de MP (público - redirige al usuario desde MP checkout)
router.get('/callback', PaymentController.callback);

// Estado de suscripción del usuario (requiere auth)
router.get('/status', authMiddleware, PaymentController.getStatus);

// Billing cron — procesa suscripciones expiradas (protegido por secret)
router.post('/billing-cron', PaymentController.billingCron);

export default router;
