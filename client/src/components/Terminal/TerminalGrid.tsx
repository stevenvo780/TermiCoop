import { useRef, useEffect } from 'react';
import type { DragEvent, RefObject } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setLayoutMode,
  assignGridSlot,
  clearGrid,
  setShowDropOverlay,
  setDraggingSessionId,
} from '../../store';
import type { TerminalInstance } from '../../App'; // We'll need to export this interface from App
import './TerminalGrid.css';

interface TerminalGridProps {
  instancesRef: RefObject<Map<string, TerminalInstance>>;
}

// Component helper to reparent the terminal DOM element
function TerminalSlot({ instance, className, onDrop }: { instance: TerminalInstance, className?: string, onDrop?: (e: DragEvent<HTMLDivElement>) => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (instance && wrapperRef.current) {
      const container = instance.containerRef;
      // Move the terminal container into this slot
      wrapperRef.current.appendChild(container);
      /* eslint-disable react-compiler/react-compiler */
      container.style.display = 'flex';
      container.style.width = '100%';
      container.style.height = '100%';
      // Reset any manual styles that might interfere
      container.style.order = '';
      container.classList.remove('active-slot');
      /* eslint-enable react-compiler/react-compiler */

      // Request fit
      requestAnimationFrame(() => {
        instance.fitAddon.fit();
      });
    }
  }, [instance]);

  return (
    <div
      ref={wrapperRef}
      className={`terminal-slot-wrapper ${className || ''}`}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}

export function TerminalGrid({ instancesRef }: TerminalGridProps) {
  const dispatch = useAppDispatch();
  const layoutMode = useAppSelector((state) => state.sessions.layoutMode);
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

  // Render logic
  const renderContent = () => {
    // Single Mode
    if (layoutMode === 'single') {
      const activeInstance = activeSessionId && instancesRef.current ? instancesRef.current.get(activeSessionId) : undefined;

      if (!activeInstance && sessions.length > 0 && token) {
        // Should act as empty state or select last active?
        // For now let's show empty state if no active session selected but sessions exist
      }

      if (sessions.length === 0 && token) {
        return (
          <div className="empty-state">
            <div className="empty-icon">⬡</div>
            <h2>No hay sesiones activas</h2>
            <p>Crea una nueva sesión desde el selector superior o el sidebar</p>
          </div>
        );
      }

      return activeInstance ? (
        <TerminalSlot instance={activeInstance} className="active-slot" />
      ) : null;
    }

    // Grid Modes
    const slots = layoutMode === 'split-vertical' ? [0, 1] : [0, 1, 2, 3];
    return slots.map(idx => {
      const sessionId = gridSessionIds[idx];
      const instance = sessionId && instancesRef.current ? instancesRef.current.get(sessionId) : undefined;

      if (instance) {
        // Render Terminal
        return (
          <div key={`slot-${idx}`} className="grid-cell" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <TerminalSlot
              instance={instance}
              className={sessionId === activeSessionId ? 'active-slot' : ''}
              onDrop={handleDropOnSlot(idx)}
            />
          </div>
        );
      } else {
        // Render Placeholder
        return (
          <div
            key={`placeholder-${idx}`}
            className={`empty-slot-target ${draggingSessionId ? 'droppable' : ''}`}
            onDrop={handleDropOnSlot(idx)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          >
            <div className="slot-icon">
              {draggingSessionId ? '⤓' : '+'}
            </div>
            <span>{draggingSessionId ? 'Soltar aquí' : 'Vacío'}</span>
          </div>
        );
      }
    });
  };

  return (
    <div
      className={`terminal-container layout-${layoutMode} ${layoutMode !== 'single' ? 'grid-layout' : ''}`}
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

      {/* eslint-disable-next-line react-compiler/react-compiler */}
      {renderContent()}

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
