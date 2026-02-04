import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { toggleSidebar } from '../../../store';
import { WorkerList } from './WorkerList';
import type { Worker } from '../../../store/slices/workersSlice';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onSelectWorker: (workerId: string) => void;
  onNewSession: (workerId: string) => void;
  onDeleteWorker: (worker: Worker) => void;
}

export function Sidebar({
  onSelectWorker,
  onNewSession,
  onDeleteWorker,
}: SidebarProps) {
  const dispatch = useAppDispatch();
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h3>Workers</h3>
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
          <WorkerList
            onSelectWorker={onSelectWorker}
            onNewSession={onNewSession}
            onDeleteWorker={onDeleteWorker}
          />
        </div>
      )}
    </div>
  );
}
