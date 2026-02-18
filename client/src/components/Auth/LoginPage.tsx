import { useState, useEffect, useRef } from 'react';
import {
  Hexagon, TriangleAlert, Terminal, Globe, Shield, Zap, Users, Server,
  Check, Crown, Gift, Sparkles, ChevronDown, ArrowRight
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
  const loginRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

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
          <p>© {new Date().getFullYear()} TermiCoop. Terminal remoto distribuido.</p>
        </div>
      </footer>
    </div>
  );
}
