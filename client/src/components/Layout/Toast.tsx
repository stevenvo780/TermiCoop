import { useEffect, useState } from 'react';
import { X, Info } from 'lucide-react';
import './Toast.css';

interface ToastProps {
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ title, message, onClose, duration = 5000 }: ToastProps) {
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHiding(true);
      setTimeout(onClose, 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setHiding(true);
    setTimeout(onClose, 300);
  };

  return (
    <div className="toast-container">
      <div className={`toast ${hiding ? 'hiding' : ''}`}>
        <div className="toast-icon">
          <Info size={24} />
        </div>
        <div className="toast-content">
          <div className="toast-title">{title}</div>
          <div className="toast-message">{message}</div>
        </div>
        <button className="toast-close" onClick={handleClose}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
