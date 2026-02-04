import { useState } from 'react';
import type { Worker } from '../App';

interface InstallWorkerModalProps {
  initialWorker: Worker | null;
  onClose: () => void;
  onWorkerCreated: (worker: Worker) => void;
  nexusUrl: string;
  token: string;
}

export function InstallWorkerModal({ initialWorker, onClose, onWorkerCreated, nexusUrl, token }: InstallWorkerModalProps) {
  const [step, setStep] = useState<'create' | 'install'>(initialWorker ? 'install' : 'create');
  const [workerName, setWorkerName] = useState('');
  const [worker, setWorker] = useState<Worker | null>(initialWorker);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const installCommand = worker
    ? `curl -fsSL ${nexusUrl}/install | sudo NEXUS_URL=${nexusUrl} bash -s -- ${worker.api_key}`
    : '';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${nexusUrl}/api/workers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: workerName.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error creando worker');
      }

      const newWorker = await res.json();
      setWorker(newWorker);
      onWorkerCreated(newWorker);
      setStep('install');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{step === 'create' ? 'Nuevo Worker' : `Instalar ${worker?.name}`}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {step === 'create' ? (
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nombre del Worker</label>
                <input
                  type="text"
                  value={workerName}
                  onChange={e => setWorkerName(e.target.value)}
                  placeholder="ej. servidor-produccion"
                  autoFocus
                  disabled={loading}
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loading || !workerName.trim()}>
                  {loading ? 'Creando...' : 'Crear y Continuar'}
                </button>
              </div>
            </form>
          ) : (
            <div className="install-instructions">
              <p>Ejecuta este comando en tu servidor para instalar el agente:</p>
              <div className="code-block-container">
                <pre className="code-block">{installCommand}</pre>
                <button className="copy-btn" onClick={copyToClipboard}>
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              <div className="info-box">
                <strong>Nota:</strong> Este script detectará automáticamente tu sistema operativo e instalará las dependencias necesarias.
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-primary" onClick={onClose}>Listo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
