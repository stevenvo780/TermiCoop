import { useState } from 'react';

interface JoinWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  nexusUrl: string;
  token: string | null;
  onJoined: () => void;
}

export function JoinWorkerModal({ isOpen, onClose, nexusUrl, token, onJoined }: JoinWorkerModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${nexusUrl}/api/workers/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: trimmed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo unir al worker');
      }
      setCode('');
      onJoined();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo unir al worker');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Unirse por código</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="join-code">Código del worker</label>
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Pega el código aquí"
              autoComplete="off"
            />
          </div>
          <div className="muted">
            El código lo genera quien comparte el worker.
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="dialog-actions">
            <button className="dialog-btn ghost" onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="dialog-btn"
              onClick={handleJoin}
              disabled={loading || !code.trim()}
              type="button"
            >
              {loading ? 'Uniendo...' : 'Unirme'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
