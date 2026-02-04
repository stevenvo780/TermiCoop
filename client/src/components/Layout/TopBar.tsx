import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setShowInstallModal,
  setShowSettings,
  setShowUserMenu,
  setShowWorkerModal,
  setEditingWorker,
} from '../../store';
import type { Worker } from '../../store/slices/workersSlice';
import './TopBar.css';

interface TopBarProps {
  onSelectWorker: (workerId: string) => void;
  onResume: () => void;
  onFullscreen: () => void;
  onInstallPWA: () => void;
  installPromptAvailable: boolean;
}

export function TopBar({
  onSelectWorker,
  onResume,
  onFullscreen,
  onInstallPWA,
  installPromptAvailable,
}: TopBarProps) {
  const dispatch = useAppDispatch();
  const workers = useAppSelector((state) => state.workers.workers);
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const activeSessionId = useAppSelector((state) => state.sessions.activeSessionId);
  const connectionState = useAppSelector((state) => state.connection.connectionState);
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const token = useAppSelector((state) => state.auth.token);
  const showUserMenu = useAppSelector((state) => state.ui.showUserMenu);
  const isFullscreen = useAppSelector((state) => state.ui.isFullscreen);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeWorkerId = activeSession?.workerId || '';

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) {
      onSelectWorker(e.target.value);
    }
  };

  const handleCreateWorker = () => {
    dispatch(setEditingWorker(null));
    dispatch(setShowWorkerModal(true));
  };

  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-icon">⬡</span>
      </div>

      <div className="control-group">
        <label>Worker</label>
        <select
          value={activeWorkerId}
          onChange={handleWorkerChange}
          disabled={!workers.length}
        >
          <option value="">Seleccionar worker</option>
          {workers.map((w: Worker) => (
            <option key={w.id} value={w.id}>
              {w.name}{w.status === 'offline' ? ' (offline)' : ''}
            </option>
          ))}
        </select>
        <button
          className="ghost-btn"
          title="Crear nuevo worker"
          onClick={handleCreateWorker}
          style={{ marginLeft: '5px', padding: '0 8px', fontSize: '1.2em' }}
        >
          +
        </button>
      </div>

      <div className="topbar-stats">
        <span>{sessions.length} sesion{sessions.length !== 1 ? 'es' : ''}</span>
        <span>•</span>
        <span>{workers.length} worker{workers.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="topbar-right">
        <button
          className="icon-btn"
          onClick={() => dispatch(setShowInstallModal(true))}
          title="Instalar worker"
        >
          ⬇
        </button>
        {activeSessionId && (
          <button className="icon-btn resume-btn" onClick={onResume} title="Reanudar sesión activa">
            ▶
          </button>
        )}

        <button
          className="icon-btn"
          onClick={onFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? '⤢' : '⛶'}
        </button>

        <button
          className="icon-btn"
          onClick={onInstallPWA}
          disabled={!installPromptAvailable}
          title={installPromptAvailable ? 'Descargar como PWA' : 'PWA no disponible'}
        >
          📱
        </button>

        <div className={`status-dot ${connectionState === 'connected' ? 'ok' :
          connectionState === 'reconnecting' || connectionState === 'connecting' ? 'warn' : 'bad'
          }`} title={
            connectionState === 'connected' ? 'Conectado' :
              connectionState === 'connecting' ? 'Conectando...' :
                connectionState === 'reconnecting' ? 'Reconectando...' : 'Desconectado'
          }>
        </div>

        {token && currentUser && (
          <div className="user-menu-container">
            <button
              className="icon-btn user-btn"
              onClick={() => dispatch(setShowUserMenu(!showUserMenu))}
              title={currentUser.username}
            >
              👤
            </button>
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <span className="user-menu-username">{currentUser.username}</span>
                  {currentUser.isAdmin && <span className="user-menu-badge">Admin</span>}
                </div>
                <button
                  className="user-menu-item"
                  onClick={() => {
                    dispatch(setShowUserMenu(false));
                    // Will be handled by parent
                  }}
                >
                  🔑 Cambiar Contraseña
                </button>
                <button className="user-menu-item logout">
                  🚪 Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}

        {token && (
          <button
            className="settings-btn"
            onClick={() => dispatch(setShowSettings(true))}
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}
