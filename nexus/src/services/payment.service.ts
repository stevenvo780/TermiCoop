
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PaymentModel } from '../models/payment.model';

import { setUserPlan, getUserPlan, getLimitsForPlan } from './plan-limits';

// Read env at runtime (after dotenv.config has run)
function getEnv() {
  return {
    MP_SANDBOX: (process.env.MP_SANDBOX || 'false').toLowerCase() === 'true',
    NEXUS_PUBLIC_URL: process.env.NEXUS_PUBLIC_URL || process.env.NEXUS_URL || 'http://localhost:3002',
  };
}

export interface PlanConfig {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Gratis',
    description: 'Para probar y uso personal básico',
    price: 0,
    currency: 'COP',
    features: [
      '1 worker',
      '1 sesión simultánea',
      'Comandos básicos',
      'Sin soporte',
    ],
  },
  {
    id: 'basico',
    name: 'Básico',
    description: 'Para empezar con lo esencial',
    price: 9900,
    currency: 'COP',
    features: [
      'Hasta 3 workers',
      'Hasta 3 sesiones simultáneas',
      'Historial de comandos',
      'Soporte por email',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'La mejor relación calidad-precio para equipos',
    price: 29900,
    currency: 'COP',
    features: [
      'Hasta 10 workers',
      'Sesiones ilimitadas',
      'Compartir workers',
      'Snippets y comandos guardados',
      'Soporte prioritario',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Todo ilimitado para organizaciones serias',
    price: 79900,
    currency: 'COP',
    features: [
      'Workers ilimitados',
      'Sesiones ilimitadas',
      'Compartir workers',
      'Snippets y comandos guardados',
      'Tags y agrupación de workers',
      'Soporte 24/7 dedicado',
      'API dedicada',
      'Auditoría avanzada',
    ],
  },
];

function getMpClient(): MercadoPagoConfig {
  const token = process.env.MP_ACCESS_TOKEN || '';
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN no configurado');
  }
  return new MercadoPagoConfig({ accessToken: token });
}

export class PaymentService {
  static getPlans(): PlanConfig[] {
    return PLANS;
  }

  static async createPreference(userId: number, planId: string, userEmail?: string) {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) {
      throw new Error(`Plan no encontrado: ${planId}`);
    }
    if (plan.price === 0) {
      throw new Error('El plan gratuito no requiere pago');
    }

    const client = getMpClient();
    const preferenceClient = new Preference(client);

    const { NEXUS_PUBLIC_URL, MP_SANDBOX } = getEnv();
    const backUrl = NEXUS_PUBLIC_URL;
    const isHttps = backUrl.startsWith('https://');

    const response = await preferenceClient.create({
      body: {
        items: [
          {
            id: plan.id,
            title: `Ultimate Terminal - Plan ${plan.name}`,
            description: plan.description,
            quantity: 1,
            unit_price: plan.price,
            currency_id: plan.currency,
          },
        ],
        payer: userEmail ? { email: userEmail } : undefined,
        ...(isHttps ? {
          back_urls: {
            success: `${backUrl}/api/payments/callback`,
            failure: `${backUrl}/api/payments/callback`,
            pending: `${backUrl}/api/payments/callback`,
          },
          auto_return: 'approved' as const,
        } : {}),
        notification_url: isHttps ? `${NEXUS_PUBLIC_URL}/api/payments/webhook` : undefined,
        external_reference: `user_${userId}_plan_${planId}_${Date.now()}`,
        statement_descriptor: 'Ultimate Terminal',
      },
    });

    if (!response.id) {
      throw new Error('No se pudo crear la preferencia de pago');
    }

    // Guardar en DB
    await PaymentModel.create(userId, response.id, planId, plan.price, plan.currency);

