
import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';

export class PaymentController {
  static getPlans(_req: Request, res: Response) {
    const plans = PaymentService.getPlans();
    res.json({ plans });
  }

  static async createPreference(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const { planId } = req.body;
      if (!planId) {
        res.status(400).json({ error: 'planId es requerido' });
        return;
      }
      const result = await PaymentService.createPreference(
        req.user.userId,
        planId,
        req.user.username
      );
      res.json(result);
    } catch (err: any) {
      console.error('[Payment] Error creating preference:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  static async webhook(req: Request, res: Response) {
    try {
      const { type, data } = req.body;
      // MP v2 webhook format
      const dataId = data?.id ? String(data.id) : req.query['data.id'] as string;
      const notifType = type || req.query.type as string;

      if (!dataId) {
        res.status(200).json({ ok: true, message: 'no data.id' });
        return;
      }

      console.log(`[Payment] Webhook received: type=${notifType}, dataId=${dataId}`);

      const result = await PaymentService.handleWebhook(notifType, dataId);
      console.log('[Payment] Webhook result:', result);

      res.status(200).json({ ok: true, ...result });
    } catch (err: any) {
      console.error('[Payment] Webhook error:', err.message);
      // Always return 200 to MP so they don't retry endlessly
      res.status(200).json({ ok: false, error: err.message });
    }
  }

  static async callback(req: Request, res: Response) {
    try {
      const params = {
        payment_id: req.query.payment_id as string || req.query.collection_id as string,
        status: req.query.status as string,
        collection_status: req.query.collection_status as string,
        external_reference: req.query.external_reference as string,
        preference_id: req.query.preference_id as string,
      };

      console.log('[Payment] Callback received:', params);

      const result = await PaymentService.handleCallback(params);
      console.log('[Payment] Callback result:', result);

      // Redirect to the client app payment result page
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const status = params.status || params.collection_status || 'unknown';
      let path = '/payment/pending';
      if (status === 'approved') path = '/payment/success';
      else if (status === 'rejected' || status === 'cancelled') path = '/payment/failure';

      res.redirect(`${clientUrl}${path}?status=${status}&plan=${result.plan || ''}`);
    } catch (err: any) {
      console.error('[Payment] Callback error:', err.message);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/payment/failure?error=${encodeURIComponent(err.message)}`);
    }
  }

  static async getStatus(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const result = await PaymentService.getPaymentStatus(req.user.userId);
      res.json(result);
    } catch (err: any) {
      console.error('[Payment] Status error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Billing cron endpoint — processes expired subscriptions.
   * Protected by BILLING_CRON_SECRET header.
   * Can be called by external schedulers (GCP Cloud Scheduler, Vercel Cron, crontab curl).
   */
  static async billingCron(req: Request, res: Response) {
    try {
      const secret = process.env.BILLING_CRON_SECRET || 'billing-cron-secret-default';
      const provided = req.headers['x-cron-secret'] || req.query.secret;

      if (provided !== secret) {
        res.status(403).json({ error: 'Forbidden: invalid cron secret' });
        return;
      }

      console.log('[Billing] Cron triggered at', new Date().toISOString());
      const result = await PaymentService.processExpiredSubscriptions();

      // Also get upcoming expirations for logging
      const expiring = await PaymentService.getExpiringSubscriptions(5);

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        ...result,
        expiringSoon: expiring,
      });
    } catch (err: any) {
      console.error('[Billing] Cron error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
}
