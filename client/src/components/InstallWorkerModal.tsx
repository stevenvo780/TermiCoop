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
  const [reportedName, setReportedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [packageStatus, setPackageStatus] = useState<{
    deb: 'checking' | 'ok' | 'missing' | 'unknown';
    rpm: 'checking' | 'ok' | 'missing' | 'unknown';
  }>({ deb: 'checking', rpm: 'checking' });
  const [osTab, setOsTab] = useState<'debian' | 'rhel' | 'arch' | 'manual'>('debian');
  const [debianDistro, setDebianDistro] = useState('ubuntu');
  const [debianVersion, setDebianVersion] = useState('22.04');
  const [debianArch, setDebianArch] = useState('amd64');
  const [rhelDistro, setRhelDistro] = useState('rhel');
  const [rhelVersion, setRhelVersion] = useState('9');
  const [rhelArch, setRhelArch] = useState('x86_64');
  const ubuntuVersions = useMemo(() => ([
    { value: '24.04', label: '24.04 LTS (Noble)' },
    { value: '22.04', label: '22.04 LTS (Jammy)' },
    { value: '20.04', label: '20.04 LTS (Focal)' },
  ]), []);
  const isUbuntu = debianDistro === 'ubuntu';

  const baseUrl = useMemo(() => nexusUrl.replace(/\/$/, ''), [nexusUrl]);
  const apiKey = worker?.api_key || apiKeyInput.trim();
  const reportedNameValue = reportedName.trim();
  const canInstall = Boolean(apiKey);

  const debDownloadUrl = useMemo(
    () => `${baseUrl}/api/downloads/latest/worker-linux.deb?os=${encodeURIComponent(debianDistro)}&version=${encodeURIComponent(debianVersion)}&arch=${encodeURIComponent(debianArch)}`,
    [baseUrl, debianArch, debianDistro, debianVersion]
  );
  const rpmDownloadUrl = useMemo(
    () => `${baseUrl}/api/downloads/latest/worker-linux.rpm?os=${encodeURIComponent(rhelDistro)}&version=${encodeURIComponent(rhelVersion)}&arch=${encodeURIComponent(rhelArch)}`,
    [baseUrl, rhelArch, rhelDistro, rhelVersion]
  );
  const workerNameEnv = reportedNameValue ? ` WORKER_NAME="${reportedNameValue}"` : '';

  const installCommand = canInstall
    ? `curl -fsSL ${baseUrl}/install.sh | sudo NEXUS_URL=${baseUrl}${workerNameEnv} bash -s -- ${apiKey}`
    : '';
  const debCommand = canInstall
    ? `curl -fL ${debDownloadUrl} -o worker.deb\nsudo dpkg -i worker.deb || sudo apt-get install -f -y`
    : '';
  const rpmCommand = canInstall
    ? `curl -fL ${rpmDownloadUrl} -o worker.rpm\nsudo rpm -Uvh worker.rpm`
    : '';
  const configCommand = canInstall
    ? [
      'sudo mkdir -p /etc/ultimate-terminal',
      `sudo bash -c 'grep -q "^NEXUS_URL=" /etc/ultimate-terminal/worker.env && sed -i "s|^NEXUS_URL=.*|NEXUS_URL=${baseUrl}|" /etc/ultimate-terminal/worker.env || echo "NEXUS_URL=${baseUrl}" >> /etc/ultimate-terminal/worker.env'`,
      `sudo bash -c 'grep -q "^API_KEY=" /etc/ultimate-terminal/worker.env && sed -i "s|^API_KEY=.*|API_KEY=${apiKey}|" /etc/ultimate-terminal/worker.env || echo "API_KEY=${apiKey}" >> /etc/ultimate-terminal/worker.env'`,
      ...(reportedNameValue
        ? [
          `sudo bash -c 'grep -q "^WORKER_NAME=" /etc/ultimate-terminal/worker.env && sed -i "s|^WORKER_NAME=.*|WORKER_NAME=${reportedNameValue}|" /etc/ultimate-terminal/worker.env || echo "WORKER_NAME=${reportedNameValue}" >> /etc/ultimate-terminal/worker.env'`,
        ]
        : []),
      'sudo systemctl restart ultimate-terminal-worker',
    ].join('\n')
    : '';

  useEffect(() => {
    if (worker?.name && !reportedName) {
      setReportedName(worker.name);
    }
  }, [reportedName, worker?.name]);

  useEffect(() => {
    if (isUbuntu && !ubuntuVersions.some((item) => item.value === debianVersion)) {
      setDebianVersion('22.04');
    }
  }, [debianVersion, isUbuntu, ubuntuVersions]);

  useEffect(() => {
    let isMounted = true;
    const checkPackage = async (url: string) => {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) return 'ok';
        if (res.status === 404) return 'missing';
        return 'unknown';
      } catch {
        return 'unknown';
      }
    };

    const run = async () => {
      setPackageStatus({ deb: 'checking', rpm: 'checking' });
      const [deb, rpm] = await Promise.all([checkPackage(debDownloadUrl), checkPackage(rpmDownloadUrl)]);
      if (isMounted) {
        setPackageStatus({ deb, rpm });
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [baseUrl, debDownloadUrl, rpmDownloadUrl]);

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
                    <div className="install-option-grid">
                      <div className="form-group">
                        <label>Nombre reportado (opcional)</label>
                        <input
                          type="text"
                          value={reportedName}
                          onChange={(event) => setReportedName(event.target.value)}
                          placeholder="ej. servidor-produccion"
                        />
                      </div>
                    </div>
                    <div className="helper-note">
                      Detecta la distribución, instala el paquete correcto y configura la API key.
                    </div>
                  </div>

                  <div className="install-section">
                    <div className="install-section-title">
                      <Package />
                      <span>Paquetes por sistema</span>
                    </div>
                    <div className="helper-note">
                      El servidor selecciona el paquete más compatible según distro, versión y arquitectura.
                    </div>
                    <div className="install-tabs">
                      <button
                        className={`install-tab-btn ${osTab === 'debian' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setOsTab('debian')}
                      >
                        Debian / Ubuntu
                      </button>
                      <button
                        className={`install-tab-btn ${osTab === 'rhel' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setOsTab('rhel')}
                      >
                        RHEL / Fedora
                      </button>
                      <button
                        className={`install-tab-btn ${osTab === 'arch' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setOsTab('arch')}
                      >
                        Arch
                      </button>
                      <button
                        className={`install-tab-btn ${osTab === 'manual' ? 'active' : ''}`}
                        type="button"
                        onClick={() => setOsTab('manual')}
                      >
                        Manual
                      </button>
                    </div>
                    {osTab === 'debian' && (
                      <div className="install-tab-panel">
                        <div className="install-option-grid">
                          <div className="form-group">
                            <label>Distro</label>
                            <select
                              className="install-select"
                              value={debianDistro}
                              onChange={(event) => setDebianDistro(event.target.value)}
                            >
                              <option value="ubuntu">Ubuntu</option>
                              <option value="debian">Debian</option>
                              <option value="linuxmint">Linux Mint</option>
                              <option value="pop">Pop!_OS</option>
                              <option value="kali">Kali</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Versión</label>
                            {isUbuntu ? (
                              <select
                                className="install-select"
                                value={debianVersion}
                                onChange={(event) => setDebianVersion(event.target.value)}
                              >
                                {ubuntuVersions.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={debianVersion}
                                onChange={(event) => setDebianVersion(event.target.value)}
                                placeholder="ej. 12 / 11 / 10"
                              />
                            )}
                          </div>
                          <div className="form-group">
                            <label>Arquitectura</label>
                            <select
                              className="install-select"
                              value={debianArch}
                              onChange={(event) => setDebianArch(event.target.value)}
                            >
                              <option value="amd64">amd64</option>
                              <option value="arm64">arm64</option>
                              <option value="aarch64">aarch64</option>
                              <option value="x86_64">x86_64</option>
                            </select>
                          </div>
                        </div>
                        <div className="install-status">
                          <span className={`status-pill ${packageStatus.deb}`}>
                            {packageStatus.deb === 'checking' && <Loader2 className="spin" />}
                            {packageStatus.deb === 'ok' && <CheckCircle2 />}
                            {packageStatus.deb === 'missing' && <AlertTriangle />}
                            {packageStatus.deb === 'unknown' && <AlertTriangle />}
                            .deb {packageStatus.deb === 'ok' ? 'disponible' : packageStatus.deb === 'missing' ? 'no encontrado' : packageStatus.deb === 'checking' ? 'verificando' : 'desconocido'}
                          </span>
                        </div>
                        {isUbuntu && (
                          <div className="helper-note">
                            Paquetes LTS disponibles: 20.04, 22.04 y 24.04. Versiones más antiguas no se soportan.
                          </div>
                        )}
                        <div className="helper-row">
                          <span className="helper-label">Descarga directa (.deb)</span>
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
                    )}

                    {osTab === 'rhel' && (
                      <div className="install-tab-panel">
                        <div className="install-option-grid">
                          <div className="form-group">
                            <label>Distro</label>
                            <select
                              className="install-select"
                              value={rhelDistro}
                              onChange={(event) => setRhelDistro(event.target.value)}
                            >
                              <option value="rhel">RHEL</option>
                              <option value="centos">CentOS</option>
                              <option value="rocky">Rocky</option>
                              <option value="alma">AlmaLinux</option>
                              <option value="fedora">Fedora</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Versión</label>
                            <input
                              type="text"
                              value={rhelVersion}
                              onChange={(event) => setRhelVersion(event.target.value)}
                              placeholder="ej. 9 / 8 / 39"
                            />
                          </div>
                          <div className="form-group">
                            <label>Arquitectura</label>
                            <select
                              className="install-select"
                              value={rhelArch}
                              onChange={(event) => setRhelArch(event.target.value)}
                            >
                              <option value="x86_64">x86_64</option>
                              <option value="aarch64">aarch64</option>
                              <option value="amd64">amd64</option>
                              <option value="arm64">arm64</option>
                            </select>
                          </div>
                        </div>
                        <div className="install-status">
                          <span className={`status-pill ${packageStatus.rpm}`}>
                            {packageStatus.rpm === 'checking' && <Loader2 className="spin" />}
                            {packageStatus.rpm === 'ok' && <CheckCircle2 />}
                            {packageStatus.rpm === 'missing' && <AlertTriangle />}
                            {packageStatus.rpm === 'unknown' && <AlertTriangle />}
                            .rpm {packageStatus.rpm === 'ok' ? 'disponible' : packageStatus.rpm === 'missing' ? 'no encontrado' : packageStatus.rpm === 'checking' ? 'verificando' : 'desconocido'}
                          </span>
                        </div>
                        <div className="helper-row">
                          <span className="helper-label">Descarga directa (.rpm)</span>
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
                    )}

                    {osTab === 'arch' && (
                      <div className="install-tab-panel">
                        <div className="info-box">
                          <strong>Arch Linux:</strong> no hay paquete oficial todavía. Usa el binario manual o compila desde fuente.
                        </div>
                        <div className="helper-note">
                          Si necesitas un paquete específico, crea un PKGBUILD o usa el build compatible (Ubuntu 20.04 + Node 18).
                        </div>
                      </div>
                    )}

                    {osTab === 'manual' && (
                      <div className="install-tab-panel">
                        <div className="helper-note">
                          Si instalaste el paquete manualmente, configura la API key y reinicia el servicio.
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
                    )}
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
