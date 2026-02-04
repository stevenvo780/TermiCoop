import { useState, useEffect } from 'react';
import { X, Users, Trash2 } from 'lucide-react';
import './ShareModal.css';

interface ShareModalProps {
  worker: { id: string; name: string };
  onClose: () => void;
  nexusUrl: string;
  token: string | null;
}

interface Share {
  userId: number;
  username: string;
  permission: string;
}

const normalizeShares = (data: Array<Partial<Share> & Record<string, unknown>>): Share[] => {
  return data
    .map((item) => {
      const rawId = item.userId ?? item.userid ?? item.user_id;
      const userId = Number(rawId);
      return {
        userId,
        username: String(item.username || ''),
        permission: String(item.permission || 'view'),
      };
    })
    .filter((item) => Number.isFinite(item.userId) && item.username.length > 0);
};

export function ShareModal({ worker, onClose, nexusUrl, token }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [unsharingId, setUnsharingId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchShares = async () => {
    if (!token) return;
    try {
      setError(null);
      setLoading(true);
      const res = await fetch(`${nexusUrl}/api/workers/${worker.id}/shares`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Failed to fetch shares');
      const data = await res.json();
      setShares(normalizeShares(data));
    } catch {
      setError('Could not load shares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id]);

  const handleShare = async () => {
    if (!newUsername || !token) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`${nexusUrl}/api/workers/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workerId: worker.id,
          targetUsername: newUsername,
          permission: 'control'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share');

      setNewUsername('');
      if (Array.isArray(data.shares)) {
        setShares(normalizeShares(data.shares));
      } else {
        fetchShares();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setAdding(false);
    }
  };

  const handleCopyCode = () => {
    if (!worker.id) return;
    navigator.clipboard.writeText(worker.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleUnshare = async (userId: number) => {
    if (!token) return;
    setUnsharingId(userId);
    setError(null);
    try {
      const res = await fetch(`${nexusUrl}/api/workers/unshare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          workerId: worker.id,
          targetUserId: userId
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo quitar el acceso');
      }
      if (Array.isArray(data.shares)) {
        setShares(normalizeShares(data.shares));
      } else {
        setShares((current) => current.filter((share) => share.userId !== userId));
        fetchShares();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el acceso');
    } finally {
      setUnsharingId(null);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-header">
          <h3>
            <Users size={20} className="text-blue-400" />
            Compartir worker: <span className="text-blue-200">{worker.name}</span>
          </h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="share-body">
          <div className="add-user-section">
            <div className="section-label">Agregar usuario</div>
            <div className="add-input-group">
              <input
                className="share-input"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Usuario"
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              />
              <button
                onClick={handleShare}
                disabled={adding || !newUsername}
                className="add-btn"
              >
                {adding ? '...' : 'Agregar'}
              </button>
            </div>
            {error && <div className="error-text">{error}</div>}
          </div>

          <div className="share-code-section">
            <div className="section-label">Código para unirse</div>
            <div className="share-code-box">
              <code className="share-code">{worker.id}</code>
              <button className="copy-code-btn" onClick={handleCopyCode}>
                {copiedCode ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="share-code-hint">
              Comparte este código si la otra persona se une por código.
            </div>
          </div>

          <div className="shared-list-section">
            <div className="section-label">Compartido con ({shares.length})</div>
            <div className="shared-list">
              {loading ? (
                <div className="empty-list">Cargando lista de acceso...</div>
              ) : shares.length === 0 ? (
                <div className="empty-list">
                  Aún no está compartido.<br />
                  Agrega un usuario para dar acceso.
                </div>
              ) : (
                shares.map(share => (
                  <div key={share.userId} className="share-item">
                    <div className="user-info">
                      <div className="user-avatar">
                        {share.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-details">
                        <span className="username">{share.username}</span>
                      </div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => handleUnshare(share.userId)}
                      disabled={unsharingId === share.userId}
                      title="Quitar acceso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="share-footer">
          <button className="close-modal-btn" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
