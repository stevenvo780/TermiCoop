import { useState, useEffect, useRef } from 'react';
import {
  Hexagon, TriangleAlert, Terminal, Globe, Shield, Zap, Users, Server,
  Check, Crown, Gift, Sparkles, ChevronDown, ArrowRight, Download, MonitorSmartphone,
  Network, Lock, Cpu, Workflow, ChevronRight, HelpCircle, Rocket, Clock, Activity, Eye,
  Copy, BookOpen
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './LoginPage.css';

const NEXUS_URL = import.meta.env.VITE_NEXUS_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3002');

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
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
  pro: '⭐ Recomendado',
  enterprise: '💎 Premium',
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

const FEATURES = [
  { icon: Terminal, title: 'Terminal Remoto', desc: 'Accede a tus servidores desde cualquier navegador con una terminal completa.' },
  { icon: Globe, title: 'Desde Cualquier Lugar', desc: 'Conexión segura via WebSocket. Solo necesitas un navegador.' },
  { icon: Shield, title: 'Seguro por Diseño', desc: 'Autenticación JWT, tokens por worker, cifrado en tránsito.' },
  { icon: Server, title: 'Multi-Worker', desc: 'Conecta múltiples servidores y cambia entre ellos al instante.' },
  { icon: Users, title: 'Compartir Workers', desc: 'Comparte acceso a tus servidores con tu equipo de forma controlada.' },
  { icon: Zap, title: 'Ultra Rápido', desc: 'Latencia mínima gracias a WebSockets bidireccionales.' },
];

export function LoginPage() {
  const { login, register, authError, busy } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [installTab, setInstallTab] = useState<'quick' | 'deb' | 'rpm' | 'manual'>('quick');
  const loginRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const installRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${NEXUS_URL}/api/payments/plans`)
      .then(r => r.json())
      .then(data => setPlans(data.plans || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent, isRegister: boolean) => {
    e.preventDefault();
    if (isRegister) {
      await register(username, password);
    } else {
      await login(username, password);
    }
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const copyInstall = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="landing-layout">
      <div className="landing-decoration">
        <div className="decoration-grid"></div>
      </div>

      {/* ─── Navbar ─── */}
      <nav className="landing-nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <Hexagon size={24} />
            <span>TermiCoop</span>
          </div>
          <div className="nav-links">
            <button onClick={() => scrollTo(installRef)} className="nav-link">Instalar</button>
            <button onClick={() => scrollTo(pricingRef)} className="nav-link">Planes</button>
            <button onClick={() => { setShowLogin(true); setTimeout(() => scrollTo(loginRef), 100); }} className="nav-link">Iniciar Sesión</button>
            <button onClick={() => { setShowLogin(true); setTimeout(() => scrollTo(loginRef), 100); }} className="nav-cta">
              Comenzar Gratis <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">🚀 Terminal remoto distribuido</div>
          <h1 className="hero-title">
            Controla todos tus servidores<br />
            <span className="hero-gradient">desde un solo lugar</span>
          </h1>
          <p className="hero-desc">
            TermiCoop te permite acceder a terminales remotas de cualquier servidor,
            VPS o máquina en tu red — todo desde tu navegador, sin instalar nada en el cliente.
          </p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={() => { setShowLogin(true); setTimeout(() => scrollTo(loginRef), 100); }}>
              Comenzar Gratis <ArrowRight size={18} />
            </button>
            <button className="btn-hero-secondary" onClick={() => scrollTo(pricingRef)}>
              Ver Planes <ChevronDown size={18} />
            </button>
          </div>
          <div className="hero-terminal">
            <div className="terminal-header">
              <span className="terminal-dot red"></span>
              <span className="terminal-dot yellow"></span>
              <span className="terminal-dot green"></span>
              <span className="terminal-title">humanizar1 — bash</span>
            </div>
            <div className="terminal-body">
              <div className="terminal-line"><span className="t-prompt">stev@humanizar1:~$</span> <span className="t-cmd">htop</span></div>
              <div className="terminal-line"><span className="t-prompt">stev@humanizar1:~$</span> <span className="t-cmd">docker ps --format &quot;table {'{{.Names}}\t{{.Status}}'}&quot;</span></div>
              <div className="terminal-line t-output">NAMES         STATUS</div>
              <div className="terminal-line t-output">nexus         Up 3 days</div>
              <div className="terminal-line t-output">postgres      Up 3 days</div>
              <div className="terminal-line"><span className="t-prompt">stev@humanizar1:~$</span> <span className="t-cursor">▊</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="features-section">
        <h2 className="section-title">¿Por qué TermiCoop?</h2>
        <p className="section-subtitle">Todo lo que necesitas para administrar tus servidores de forma remota.</p>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">
                <f.icon size={24} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="how-it-works-section">
        <h2 className="section-title">¿Cómo funciona?</h2>
        <p className="section-subtitle">En tres simples pasos estarás conectado a tus servidores.</p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-icon"><Rocket size={32} /></div>
            <h3>Crea tu cuenta</h3>
            <p>Regístrate gratis en segundos. No necesitas tarjeta de crédito para empezar.</p>
          </div>
          <div className="step-connector"><ChevronRight size={24} /></div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-icon"><Download size={32} /></div>
            <h3>Instala el Worker</h3>
            <p>Descarga e instala el agente ligero en cada servidor que quieras controlar. Un solo comando.</p>
          </div>
          <div className="step-connector"><ChevronRight size={24} /></div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-icon"><MonitorSmartphone size={32} /></div>
            <h3>Conecta y gestiona</h3>
            <p>Abre tu navegador, selecciona un worker y tendrás una terminal completa al instante.</p>
          </div>
        </div>
      </section>

      {/* ─── Guía de Instalación ─── */}
      <section className="install-docs-section" ref={installRef}>
        <h2 className="section-title"><BookOpen size={28} /> Guía de Instalación</h2>
        <p className="section-subtitle">Instala el worker en tu servidor con un solo comando. Compatible con las principales distribuciones Linux.</p>

        <div className="install-docs-tabs">
          <button className={`install-docs-tab ${installTab === 'quick' ? 'active' : ''}`} onClick={() => setInstallTab('quick')}>
            <Rocket size={16} /> Rápida
          </button>
          <button className={`install-docs-tab ${installTab === 'deb' ? 'active' : ''}`} onClick={() => setInstallTab('deb')}>
            <Download size={16} /> Debian / Ubuntu
          </button>
          <button className={`install-docs-tab ${installTab === 'rpm' ? 'active' : ''}`} onClick={() => setInstallTab('rpm')}>
            <Download size={16} /> RHEL / Fedora
          </button>
          <button className={`install-docs-tab ${installTab === 'manual' ? 'active' : ''}`} onClick={() => setInstallTab('manual')}>
            <Terminal size={16} /> Manual
          </button>
        </div>

        <div className="install-docs-content">
          {installTab === 'quick' && (
            <div className="install-docs-panel">
              <h3>Instalación rápida (recomendada)</h3>
              <p>Detecta tu distribución automáticamente, descarga el paquete correcto y configura el servicio.</p>
              <div className="install-docs-code-wrap">
                <pre className="install-docs-code">{`curl -fsSL https://terminal.humanizar-dev.cloud/install.sh | sudo NEXUS_URL=https://terminal.humanizar-dev.cloud bash -s -- <TU_API_KEY>`}</pre>
                <button className="install-docs-copy" onClick={() => copyInstall('curl -fsSL https://terminal.humanizar-dev.cloud/install.sh | sudo NEXUS_URL=https://terminal.humanizar-dev.cloud bash -s -- <TU_API_KEY>', 'quick')}>
                  <Copy size={14} /> {copied === 'quick' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="install-docs-note">
                <strong>Distros soportadas:</strong> Ubuntu 20.04/22.04/24.04, Debian 11/12, RHEL 8/9, Rocky 8/9, AlmaLinux 8/9, Fedora 39-42, CentOS 7/8.
              </div>
              <div className="install-docs-note">
                <strong>Opcional:</strong> agrega <code>WORKER_NAME="mi-servidor"</code> para asignar un nombre visible.
              </div>
            </div>
          )}

          {installTab === 'deb' && (
            <div className="install-docs-panel">
              <h3>Debian / Ubuntu (.deb)</h3>
              <p>Descarga e instala el paquete .deb directamente.</p>
              <div className="install-docs-code-wrap">
                <pre className="install-docs-code">{`# Descargar paquete
curl -fL "https://terminal.humanizar-dev.cloud/api/downloads/latest/worker-linux.deb?os=ubuntu&version=22.04&arch=amd64" -o worker.deb

# Instalar
sudo dpkg -i worker.deb || sudo apt-get install -f -y

# Configurar API Key
sudo nano /etc/ultimate-terminal/worker.env

# Iniciar servicio
sudo systemctl start ultimate-terminal-worker`}</pre>
                <button className="install-docs-copy" onClick={() => copyInstall(`curl -fL "https://terminal.humanizar-dev.cloud/api/downloads/latest/worker-linux.deb?os=ubuntu&version=22.04&arch=amd64" -o worker.deb\nsudo dpkg -i worker.deb || sudo apt-get install -f -y`, 'deb')}>
                  <Copy size={14} /> {copied === 'deb' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="install-docs-note">
                Cambia <code>os=ubuntu&version=22.04</code> según tu distro: <code>debian/12</code>, <code>linuxmint</code>, <code>pop</code>, <code>kali</code>.
              </div>
              <div className="install-docs-distros">
                <span className="distro-badge">Ubuntu 20.04</span>
                <span className="distro-badge">Ubuntu 22.04</span>
                <span className="distro-badge">Ubuntu 24.04</span>
                <span className="distro-badge">Debian 11</span>
                <span className="distro-badge">Debian 12</span>
                <span className="distro-badge">Linux Mint</span>
              </div>
            </div>
          )}

          {installTab === 'rpm' && (
            <div className="install-docs-panel">
              <h3>RHEL / Fedora (.rpm)</h3>
              <p>Descarga e instala el paquete .rpm para distribuciones basadas en Red Hat.</p>
              <div className="install-docs-code-wrap">
                <pre className="install-docs-code">{`# Descargar paquete
curl -fL "https://terminal.humanizar-dev.cloud/api/downloads/latest/worker-linux.rpm?os=rocky&version=9&arch=x86_64" -o worker.rpm

# Instalar
sudo rpm -Uvh worker.rpm

# Configurar API Key
sudo nano /etc/ultimate-terminal/worker.env

# Iniciar servicio
sudo systemctl start ultimate-terminal-worker`}</pre>
                <button className="install-docs-copy" onClick={() => copyInstall(`curl -fL "https://terminal.humanizar-dev.cloud/api/downloads/latest/worker-linux.rpm?os=rocky&version=9&arch=x86_64" -o worker.rpm\nsudo rpm -Uvh worker.rpm`, 'rpm')}>
                  <Copy size={14} /> {copied === 'rpm' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="install-docs-note">
                Opciones de <code>os=</code>: <code>rhel</code>, <code>rocky</code>, <code>alma</code>, <code>centos</code>, <code>fedora</code>.
              </div>
              <div className="install-docs-distros">
                <span className="distro-badge">RHEL 8/9</span>
                <span className="distro-badge">Rocky 8/9</span>
                <span className="distro-badge">AlmaLinux 8/9</span>
                <span className="distro-badge">Fedora 39-42</span>
                <span className="distro-badge">CentOS 7/8</span>
              </div>
            </div>
          )}

          {installTab === 'manual' && (
            <div className="install-docs-panel">
              <h3>Configuración manual</h3>
              <p>Si ya instalaste el paquete por otro medio, configura la API key y reinicia el servicio.</p>
              <div className="install-docs-code-wrap">
                <pre className="install-docs-code">{`# Crear directorio de configuración
sudo mkdir -p /etc/ultimate-terminal

# Configurar variables
sudo bash -c 'cat > /etc/ultimate-terminal/worker.env << EOF
NEXUS_URL=https://terminal.humanizar-dev.cloud
API_KEY=<TU_API_KEY>
WORKER_NAME=<NOMBRE_OPCIONAL>
EOF'

# Reiniciar servicio
sudo systemctl restart ultimate-terminal-worker

# Verificar estado
sudo systemctl status ultimate-terminal-worker`}</pre>
                <button className="install-docs-copy" onClick={() => copyInstall(`sudo mkdir -p /etc/ultimate-terminal\nsudo bash -c 'cat > /etc/ultimate-terminal/worker.env << EOF\nNEXUS_URL=https://terminal.humanizar-dev.cloud\nAPI_KEY=<TU_API_KEY>\nWORKER_NAME=<NOMBRE_OPCIONAL>\nEOF'`, 'manual')}>
                  <Copy size={14} /> {copied === 'manual' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="install-docs-note">
                <strong>Arch Linux:</strong> No hay paquete oficial. Usa la instalación rápida o compila desde fuente con el <a href="https://github.com/stevenvo780/TermiCoop" target="_blank" rel="noopener noreferrer">código fuente</a>.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon"><Activity size={28} /></div>
            <div className="stat-value">99.9%</div>
            <div className="stat-label">Uptime garantizado</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Clock size={28} /></div>
            <div className="stat-value">&lt;50ms</div>
            <div className="stat-label">Latencia promedio</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Shield size={28} /></div>
            <div className="stat-value">E2E</div>
            <div className="stat-label">Cifrado en tránsito</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Server size={28} /></div>
            <div className="stat-value">∞</div>
            <div className="stat-label">Workers ilimitados (Pro+)</div>
          </div>
        </div>
      </section>

      {/* ─── Use Cases ─── */}
      <section className="use-cases-section">
        <h2 className="section-title">Casos de Uso</h2>
        <p className="section-subtitle">TermiCoop se adapta a múltiples escenarios profesionales.</p>
        <div className="use-cases-grid">
          <div className="use-case-card">
            <div className="use-case-icon"><Cpu size={28} /></div>
            <h3>DevOps & SysAdmin</h3>
            <p>Gestiona múltiples servidores de producción, staging y desarrollo desde un solo panel. Monitorea logs, reinicia servicios y despliega actualizaciones sin necesidad de SSH individual.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon"><Users size={28} /></div>
            <h3>Equipos Colaborativos</h3>
            <p>Comparte sesiones de terminal en tiempo real con tu equipo. Ideal para pair programming, debugging colaborativo o capacitación — todos ven la misma terminal simultáneamente.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon"><Network size={28} /></div>
            <h3>Homelab & IoT</h3>
            <p>Accede a tu NAS, Raspberry Pi o servidor casero desde cualquier lugar. Sin necesidad de abrir puertos ni configurar VPNs complejas — el worker se conecta automáticamente.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon"><Lock size={28} /></div>
            <h3>Entornos Seguros</h3>
            <p>Controla el acceso con permisos granulares: solo lectura, control o administración. Cada worker se autentica con token único. Perfecto para cumplir políticas de seguridad corporativas.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon"><Eye size={28} /></div>
            <h3>Monitoreo en Vivo</h3>
            <p>Observa en tiempo real lo que sucede en tus servidores. Conecta una sesión en modo vista para supervisar procesos, builds o deploys sin riesgo de ejecutar comandos accidentales.</p>
          </div>
          <div className="use-case-card">
            <div className="use-case-icon"><Workflow size={28} /></div>
            <h3>Automatización</h3>
            <p>Combina TermiCoop con tus flujos CI/CD. Ejecuta scripts de mantenimiento, verifica estados de servicios o realiza tareas programadas desde una interfaz web unificada.</p>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="faq-section">
        <h2 className="section-title">Preguntas Frecuentes</h2>
        <p className="section-subtitle">Resolvemos tus dudas más comunes.</p>
        <div className="faq-grid">
          <details className="faq-item">
            <summary><HelpCircle size={18} /> ¿Necesito abrir puertos en mi servidor?</summary>
            <p>No. El worker se conecta al nexus de forma saliente (outbound), así que no necesitas exponer puertos ni configurar NAT/firewall. Funciona incluso detrás de CGNAT.</p>
          </details>
          <details className="faq-item">
            <summary><HelpCircle size={18} /> ¿Es seguro dejar un worker corriendo?</summary>
            <p>Sí. Cada worker se autentica con un token único y las sesiones se cifran en tránsito con TLS. Además puedes revocar el acceso en cualquier momento desde tu panel.</p>
          </details>
          <details className="faq-item">
            <summary><HelpCircle size={18} /> ¿Qué sistemas operativos soporta el worker?</summary>
            <p>El worker está disponible como binario nativo para Linux (Ubuntu, Debian, RHEL, Arch) tanto en x86_64 como ARM. También se puede ejecutar vía Docker en cualquier plataforma.</p>
          </details>
          <details className="faq-item">
            <summary><HelpCircle size={18} /> ¿Puedo compartir un worker con mi equipo?</summary>
            <p>Sí, con los planes Pro y Enterprise puedes compartir workers con otros usuarios, asignando permisos de solo vista, control o administración completa por cada persona.</p>
          </details>
          <details className="faq-item">
            <summary><HelpCircle size={18} /> ¿Cuántas sesiones simultáneas puedo tener?</summary>
            <p>Depende de tu plan. El plan gratuito permite 1 sesión activa, Básico permite 3, y Pro/Enterprise ofrecen sesiones ilimitadas. Cada sesión es una terminal independiente.</p>
          </details>
          <details className="faq-item">
            <summary><HelpCircle size={18} /> ¿Puedo auto-hospedar el nexus?</summary>
            <p>Sí. TermiCoop es open source. Puedes desplegar tu propio nexus en tu infraestructura con Docker Compose o como paquete systemd. La documentación completa está en GitHub.</p>
          </details>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="pricing-section" ref={pricingRef}>
        <h2 className="section-title">Planes y Precios</h2>
        <p className="section-subtitle">Elige el plan que se adapte a tu equipo. Comienza gratis, escala cuando quieras.</p>
        <div className="pricing-grid">
          {plans.map((plan) => {
            const Icon = planIcons[plan.id] || Zap;
            const color = planColors[plan.id] || '#3b82f6';
            const badge = planBadges[plan.id];
            const isPopular = plan.id === 'pro';

            return (
              <div key={plan.id} className={`pricing-card ${isPopular ? 'popular' : ''}`} style={{ '--plan-color': color } as React.CSSProperties}>
                {badge && <div className="pricing-badge" style={{ background: color }}>{badge}</div>}
                <div className="pricing-icon"><Icon size={28} color={color} /></div>
                <h3 className="pricing-name">{plan.name}</h3>
                <p className="pricing-desc">{plan.description}</p>
                <div className="pricing-price">
                  {plan.price === 0 ? 'Gratis' : formatCurrency(plan.price, plan.currency)}
                  {plan.price > 0 && <span className="pricing-period">/mes</span>}
                </div>
                <ul className="pricing-features">
                  {plan.features.map((f, i) => (
                    <li key={i}><Check size={16} color={color} /> {f}</li>
                  ))}
                </ul>
                <button
                  className={`pricing-cta ${isPopular ? 'primary' : ''}`}
                  style={isPopular ? { background: color } : {}}
                  onClick={() => { setShowLogin(true); setTimeout(() => scrollTo(loginRef), 100); }}
                >
                  {plan.price === 0 ? 'Comenzar Gratis' : 'Suscribirse'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="final-cta-section">
        <div className="cta-glow"></div>
        <h2>¿Listo para tomar el control?</h2>
        <p>Crea tu cuenta gratuita y conecta tu primer servidor en menos de 5 minutos.</p>
        <div className="cta-actions">
          <button className="btn-hero-primary" onClick={() => { setShowLogin(true); setTimeout(() => scrollTo(loginRef), 100); }}>
            Comenzar Gratis <ArrowRight size={18} />
          </button>
          <a href="https://github.com/stevenvo780/TermiCoop" target="_blank" rel="noopener noreferrer" className="btn-hero-secondary">
            Ver en GitHub <ChevronRight size={18} />
          </a>
        </div>
      </section>

      {/* ─── Login / Register ─── */}
      <section className={`login-section ${showLogin ? 'visible' : ''}`} ref={loginRef} id="login">
        <div className="login-container">
          <div className="login-header">
            <div className="login-logo">
              <span className="logo-icon"><Hexagon /></span>
              <h1>TermiCoop</h1>
            </div>
            <p className="login-subtitle">Inicia sesión o crea tu cuenta</p>
          </div>

          <form className="login-form" onSubmit={(e) => handleSubmit(e, false)}>
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {authError && (
              <div className="error-message">
                <span className="error-icon"><TriangleAlert /></span>
                {authError}
              </div>
            )}

            <div className="login-actions">
              <button type="submit" className="btn-primary" disabled={busy || !username || !password}>
                {busy ? 'Cargando...' : 'Iniciar Sesión'}
              </button>
              <button type="button" className="btn-secondary" disabled={busy || !username || !password} onClick={(e) => handleSubmit(e, true)}>
                Registrarse
              </button>
            </div>
          </form>

          <div className="login-footer">
            <p>Control remoto seguro via WebSocket · Cifrado de extremo a extremo</p>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Hexagon size={20} /> TermiCoop
          </div>
          <div className="footer-links">
            <a href="https://github.com/stevenvo780/TermiCoop" target="_blank" rel="noopener noreferrer">GitHub</a>
            <button onClick={() => scrollTo(installRef)}>Instalar</button>
            <button onClick={() => scrollTo(pricingRef)}>Planes</button>
            <button onClick={() => { setShowLogin(true); setTimeout(() => scrollTo(loginRef), 100); }}>Iniciar Sesión</button>
          </div>
          <p>© {new Date().getFullYear()} TermiCoop. Terminal remoto distribuido.</p>
        </div>
      </footer>
    </div>
  );
}
