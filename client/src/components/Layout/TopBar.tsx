import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuth,
  setShowChangePasswordModal,
  setShowSettings,
  setShowUserMenu,
  setShowWorkerModal,
  setEditingWorker,
} from '../../store';
import {
  Download,
  KeyRound,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  Settings,
  Smartphone,
  User,
  Hexagon,
} from 'lucide-react';
import './TopBar.css';

interface TopBarProps {
  onResume: () => void;
  onFullscreen: () => void;
  onInstallPWA: () => void;
  installPromptAvailable: boolean;
}

export function TopBar({
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
  const showSettingsMenu = useAppSelector((state) => state.ui.showSettings);

  const handleToggleUserMenu = () => {
    dispatch(setShowUserMenu(!showUserMenu));
    if (!showUserMenu) {
      dispatch(setShowSettings(false));
    }
  };

  const handleToggleSettingsMenu = () => {
    dispatch(setShowSettings(!showSettingsMenu));
    if (!showSettingsMenu) {
      dispatch(setShowUserMenu(false));
    }
  };

  const handleInstallWorker = () => {
    dispatch(setEditingWorker(null));
    dispatch(setShowWorkerModal(true));
    dispatch(setShowSettings(false));
  };

  const handleFullscreenToggle = () => {
    onFullscreen();
    dispatch(setShowSettings(false));
  };

  const handleInstallPWA = () => {
    if (!installPromptAvailable) return;
    onInstallPWA();
    dispatch(setShowSettings(false));
  };

  const handleChangePassword = () => {
    dispatch(setShowChangePasswordModal(true));
    dispatch(setShowUserMenu(false));
  };

  const handleLogout = () => {
    dispatch(clearAuth());
    dispatch(setShowUserMenu(false));
  };

  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-icon">
          <Hexagon />
        </span>
      </div>

      <div className="topbar-stats">
        <span>{sessions.length} sesion{sessions.length !== 1 ? 'es' : ''}</span>
        <span>•</span>
        <span>{workers.length} worker{workers.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="topbar-right">
        {activeSessionId && (
          <button className="icon-btn resume-btn" onClick={onResume} title="Reanudar sesión activa">
            <Play />
          </button>
        )}

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
              onClick={handleToggleUserMenu}
              title={currentUser.username}
            >
              <User />
            </button>
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <div className="user-menu-header">
                  <span className="user-menu-username">{currentUser.username}</span>
                  {currentUser.isAdmin && <span className="user-menu-badge">Admin</span>}
                </div>
                <button
                  className="user-menu-item"
                  onClick={handleChangePassword}
                >
                  <KeyRound className="menu-icon" />
                  <span>Cambiar Contraseña</span>
                </button>
                <button className="user-menu-item logout" onClick={handleLogout}>
                  <LogOut className="menu-icon" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        )}

        {token && (
          <div className="settings-menu-container">
            <button
              className={`icon-btn settings-btn ${showSettingsMenu ? 'active' : ''}`}
              onClick={handleToggleSettingsMenu}
              title="Configuración"
            >
              <Settings />
            </button>
            {showSettingsMenu && (
              <div className="user-menu-dropdown settings-menu-dropdown">
                <button className="user-menu-item" onClick={handleInstallWorker}>
                  <Download className="menu-icon" />
                  <span>Instalar worker</span>
                </button>
                <button className="user-menu-item" onClick={handleFullscreenToggle}>
                  {isFullscreen ? <Minimize2 className="menu-icon" /> : <Maximize2 className="menu-icon" />}
                  <span>{isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</span>
                </button>
                <button
                  className="user-menu-item"
                  onClick={handleInstallPWA}
                  disabled={!installPromptAvailable}
                >
                  <Smartphone className="menu-icon" />
                  <span>{installPromptAvailable ? 'Instalar PWA' : 'PWA no disponible'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
