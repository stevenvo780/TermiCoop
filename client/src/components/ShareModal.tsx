import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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

export function ShareModal({ worker, onClose, nexusUrl, token }: ShareModalProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPermission, setNewPermission] = useState('view');
  const [adding, setAdding] = useState(false);

  const fetchShares = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${nexusUrl}/api/workers/${worker.id}/shares`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch shares');
      const data = await res.json();
      setShares(data);
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
          permission: newPermission
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share');

      setNewUsername('');
      fetchShares();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setAdding(false);
    }
  };

  const handleUnshare = async (userId: number) => {
    if (!token) return;
    if (!confirm('Are you sure you want to remove this user?')) return;

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

      if (!res.ok) throw new Error('Failed to unshare');
      fetchShares();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unshare');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>Share Worker: {worker.name}</h3>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>

        <div className="modal-body">
          <div className="share-form" style={{ marginBottom: '20px', padding: '15px', background: '#333', borderRadius: '4px' }}>
            <h4>Add User</h4>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Username"
                style={{ flex: 1, padding: '8px', background: '#222', border: '1px solid #444', color: '#fff' }}
              />
              <select
                value={newPermission}
                onChange={e => setNewPermission(e.target.value)}
                style={{ padding: '8px', background: '#222', border: '1px solid #444', color: '#fff' }}
              >
                <option value="view">View</option>
                <option value="control">Control</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleShare}
                disabled={adding || !newUsername}
                className="dialog-btn primary"
              >
                {adding ? '...' : 'Add'}
              </button>
            </div>
            {error && <p style={{ color: '#ff6b6b', marginTop: '10px', fontSize: '0.9em' }}>{error}</p>}
          </div>

          <h4>Shared With</h4>
          {loading ? (
            <p>Loading...</p>
          ) : shares.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Not shared with anyone yet.</p>
          ) : (
            <div className="shares-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {shares.map(share => (
                <div key={share.userId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px', borderBottom: '1px solid #333'
                }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{share.username}</span>
                    <span style={{ marginLeft: '10px', fontSize: '0.8em', background: '#444', padding: '2px 6px', borderRadius: '4px' }}>
                      {share.permission}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnshare(share.userId)}
                    style={{ background: 'transparent', color: '#ff6b6b', border: 'none', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: '20px', textAlign: 'right' }}>
          <button className="dialog-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
