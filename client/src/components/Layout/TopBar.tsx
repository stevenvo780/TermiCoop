import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  logoutAndReset,
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
  const [sessionMenuPosition, setSessionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const sessionMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const sessionsStripRef = useRef<HTMLDivElement | null>(null);

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
    dispatch(logoutAndReset());
    dispatch(setShowUserMenu(false));
  };

  const handleSessionMenuToggle = (sessionId: string) => {
    setSessionMenuId((current) => {
      if (current === sessionId) {
        setSessionMenuPosition(null);
        return null;
      }
      return sessionId;
    });
  };

  const activeSessionMenu = useMemo(
    () => sessions.find((session) => session.id === sessionMenuId) || null,
    [sessions, sessionMenuId]
  );

  const updateSessionMenuPosition = useCallback(() => {
    const anchor = sessionMenuAnchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 200;
    const left = Math.min(rect.left, window.innerWidth - menuWidth - 8);
    setSessionMenuPosition({
      top: rect.bottom + 6,
      left: Math.max(8, left),
    });
  }, []);

  useLayoutEffect(() => {
    if (!sessionMenuId) return;
    updateSessionMenuPosition();
    const handleWindow = () => updateSessionMenuPosition();
    const strip = sessionsStripRef.current;
    window.addEventListener('resize', handleWindow);
    window.addEventListener('scroll', handleWindow, true);
    strip?.addEventListener('scroll', handleWindow);
    return () => {
      window.removeEventListener('resize', handleWindow);
      window.removeEventListener('scroll', handleWindow, true);
      strip?.removeEventListener('scroll', handleWindow);
    };
  }, [sessionMenuId, updateSessionMenuPosition]);

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

      <div className="topbar-sessions" ref={sessionsStripRef}>
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
              onClick={() => {
                dispatch(setActiveSession(session.id));
                setSessionMenuId(null);
              }}
              type="button"
              title={session.displayName}
            >
              <span className="session-chip-name">{session.displayName}</span>
            </button>
            <button
              className="session-chip-menu-btn"
              onClick={(event) => {
                event.stopPropagation();
                sessionMenuAnchorRef.current = event.currentTarget;
                handleSessionMenuToggle(session.id);
              }}
              title="Opciones"
              type="button"
            >
              <MoreHorizontal />
            </button>
          </div>
        ))}
      </div>

      {activeSessionMenu && sessionMenuPosition && (
        <div
          className="session-chip-menu floating"
          style={{ top: `${sessionMenuPosition.top}px`, left: `${sessionMenuPosition.left}px` }}
        >
          <button
            className="session-chip-menu-item"
            onClick={() => {
              dispatch(setRenamingSessionId(activeSessionMenu.id));
              setSessionMenuId(null);
            }}
            type="button"
          >
            Renombrar
          </button>
          <button
            className="session-chip-menu-item"
            onClick={() => handleSendToGrid(activeSessionMenu.id)}
            type="button"
          >
            Enviar al grid
          </button>
          <button
            className="session-chip-menu-item danger"
            onClick={() => {
              onCloseSession(activeSessionMenu.id);
              setSessionMenuId(null);
            }}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      )}

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
