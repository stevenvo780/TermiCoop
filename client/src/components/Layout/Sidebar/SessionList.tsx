import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  setActiveSession,
  setRenamingSessionId,
  assignGridSlot,
  setLayoutMode,
} from '../../../store';
import type { DragEvent } from 'react';
import './SessionList.css';

interface SessionListProps {
  onCloseSession: (sessionId: string) => void;
  onDragStart: (sessionId: string, displayName: string, event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function SessionList({ onCloseSession, onDragStart, onDragEnd }: SessionListProps) {
  const dispatch = useAppDispatch();
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const activeSessionId = useAppSelector((state) => state.sessions.activeSessionId);
  const offlineSessionIds = useAppSelector((state) => state.sessions.offlineSessionIds);
  const gridSessionIds = useAppSelector((state) => state.sessions.gridSessionIds);
  const layoutMode = useAppSelector((state) => state.sessions.layoutMode);

  const handleSwitchSession = (sessionId: string) => {
    dispatch(setActiveSession(sessionId));
  };

  const handlePinToGrid = (sessionId: string) => {
    // Find first empty slot
    const emptyIdx = gridSessionIds.findIndex((id) => !id);
    const slotIndex = emptyIdx >= 0 ? emptyIdx : 0;

    if (layoutMode === 'single') {
      dispatch(setLayoutMode('quad'));
    }
    dispatch(assignGridSlot({ slotIndex, sessionId }));
  };

  const handleRename = (sessionId: string) => {
    dispatch(setRenamingSessionId(sessionId));
  };

  const handleDragStart = (sessionId: string, displayName: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', sessionId);
    event.dataTransfer.setData('application/x-session-name', displayName);
    event.dataTransfer.effectAllowed = 'move';
    onDragStart(sessionId, displayName, event);
  };

  return (
    <div className="sidebar-section">
      <div className="section-title">Sesiones</div>
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`session-item ${activeSessionId === session.id ? 'active' : ''} ${offlineSessionIds.includes(session.id) ? 'offline' : ''}`}
          onClick={() => handleSwitchSession(session.id)}
          draggable
          onDragStart={handleDragStart(session.id, session.displayName)}
          onDragEnd={onDragEnd}
        >
          <div className="session-info">
            <div className="session-name">{session.displayName}</div>
            {offlineSessionIds.includes(session.id) && (
              <span className="badge-offline">Offline</span>
            )}
            <div className="session-id">{session.id.substring(0, 12)}...</div>
          </div>
          <button
            className="rename-session-btn"
            onClick={(e) => {
              e.stopPropagation();
              handlePinToGrid(session.id);
            }}
            title="Enviar al grid"
          >
            ⬒
          </button>
          <button
            className="rename-session-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleRename(session.id);
            }}
            title="Renombrar sesión"
          >
            ✎
          </button>
          <button
            className="close-session-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCloseSession(session.id);
            }}
            title="Cerrar sesión"
          >
            ✕
          </button>
        </div>
      ))}
      {sessions.length === 0 && (
        <div className="empty-sessions">No hay sesiones activas</div>
      )}
    </div>
  );
}
