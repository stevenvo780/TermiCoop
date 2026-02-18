import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';

interface PaymentReturnProps {
  status: 'success' | 'failure' | 'pending';
  onBack: () => void;
}

const config = {
  success: {
    icon: CheckCircle2,
    color: '#10b981',
    title: '¡Pago exitoso!',
    message: 'Tu suscripción ha sido activada. Disfruta de todas las funciones de Ultimate Terminal.',
    bg: 'linear-gradient(135deg, #1e3a2f 0%, #1e2e1e 100%)',
    border: '#10b981',
  },
  failure: {
    icon: XCircle,
    color: '#ef4444',
    title: 'Pago rechazado',
    message: 'No se pudo procesar tu pago. Puedes intentar nuevamente o elegir otro medio de pago.',
    bg: 'linear-gradient(135deg, #3a1e1e 0%, #2e1e1e 100%)',
    border: '#ef4444',
  },
  pending: {
    icon: Clock,
    color: '#f59e0b',
    title: 'Pago pendiente',
    message: 'Tu pago está siendo procesado. Recibirás una notificación cuando se confirme.',
    bg: 'linear-gradient(135deg, #3a2e1e 0%, #2e2a1e 100%)',
    border: '#f59e0b',
  },
};

export function PaymentReturn({ status, onBack }: PaymentReturnProps) {
  const { icon: Icon, color, title, message, bg, border } = config[status];
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onBack]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#11111b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 16,
          padding: '2.5rem',
          maxWidth: 420,
          width: '90%',
          textAlign: 'center',
        }}
      >
        <Icon size={56} color={color} style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#cdd6f4', fontSize: 22, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ color: '#a6adc8', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>{message}</p>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            borderRadius: 8,
            border: `1px solid ${border}`,
            background: 'transparent',
            color: '#cdd6f4',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          Volver al terminal ({countdown}s)
        </button>
      </div>
    </div>
  );
}
