import { useState, useEffect } from 'react';
import { CreditCard, Check, Loader2, X, Crown, Zap, Gift, Sparkles } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
}

interface PaymentHistory {
  id: number;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
}

interface SubscriptionModalProps {
  onClose: () => void;
  nexusUrl: string;
  token: string;
}

const planIcons: Record<string, typeof Crown> = {
  free: Gift,
  basico: Zap,
  pro: Crown,
  enterprise: Sparkles,
};

const planColors: Record<string, string> = {
  free: '#6c7086',
  basico: '#3b82f6',
  pro: '#f59e0b',
  enterprise: '#a855f7',
};

const planBadges: Record<string, string> = {
  free: '',
  basico: '',
  pro: '⭐ Recomendado',
  enterprise: '💎 Premium',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  approved: { label: 'Aprobado', color: '#10b981' },
  pending: { label: 'Pendiente', color: '#f59e0b' },
  rejected: { label: 'Rechazado', color: '#ef4444' },
  in_process: { label: 'En proceso', color: '#3b82f6' },
  cancelled: { label: 'Cancelado', color: '#6b7280' },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function SubscriptionModal({ onClose, nexusUrl, token }: SubscriptionModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, statusRes] = await Promise.all([
        fetch(`${nexusUrl}/api/payments/plans`),
        fetch(`${nexusUrl}/api/payments/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setActivePlan(statusData.currentPlan || 'free');
        setPayments(statusData.payments || []);
      }
    } catch (err) {
      console.error('Error loading subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    try {
      setPurchasing(planId);
      setError(null);

      const res = await fetch(`${nexusUrl}/api/payments/create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el pago');
      }

      // Redirigir a Mercado Pago
      const redirectUrl = data.initPoint || data.sandboxInitPoint;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error('No se obtuvo URL de pago');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear el pago';
      setError(message);
      setPurchasing(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1e1e2e',
          borderRadius: 16,
          border: '1px solid #313244',
          maxWidth: 1050,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={22} color="#cba6f7" />
            <h2 style={{ margin: 0, fontSize: 18, color: '#cdd6f4' }}>Planes y Suscripción</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#6c7086',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 size={32} color="#cba6f7" className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Active subscription banner */}
            {activePlan && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a2f 0%, #1e2e1e 100%)',
                  border: '1px solid #10b981',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Check size={18} color="#10b981" />
                <span style={{ color: '#a6e3a1', fontSize: 14 }}>
                  Plan activo: <strong>{activePlan.charAt(0).toUpperCase() + activePlan.slice(1)}</strong>
                </span>
              </div>
            )}

            {/* Plans grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.5rem',
              }}
            >
              {plans.map((plan) => {
                const Icon = planIcons[plan.id] || Zap;
                const color = planColors[plan.id] || '#cba6f7';
                const isActive = activePlan === plan.id;
                const isPurchasing = purchasing === plan.id;

                return (
                  <div
                    key={plan.id}
                    style={{
                      position: 'relative' as const,
                      background: isActive ? '#1e2d3d' : '#181825',
                      border: `1px solid ${isActive ? color : '#313244'}`,
                      borderRadius: 12,
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {planBadges[plan.id] && (
                      <div style={{
                        position: 'absolute' as const,
                        top: -10,
                        right: 12,
                        background: color,
                        color: '#1e1e2e',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: 12,
                      }}>
                        {planBadges[plan.id]}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Icon size={20} color={color} />
                      <h3 style={{ margin: 0, fontSize: 16, color: '#cdd6f4' }}>{plan.name}</h3>
                    </div>

                    <p style={{ color: '#a6adc8', fontSize: 13, margin: '0 0 12px', lineHeight: 1.4 }}>
                      {plan.description}
                    </p>

                    <div style={{ fontSize: 24, fontWeight: 700, color: '#cdd6f4', marginBottom: 12 }}>
                      {plan.price === 0 ? 'Gratis' : formatCurrency(plan.price, plan.currency)}
                      {plan.price > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: '#6c7086' }}> /mes</span>}
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', flex: 1 }}>
                      {plan.features.map((f, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#bac2de', fontSize: 13 }}>
                          <Check size={14} color={color} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      disabled={isActive || isPurchasing || plan.id === 'free'}
                      onClick={() => plan.id !== 'free' && handlePurchase(plan.id)}
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: isActive ? '#313244' : plan.id === 'free' ? '#45475a' : color,
                        color: isActive ? '#6c7086' : plan.id === 'free' ? '#a6adc8' : '#1e1e2e',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: isActive || plan.id === 'free' ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: isPurchasing ? 0.7 : 1,
                      }}
                    >
                      {isActive ? (
                        <>
                          <Check size={16} /> Plan activo
                        </>
                      ) : isPurchasing ? (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...
                        </>
                      ) : plan.id === 'free' ? (
                        <>
                          <Check size={16} /> Incluido
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} /> Suscribirse
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  background: '#302020',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '0.5rem 0.75rem',
                  marginBottom: '1rem',
                  color: '#fca5a5',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* Payment history */}
            {payments.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, color: '#a6adc8', marginBottom: 8 }}>Historial de pagos</h3>
                <div
                  style={{
                    background: '#181825',
                    borderRadius: 8,
                    border: '1px solid #313244',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #313244' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6c7086', fontWeight: 500 }}>Plan</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6c7086', fontWeight: 500 }}>Monto</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6c7086', fontWeight: 500 }}>Estado</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6c7086', fontWeight: 500 }}>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.slice(0, 10).map((p) => {
                        const st = statusLabels[p.status] || { label: p.status, color: '#6c7086' };
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #313244' }}>
                            <td style={{ padding: '8px 12px', color: '#cdd6f4' }}>
                              {p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#cdd6f4' }}>
                              {formatCurrency(p.amount, p.currency)}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  background: `${st.color}22`,
                                  color: st.color,
                                }}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#6c7086' }}>
                              {new Date(p.createdAt).toLocaleDateString('es-CO')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
