import { useEffect, useMemo, useState } from 'react';
import type { Worker } from '../store/slices/workersSlice';
import { AlertTriangle, CheckCircle2, Copy, Loader2, Package, Terminal } from 'lucide-react';

interface InstallWorkerModalProps {
  initialWorker: Worker | null;
  onClose: () => void;
  onWorkerCreated: (worker: Worker) => void;
  nexusUrl: string;
  token: string;
}

export function InstallWorkerModal({ initialWorker, onClose, onWorkerCreated, nexusUrl, token }: InstallWorkerModalProps) {
  const [mode, setMode] = useState<'create' | 'existing'>(initialWorker ? 'existing' : 'create');
  const [workerName, setWorkerName] = useState('');
  const [worker, setWorker] = useState<Worker | null>(initialWorker);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [packageStatus, setPackageStatus] = useState<{
    deb: 'checking' | 'ok' | 'missing' | 'unknown';
    rpm: 'checking' | 'ok' | 'missing' | 'unknown';
  }>({ deb: 'checking', rpm: 'checking' });

  const baseUrl = useMemo(() => nexusUrl.replace(/\/$/, ''), [nexusUrl]);
  const apiKey = worker?.api_key || apiKeyInput.trim();
  const canInstall = Boolean(apiKey);

  const installCommand = canInstall
    ? `curl -fsSL ${baseUrl}/install.sh | sudo NEXUS_URL=${baseUrl} bash -s -- ${apiKey}`
    : '';
  const debCommand = canInstall
    ? `curl -fL ${baseUrl}/api/downloads/latest/worker-linux.deb -o worker.deb\nsudo dpkg -i worker.deb || sudo apt-get install -f -y`
    : '';
  const rpmCommand = canInstall
    ? `curl -fL ${baseUrl}/api/downloads/latest/worker-linux.rpm -o worker.rpm\nsudo rpm -Uvh worker.rpm`
    : '';
  const configCommand = canInstall
    ? [
      'sudo mkdir -p /etc/ultimate-terminal',
      `sudo bash -c 'grep -q "^NEXUS_URL=" /etc/ultimate-terminal/worker.env && sed -i "s|^NEXUS_URL=.*|NEXUS_URL=${baseUrl}|" /etc/ultimate-terminal/worker.env || echo "NEXUS_URL=${baseUrl}" >> /etc/ultimate-terminal/worker.env'`,
      `sudo bash -c 'grep -q "^API_KEY=" /etc/ultimate-terminal/worker.env && sed -i "s|^API_KEY=.*|API_KEY=${apiKey}|" /etc/ultimate-terminal/worker.env || echo "API_KEY=${apiKey}" >> /etc/ultimate-terminal/worker.env'`,
      'sudo systemctl restart ultimate-terminal-worker',
    ].join('\n')
    : '';

  useEffect(() => {
    let isMounted = true;
    const checkPackage = async (ext: 'deb' | 'rpm') => {
      try {
        const res = await fetch(`${baseUrl}/api/downloads/latest/worker-linux.${ext}`, { method: 'HEAD' });
        if (res.ok) return 'ok';
        if (res.status === 404) return 'missing';
        return 'unknown';
      } catch {
        return 'unknown';
      }
    };

    const run = async () => {
      setPackageStatus({ deb: 'checking', rpm: 'checking' });
      const [deb, rpm] = await Promise.all([checkPackage('deb'), checkPackage('rpm')]);
      if (isMounted) {
        setPackageStatus({ deb, rpm });
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [baseUrl]);

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
      setMode('existing');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creando worker');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const title = worker
    ? `Instalar ${worker.name}`
    : mode === 'existing'
      ? 'Conectar worker existente'
      : 'Nuevo worker';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content install-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="install-grid">
            <div className="helper-card">
              <div className="helper-label">Paso 1 · API Key</div>
              {!worker && (
                <div className="install-mode-toggle">
                  <button
                    className={`install-mode-btn ${mode === 'create' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setMode('create')}
                  >
                    Crear worker
                  </button>
                  <button
                    className={`install-mode-btn ${mode === 'existing' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setMode('existing')}
                  >
                    Tengo API key
                  </button>
                </div>
              )}

              {mode === 'create' && !worker && (
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
                    <button type="submit" className="btn-primary" disabled={loading || !workerName.trim()}>
                      {loading ? 'Creando...' : 'Crear API key'}
                    </button>
                  </div>
                </form>
              )}

              {mode === 'existing' && !worker && (
                <>
                  <div className="form-group">
                    <label>API Key</label>
                    <input
                      type="text"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Pega tu API key aquí"
                    />
                  </div>
                  <div className="helper-note">
                    Usa una API key ya generada en Nexus. No se crea un worker nuevo.
                  </div>
                </>
              )}

              {worker && (
                <div className="install-api-key">
                  <div className="helper-row">
                    <span className="helper-label">API Key generada</span>
                    <button
                      className="mini-btn"
                      type="button"
                      onClick={() => copyToClipboard(worker.api_key || '', 'apikey')}
                    >
                      <Copy />
                      {copied === 'apikey' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="helper-code install-code">{worker.api_key}</pre>
                </div>
              )}
            </div>

            <div className={`helper-card ${canInstall ? '' : 'disabled'}`}>
              <div className="helper-label">Paso 2 · Instalar worker</div>
              {!canInstall && (
                <div className="helper-note">
                  Ingresa una API key para generar los comandos de instalación.
                </div>
              )}

              {canInstall && (
                <>
                  <div className="install-section">
                    <div className="helper-row">
                      <div className="install-section-title">
                        <Terminal />
                        <span>Instalación rápida (recomendada)</span>
                      </div>
                      <button
                        className="mini-btn"
                        type="button"
                        onClick={() => copyToClipboard(installCommand, 'script')}
                      >
                        <Copy />
                        {copied === 'script' ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="helper-code install-code">{installCommand}</pre>
                    <div className="helper-note">
                      Detecta la distribución, instala el paquete correcto y configura la API key.
                    </div>
                  </div>

                  <div className="install-section">
                    <div className="install-section-title">
                      <Package />
                      <span>Paquetes directos</span>
                    </div>
                    <div className="install-status">
                      <span className={`status-pill ${packageStatus.deb}`}>
                        {packageStatus.deb === 'checking' && <Loader2 className="spin" />}
                        {packageStatus.deb === 'ok' && <CheckCircle2 />}
                        {packageStatus.deb === 'missing' && <AlertTriangle />}
                        {packageStatus.deb === 'unknown' && <AlertTriangle />}
                        .deb {packageStatus.deb === 'ok' ? 'disponible' : packageStatus.deb === 'missing' ? 'no encontrado' : packageStatus.deb === 'checking' ? 'verificando' : 'desconocido'}
                      </span>
                      <span className={`status-pill ${packageStatus.rpm}`}>
                        {packageStatus.rpm === 'checking' && <Loader2 className="spin" />}
                        {packageStatus.rpm === 'ok' && <CheckCircle2 />}
                        {packageStatus.rpm === 'missing' && <AlertTriangle />}
                        {packageStatus.rpm === 'unknown' && <AlertTriangle />}
                        .rpm {packageStatus.rpm === 'ok' ? 'disponible' : packageStatus.rpm === 'missing' ? 'no encontrado' : packageStatus.rpm === 'checking' ? 'verificando' : 'desconocido'}
                      </span>
                    </div>
                    <div className="install-package-grid">
                      <div className="install-package">
                        <div className="helper-row">
                          <span className="helper-label">Debian / Ubuntu</span>
                          <button
                            className="mini-btn"
                            type="button"
                            onClick={() => copyToClipboard(debCommand, 'deb')}
                          >
                            <Copy />
                            {copied === 'deb' ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <pre className="helper-code install-code">{debCommand}</pre>
                      </div>
                      <div className="install-package">
                        <div className="helper-row">
                          <span className="helper-label">RHEL / Fedora</span>
                          <button
                            className="mini-btn"
                            type="button"
                            onClick={() => copyToClipboard(rpmCommand, 'rpm')}
                          >
                            <Copy />
                            {copied === 'rpm' ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <pre className="helper-code install-code">{rpmCommand}</pre>
                      </div>
                    </div>
                  </div>

                  <div className="install-section">
                    <div className="install-section-title">
                      <Terminal />
                      <span>Configurar credenciales (manual)</span>
                    </div>
                    <div className="helper-note">
                      Solo si instalaste el paquete directo y necesitas ajustar la API key.
                    </div>
                    <div className="helper-row">
                      <span className="helper-label">Comandos</span>
                      <button
                        className="mini-btn"
                        type="button"
                        onClick={() => copyToClipboard(configCommand, 'config')}
                      >
                        <Copy />
                        {copied === 'config' ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="helper-code install-code">{configCommand}</pre>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
