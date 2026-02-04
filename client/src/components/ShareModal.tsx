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
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-header">
          <h3>
            <Users size={20} className="text-blue-400" />
            Share Worker: <span className="text-blue-200">{worker.name}</span>
          </h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="share-body">
          <div className="add-user-section">
            <div className="section-label">Add Person</div>
            <div className="add-input-group">
              <input
                className="share-input"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Enter username"
                onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              />
              <select
                className="permission-select"
                value={newPermission}
                onChange={e => setNewPermission(e.target.value)}
              >
                <option value="view">View</option>
                <option value="control">Control</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleShare}
                disabled={adding || !newUsername}
                className="add-btn"
              >
                {adding ? '...' : 'Add'}
              </button>
            </div>
            {error && <div className="error-text">{error}</div>}
          </div>

          <div className="shared-list-section">
            <div className="section-label">Shared With ({shares.length})</div>
            <div className="shared-list">
              {loading ? (
                <div className="empty-list">Loading access list...</div>
              ) : shares.length === 0 ? (
                <div className="empty-list">
                  Not shared with anyone yet.<br />
                  Add a user above to grant access.
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
                        <span className={`permission-badge ${share.permission}`}>
                          {share.permission}
                        </span>
                      </div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => handleUnshare(share.userId)}
                      title="Revoke Access"
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
          <button className="close-modal-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
