import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setLayoutMode,
  assignGridSlot,
  clearGrid,
  setShowDropOverlay,
  setDraggingSessionId,
} from '../../store';
import type { DragEvent, RefObject } from 'react';
import './TerminalGrid.css';

interface TerminalGridProps {
  containerRef: RefObject<HTMLDivElement>;
}

export function TerminalGrid({ containerRef }: TerminalGridProps) {
  const dispatch = useAppDispatch();
  const layoutMode = useAppSelector((state) => state.ui.layoutMode);
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const gridSessionIds = useAppSelector((state) => state.sessions.gridSessionIds);
  const activeSessionId = useAppSelector((state) => state.sessions.activeSessionId);
  const draggingSessionId = useAppSelector((state) => state.sessions.draggingSessionId);
  const showDropOverlay = useAppSelector((state) => state.ui.showDropOverlay);
  const token = useAppSelector((state) => state.auth.token);

  const handleLayoutChange = (mode: 'single' | 'split-vertical' | 'quad') => {
    if (layoutMode === 'single' && activeSessionId && !gridSessionIds[0]) {
      dispatch(assignGridSlot({ slotIndex: 0, sessionId: activeSessionId }));
    }
    dispatch(setLayoutMode(mode));
  };

  const handleDropOnSlot = (slotIndex: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const sessionId = event.dataTransfer.getData('text/plain');
    if (sessionId) {
      dispatch(assignGridSlot({ slotIndex, sessionId }));
    }
    dispatch(setDraggingSessionId(null));
    dispatch(setShowDropOverlay(false));
  };

  const handleDragOverSlot = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnHotspot = (hotspotIndex: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sessionId = event.dataTransfer.getData('text/plain');
    if (sessionId) {
      dispatch(assignGridSlot({ slotIndex: hotspotIndex, sessionId }));
      if (layoutMode === 'single') {
        if (hotspotIndex === 1) dispatch(setLayoutMode('split-vertical'));
        else if (hotspotIndex > 1) dispatch(setLayoutMode('quad'));
      }
    }
    dispatch(setDraggingSessionId(null));
    dispatch(setShowDropOverlay(false));
  };

  const handleDragOverHotspot = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDragEnd = () => {
    dispatch(setDraggingSessionId(null));
    dispatch(setShowDropOverlay(false));
  };

  return (
    <div
      className={`terminal-container layout-${layoutMode} ${layoutMode !== 'single' ? 'grid-layout' : ''}`}
      ref={containerRef}
    >
      <div className="terminal-toolbar">
        <div className="layout-toggle">
          <button
            className={`layout-icon-btn ${layoutMode === 'single' ? 'active' : ''}`}
            onClick={() => dispatch(setLayoutMode('single'))}
            title="Vista única"
          >
            <svg viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none" strokeWidth="2" />
            </svg>
          </button>
          <button
            className={`layout-icon-btn ${layoutMode === 'split-vertical' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('split-vertical')}
            title="Vista Dividida"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 4h16v16H4z M12 4v16" stroke="currentColor" fill="none" strokeWidth="2" />
            </svg>
          </button>
          <button
            className={`layout-icon-btn ${layoutMode === 'quad' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('quad')}
            title="Vista Cuádruple"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 4h16v16H4z M12 4v16M4 12h16" stroke="currentColor" fill="none" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {layoutMode !== 'single' && <div style={{ flex: 1 }} />}

        {layoutMode !== 'single' && (
          <button
            className="ghost-btn"
            onClick={() => dispatch(clearGrid())}
            title="Limpiar grid"
            style={{ fontSize: '0.8em', padding: '4px 12px' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Empty slot placeholders for grid layout */}
      {layoutMode !== 'single' && (
        <>
          {(layoutMode === 'split-vertical' ? [0, 1] : [0, 1, 2, 3]).map((idx) => {
            if (gridSessionIds[idx]) return null;
            return (
              <div
                key={`placeholder-${idx}`}
                className={`empty-slot-target ${draggingSessionId ? 'droppable' : ''}`}
                style={{ order: idx }}
                onDrop={handleDropOnSlot(idx)}
                onDragOver={handleDragOverSlot}
              >
                <div className="slot-icon">
                  {draggingSessionId ? '⤓' : '+'}
                </div>
                <span>{draggingSessionId ? 'Soltar aquí' : 'Vacío'}</span>
              </div>
            );
          })}
        </>
      )}

      {/* Empty state when no sessions */}
      {sessions.length === 0 && token && (
        <div className="empty-state">
          <div className="empty-icon">⬡</div>
          <h2>No hay sesiones activas</h2>
          <p>Crea una nueva sesión desde el selector superior o el sidebar</p>
        </div>
      )}

      {/* Drop overlay for single layout */}
      {showDropOverlay && layoutMode === 'single' && (
        <div className="drop-overlay" onDragOver={handleDragOverHotspot} onDrop={handleDragEnd}>
          {['Izquierda', 'Derecha', 'Abajo', 'Arriba'].map((label, idx) => (
            <div
              key={`hotspot-${idx}`}
              className={`drop-zone drop-${idx}`}
              onDrop={handleDropOnHotspot(idx)}
              onDragOver={handleDragOverHotspot}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
