import { useState } from 'react';
import { Hexagon, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './LoginPage.css';

export function LoginPage() {
  const { login, register, authError, busy } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent, isRegister: boolean) => {
    e.preventDefault();
    if (isRegister) {
      await register(username, password);
    } else {
      await login(username, password);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-icon">
              <Hexagon />
            </span>
            <h1>Ultimate Terminal</h1>
          </div>
          <p className="login-subtitle">Sistema de terminal remoto distribuido</p>
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
              autoFocus
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
              <span className="error-icon">
                <TriangleAlert />
              </span>
              {authError}
            </div>
          )}

          <div className="login-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || !username || !password}
            >
              {busy ? 'Cargando...' : 'Iniciar Sesión'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !username || !password}
              onClick={(e) => handleSubmit(e, true)}
            >
              Registrarse
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>Control remoto seguro via WebSocket</p>
        </div>
      </div>

      <div className="login-decoration">
        <div className="decoration-grid"></div>
      </div>
    </div>
  );
}
