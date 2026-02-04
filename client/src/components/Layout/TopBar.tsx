import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  clearAuth,
  assignGridSlot,
  setShowChangePasswordModal,
  setShowSettings,
  setShowUserMenu,
  setActiveSession,
  setLayoutMode,
  setRenamingSessionId,
  setShowWorkerModal,
  setEditingWorker,
} from '../../store';
import {
  Download,
  KeyRound,
  LogOut,
  Maximize2,
  Minimize2,
  MoreHorizontal,
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
  onCloseSession: (sessionId: string) => void;
  onDragStart: (sessionId: string, displayName: string, event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function TopBar({
  onResume,
  onFullscreen,
  onInstallPWA,
  installPromptAvailable,
  onCloseSession,
  onDragStart,
  onDragEnd,
}: TopBarProps) {
  const dispatch = useAppDispatch();
  const workers = useAppSelector((state) => state.workers.workers);
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const activeSessionId = useAppSelector((state) => state.sessions.activeSessionId);
  const gridSessionIds = useAppSelector((state) => state.sessions.gridSessionIds);
  const layoutMode = useAppSelector((state) => state.sessions.layoutMode);
  const connectionState = useAppSelector((state) => state.connection.connectionState);
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const token = useAppSelector((state) => state.auth.token);
  const showUserMenu = useAppSelector((state) => state.ui.showUserMenu);
  const isFullscreen = useAppSelector((state) => state.ui.isFullscreen);
  const showSettingsMenu = useAppSelector((state) => state.ui.showSettings);
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null);

  const handleToggleUserMenu = () => {
    dispatch(setShowUserMenu(!showUserMenu));
    if (!showUserMenu) {
      dispatch(setShowSettings(false));
      setSessionMenuId(null);
    }
  };

  const handleToggleSettingsMenu = () => {
    dispatch(setShowSettings(!showSettingsMenu));
    if (!showSettingsMenu) {
      dispatch(setShowUserMenu(false));
      setSessionMenuId(null);
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

  const handleSessionMenuToggle = (sessionId: string) => {
    setSessionMenuId((current) => (current === sessionId ? null : sessionId));
  };

  const handleSendToGrid = (sessionId: string) => {
    const nextSlots = gridSessionIds.slice(0, 4);
    while (nextSlots.length < 4) {
      nextSlots.push('');
    }
    const emptyIdx = nextSlots.findIndex((id) => !id);
    const slotIndex = emptyIdx >= 0 ? emptyIdx : 0;

    if (layoutMode === 'single') {
      dispatch(setLayoutMode('quad'));
    }
    dispatch(assignGridSlot({ slotIndex, sessionId }));
    setSessionMenuId(null);
  };

  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-icon">
          <Hexagon />
        </span>
      </div>

      <div className="topbar-sessions">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-chip ${activeSessionId === session.id ? 'active' : ''}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', session.id);
              event.dataTransfer.setData('application/x-session-name', session.displayName);
              event.dataTransfer.effectAllowed = 'move';
              onDragStart(session.id, session.displayName, event);
            }}
            onDragEnd={onDragEnd}
          >
            <button
              className="session-chip-main"
              onClick={() => dispatch(setActiveSession(session.id))}
              type="button"
              title={session.displayName}
            >
              <span className="session-chip-name">{session.displayName}</span>
            </button>
            <button
              className="session-chip-menu-btn"
              onClick={(event) => {
                event.stopPropagation();
                handleSessionMenuToggle(session.id);
              }}
              title="Opciones"
              type="button"
            >
              <MoreHorizontal />
            </button>
            {sessionMenuId === session.id && (
              <div className="session-chip-menu">
                <button
                  className="session-chip-menu-item"
                  onClick={() => {
                    dispatch(setRenamingSessionId(session.id));
                    setSessionMenuId(null);
                  }}
                  type="button"
                >
                  Renombrar
                </button>
                <button
                  className="session-chip-menu-item"
                  onClick={() => handleSendToGrid(session.id)}
                  type="button"
                >
                  Enviar al grid
                </button>
                <button
                  className="session-chip-menu-item danger"
                  onClick={() => {
                    onCloseSession(session.id);
                    setSessionMenuId(null);
                  }}
                  type="button"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ))}
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
