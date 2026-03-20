import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { toggleSidebar, setEditingWorker, setShowWorkerModal, setShowMobileSidebar } from '../../../store';
import { WorkerList } from './WorkerList';
import { ChevronLeft, ChevronRight, Link2, Plus, X } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onSelectWorker: (workerId: string) => void;
  onNewSession: (workerId: string) => void;
  onJoinWorker: () => void;
}

export function Sidebar({
  onSelectWorker,
  onNewSession,
  onJoinWorker,
}: SidebarProps) {
  const dispatch = useAppDispatch();
  const sidebarCollapsed = useAppSelector((state) => state.ui.sidebarCollapsed);
  const showMobileSidebar = useAppSelector((state) => state.ui.showMobileSidebar);
  const handleCreateWorker = () => {
    dispatch(setEditingWorker(null));
    dispatch(setShowWorkerModal(true));
  };

  const handleCloseMobile = () => {
    dispatch(setShowMobileSidebar(false));
  };

  const handleNewSessionMobile = (workerId: string) => {
    onNewSession(workerId);
    dispatch(setShowMobileSidebar(false));
  };

  const handleSelectWorkerMobile = (workerId: string) => {
    onSelectWorker(workerId);
    dispatch(setShowMobileSidebar(false));
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className={`sidebar sidebar-desktop ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h3>Workers</h3>
          <div className="sidebar-header-actions">
            {!sidebarCollapsed && (
              <button
                className="worker-join-btn"
                onClick={onJoinWorker}
                title="Unirse por código"
                type="button"
              >
                <Link2 />
              </button>
            )}
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

      {/* Mobile drawer overlay */}
      {showMobileSidebar && (
        <div className="mobile-sidebar-backdrop" onClick={handleCloseMobile} />
      )}
      <div className={`mobile-sidebar-drawer ${showMobileSidebar ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <h3>Workers</h3>
          <div className="mobile-sidebar-header-actions">
            <button
              className="worker-join-btn"
              onClick={() => { onJoinWorker(); handleCloseMobile(); }}
              title="Unirse por código"
              type="button"
            >
              <Link2 />
            </button>
            <button
              className="worker-create-btn"
              onClick={() => { handleCreateWorker(); handleCloseMobile(); }}
              title="Crear worker"
              type="button"
            >
              <Plus />
            </button>
            <button
              className="mobile-sidebar-close"
              onClick={handleCloseMobile}
              title="Cerrar"
              type="button"
            >
              <X />
            </button>
          </div>
        </div>
        <div className="mobile-sidebar-content">
          <WorkerList
            onSelectWorker={handleSelectWorkerMobile}
            onNewSession={handleNewSessionMobile}
          />
        </div>
      </div>
    </>
  );
}
