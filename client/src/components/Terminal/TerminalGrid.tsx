import { useRef, useEffect, useMemo, useState } from 'react';
import type { DragEvent, RefObject } from 'react';
import ReactGridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import { ArrowDownToLine, Columns2, Grid2x2, Hexagon, Plus, Square } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setLayoutMode,
  assignGridSlot,
  clearGrid,
  setShowDropOverlay,
  setDraggingSessionId,
} from '../../store';
import type { TerminalInstance } from '../../App'; // We'll need to export this interface from App
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './TerminalGrid.css';

const GridLayout = WidthProvider(ReactGridLayout);

interface TerminalGridProps {
  instancesRef: RefObject<Map<string, TerminalInstance>>;
  containerRef?: RefObject<HTMLDivElement | null>;
  instancesVersion: number;
}

// Component helper to reparent the terminal DOM element
function TerminalSlot({
  instance,
  className,
  isActive,
  onDrop,
}: {
  instance: TerminalInstance;
  className?: string;
  isActive?: boolean;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (instance && wrapperRef.current) {
      const container = instance.containerRef;
      const wrapper = wrapperRef.current;
      // Move the terminal container into this slot
      wrapper.appendChild(container);
      const attached = wrapper.firstElementChild as HTMLDivElement | null;
      if (attached) {
        attached.style.display = 'flex';
        attached.style.width = '100%';
        attached.style.height = '100%';
        // Reset any manual styles that might interfere
        attached.style.order = '';
      }

      // Request fit
      requestAnimationFrame(() => {
        instance.fitAddon.fit();
      });
    }
  }, [instance]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const attached = wrapper?.firstElementChild as HTMLDivElement | null;
    if (!attached) return;
    attached.classList.toggle('active-slot', Boolean(isActive));
  }, [instance, isActive]);

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

export function TerminalGrid({ instancesRef, containerRef, instancesVersion }: TerminalGridProps) {
  const dispatch = useAppDispatch();
  const layoutMode = useAppSelector((state) => state.sessions.layoutMode);
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const gridSessionIds = useAppSelector((state) => state.sessions.gridSessionIds);
  const activeSessionId = useAppSelector((state) => state.sessions.activeSessionId);
  const draggingSessionId = useAppSelector((state) => state.sessions.draggingSessionId);
  const showDropOverlay = useAppSelector((state) => state.ui.showDropOverlay);
  const token = useAppSelector((state) => state.auth.token);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(0);
  const [instancesSnapshot, setInstancesSnapshot] = useState<Map<string, TerminalInstance>>(new Map());

  useEffect(() => {
    if (layoutMode === 'single') return;
    const node = gridAreaRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setGridHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [layoutMode]);

  useEffect(() => {
    setInstancesSnapshot(new Map(instancesRef.current));
  }, [instancesRef, sessions, gridSessionIds, activeSessionId, layoutMode, instancesVersion]);

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

  const gridSlots = useMemo(() => (
    layoutMode === 'split-vertical' ? [0, 1] : [0, 1, 2, 3]
  ), [layoutMode]);
  const gridRows = layoutMode === 'split-vertical' ? 1 : 2;
  const gridMargin: [number, number] = [8, 8];
  const rowHeight = gridHeight > 0
    ? Math.max(1, Math.floor((gridHeight - gridMargin[1] * (gridRows - 1)) / gridRows))
    : 200;

  const layout = useMemo(() => gridSlots.map((slotIndex, positionIndex) => ({
    i: slotIndex.toString(),
    x: positionIndex % 2,
    y: Math.floor(positionIndex / 2),
    w: 1,
    h: 1,
    static: true,
  })), [gridSlots]);

  // Render logic
  const renderContent = () => {
    // Single Mode
    if (layoutMode === 'single') {
      const activeInstance = activeSessionId ? instancesSnapshot.get(activeSessionId) : undefined;

      if (!activeInstance && sessions.length > 0 && token) {
        // Should act as empty state or select last active?
        // For now let's show empty state if no active session selected but sessions exist
      }

      if (sessions.length === 0 && token) {
        return (
          <div className="empty-state">
            <div className="empty-icon">
              <Hexagon />
            </div>
            <h2>No hay sesiones activas</h2>
            <p>Crea una nueva sesión desde el selector superior o el sidebar</p>
          </div>
        );
      }

      return activeInstance ? (
        <TerminalSlot instance={activeInstance} isActive />
      ) : null;
    }

    // Grid Modes
    return (
      <div className="terminal-grid-area" ref={gridAreaRef}>
        <GridLayout
          className="terminal-grid-layout"
          layout={layout}
          cols={2}
          rowHeight={rowHeight}
          margin={gridMargin}
          containerPadding={[0, 0]}
          isResizable={false}
          isDraggable={false}
          autoSize={false}
          compactType={null}
          preventCollision
        >
          {gridSlots.map((slotIndex) => {
            const sessionId = gridSessionIds[slotIndex];
            const instance = sessionId ? instancesSnapshot.get(sessionId) : undefined;

            if (instance) {
              return (
                <div key={slotIndex.toString()} className="grid-cell">
                  <TerminalSlot
                    instance={instance}
                    isActive={sessionId === activeSessionId}
                    onDrop={handleDropOnSlot(slotIndex)}
                  />
                </div>
              );
            }

            return (
              <div
                key={slotIndex.toString()}
                className={`empty-slot-target ${draggingSessionId ? 'droppable' : ''}`}
                onDrop={handleDropOnSlot(slotIndex)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              >
                <div className="slot-icon">
                  {draggingSessionId ? <ArrowDownToLine /> : <Plus />}
                </div>
                <span>{draggingSessionId ? 'Soltar aquí' : 'Vacío'}</span>
              </div>
            );
          })}
        </GridLayout>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`terminal-container layout-${layoutMode} ${layoutMode !== 'single' ? 'grid-layout' : ''}`}
    >
      <div className="terminal-toolbar">
        <div className="layout-toggle">
          <button
            className={`layout-icon-btn ${layoutMode === 'single' ? 'active' : ''}`}
            onClick={() => dispatch(setLayoutMode('single'))}
            title="Vista única"
          >
            <Square />
          </button>
          <button
            className={`layout-icon-btn ${layoutMode === 'split-vertical' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('split-vertical')}
            title="Vista Dividida"
          >
            <Columns2 />
          </button>
          <button
            className={`layout-icon-btn ${layoutMode === 'quad' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('quad')}
            title="Vista Cuádruple"
          >
            <Grid2x2 />
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
