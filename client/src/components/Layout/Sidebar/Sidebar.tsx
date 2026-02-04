import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { toggleSidebar } from '../../../store';
import { SessionList } from './SessionList';
import { WorkerList } from './WorkerList';
import { CommandPanel } from './CommandPanel';
import type { DragEvent } from 'react';
import type { Worker } from '../../../store/slices/workersSlice';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onCloseSession: (sessionId: string) => void;
  onSelectWorker: (workerId: string) => void;
  onNewSession: (workerId: string) => void;
  onDeleteWorker: (worker: Worker) => void;
  onExecuteCommand: (command: string) => void;
  onDragStart: (sessionId: string, displayName: string, event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

export function Sidebar({
  onCloseSession,
  onSelectWorker,
  onNewSession,
  onDeleteWorker,
  onExecuteCommand,
  onDragStart,
  onDragEnd,
}: SidebarProps) {
  const dispatch = useAppDispatch();
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h3>Sesiones</h3>
        <button
          className="collapse-btn"
          onClick={() => dispatch(toggleSidebar())}
          title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="sidebar-content">
          <SessionList
            onCloseSession={onCloseSession}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />

          <div className="sidebar-divider" />

          <WorkerList
            onSelectWorker={onSelectWorker}
            onNewSession={onNewSession}
            onDeleteWorker={onDeleteWorker}
          />

          <div className="sidebar-divider" />

          <CommandPanel onExecuteCommand={onExecuteCommand} />
        </div>
      )}
    </div>
  );
}
