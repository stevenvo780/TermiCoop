import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { toggleSidebar, setEditingWorker, setShowWorkerModal } from '../../../store';
import { WorkerList } from './WorkerList';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onSelectWorker: (workerId: string) => void;
  onNewSession: (workerId: string) => void;
}

export function Sidebar({
  onSelectWorker,
  onNewSession,
}: SidebarProps) {
  const dispatch = useAppDispatch();
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);
  const handleCreateWorker = () => {
    dispatch(setEditingWorker(null));
    dispatch(setShowWorkerModal(true));
  };

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h3>Workers</h3>
        <div className="sidebar-header-actions">
          {!sidebarCollapsed && (
            <button
              className="worker-create-btn"
              onClick={handleCreateWorker}
              title="Crear worker"
              type="button"
            >
              <Plus />
            </button>
          )}
          <button
            className="collapse-btn"
            onClick={() => dispatch(toggleSidebar())}
            title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
            type="button"
          >
            {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
      </div>

      {!sidebarCollapsed && (
        <div className="sidebar-content">
          <WorkerList
            onSelectWorker={onSelectWorker}
            onNewSession={onNewSession}
          />
        </div>
      )}
    </div>
  );
}