    return {
      preferenceId: response.id,
      initPoint: MP_SANDBOX ? response.sandbox_init_point : response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
      sandbox: MP_SANDBOX,
    };
  }

  static async handleWebhook(type: string, dataId: string) {
    if (type !== 'payment') {
      return { processed: false, reason: 'not a payment notification' };
    }

    const client = getMpClient();
    const paymentClient = new Payment(client);

    let mpPayment: any;
    try {
      mpPayment = await paymentClient.get({ id: Number(dataId) });
    } catch (err: any) {
      console.error(`[Payment] Error fetching payment ${dataId} from MP:`, err.message);
      return { processed: false, reason: 'payment not found in MP' };
    }

    if (!mpPayment || !mpPayment.id) {
      return { processed: false, reason: 'payment not found in MP' };
    }

    const status = mpPayment.status || 'unknown';
    const externalRef = mpPayment.external_reference || '';
    const preferenceId = (mpPayment as any).preference_id || '';

    // Buscar en DB por preference_id
    if (preferenceId) {
      const existing = await PaymentModel.findByPreferenceId(preferenceId);
      if (existing) {
        await PaymentModel.updateStatus(preferenceId, status, String(mpPayment.id));
        // Si aprobado, actualizar plan del usuario
        if (status === 'approved') {
          await setUserPlan(existing.user_id, existing.plan);
          console.log(`[Payment] Plan actualizado: user=${existing.user_id} plan=${existing.plan}`);
        }
        return { processed: true, status, externalRef };
      }
    }

    // Buscar por mp_payment_id
    const byMpId = await PaymentModel.findByMpPaymentId(String(mpPayment.id));
    if (byMpId) {
      await PaymentModel.updateStatusByMpPaymentId(String(mpPayment.id), status);
      if (status === 'approved') {
        await setUserPlan(byMpId.user_id, byMpId.plan);
        console.log(`[Payment] Plan actualizado: user=${byMpId.user_id} plan=${byMpId.plan}`);
      }
      return { processed: true, status, externalRef };
    }

    return { processed: false, reason: 'payment not matched to any local record' };
  }

  /**
   * Process the return URL callback from Mercado Pago.
   * In sandbox, the payment API may not return results, but the redirect
   * query params contain the payment status reliably.
   */
  static async handleCallback(params: {
    payment_id?: string;
    status?: string;
    external_reference?: string;
    preference_id?: string;
    collection_status?: string;
  }) {
    const status = params.status || params.collection_status || 'unknown';
    const preferenceId = params.preference_id || '';
    const paymentId = params.payment_id || '';
    const externalRef = params.external_reference || '';

    console.log(`[Payment] Callback: status=${status}, preferenceId=${preferenceId}, paymentId=${paymentId}, ref=${externalRef}`);

    if (!preferenceId && !externalRef) {
      return { processed: false, reason: 'no preference_id or external_reference' };
    }

    // Try to find by preference_id first
    if (preferenceId) {
      const existing = await PaymentModel.findByPreferenceId(preferenceId);
      if (existing) {
        await PaymentModel.updateStatus(preferenceId, status, paymentId);
        if (status === 'approved') {
          await setUserPlan(existing.user_id, existing.plan);
          console.log(`[Payment] Plan actualizado via callback: user=${existing.user_id} plan=${existing.plan}`);
        }
        return { processed: true, status, plan: existing.plan };
      }
    }

    // Try by external_reference: user_{id}_plan_{plan}_{timestamp}
    if (externalRef) {
      const match = externalRef.match(/^user_(\d+)_plan_(\w+)_/);
      if (match) {
        const userId = parseInt(match[1], 10);
        const plan = match[2];
        if (status === 'approved') {
          await setUserPlan(userId, plan);
          console.log(`[Payment] Plan actualizado via callback (ref): user=${userId} plan=${plan}`);
        }
        return { processed: true, status, plan };
      }
    }

    return { processed: false, reason: 'callback not matched' };
  }

  static async getPaymentStatus(userId: number) {
    const payments = await PaymentModel.findByUserId(userId);
    const currentPlan = await getUserPlan(userId);
    const limits = getLimitsForPlan(currentPlan);

    return {
      currentPlan,
      limits,
      payments: payments.map((p) => ({
        id: p.id,
        plan: p.plan,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
        createdAt: p.created_at,
      })),
    };
  }
}
