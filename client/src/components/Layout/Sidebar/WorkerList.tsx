import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  setWorkerQuery,
  setWorkerGrouping,
  selectFilteredWorkers,
  selectGroupedWorkers,
  setShareModalWorker,
  setEditingWorker,
  setShowWorkerModal,
  openDialog,
} from '../../../store';
import type { Worker } from '../../../store/slices/workersSlice';
import { Download, Link, Plus, Trash2 } from 'lucide-react';
import './WorkerList.css';

interface WorkerListProps {
  onSelectWorker: (workerId: string) => void;
  onNewSession: (workerId: string) => void;
  onDeleteWorker: (worker: Worker) => void;
}

export function WorkerList({ onSelectWorker, onNewSession, onDeleteWorker }: WorkerListProps) {
  const dispatch = useAppDispatch();
  const workerQuery = useAppSelector((state) => state.workers.workerQuery);
  const workerGrouping = useAppSelector((state) => state.workers.workerGrouping);
  const workerTags = useAppSelector((state) => state.workers.workerTags);
  const filteredWorkers = useAppSelector(selectFilteredWorkers);
  const groupedWorkers = useAppSelector(selectGroupedWorkers);

  const normalizeWorkerKey = (name: string) => name.trim().toLowerCase();

  const groupedWorkerEntries = Object.entries(groupedWorkers).sort(([a], [b]) => {
    if (a === 'Sin etiquetas') return 1;
    if (b === 'Sin etiquetas') return -1;
    return a.localeCompare(b);
  });

  const handleDeleteConfirm = (worker: Worker) => {
    dispatch(openDialog({
      title: 'Eliminar worker',
      message: `¿Seguro que deseas eliminar ${worker.name}? Esta acción no se puede deshacer.`,
      tone: 'danger',
      actions: [
        { label: 'Cancelar', variant: 'ghost' },
        { label: 'Eliminar', variant: 'danger', actionId: `delete-worker-${worker.id}` },
      ],
    }));
    onDeleteWorker(worker);
  };

  const handleInstallWorker = (worker: Worker) => {
    dispatch(setEditingWorker(worker));
    dispatch(setShowWorkerModal(true));
  };

  return (
    <div className="sidebar-section">
      <div className="section-title">Workers</div>
      <div className="worker-tools">
        <input
          className="worker-search"
          placeholder="Buscar por nombre o tag..."
          value={workerQuery}
          onChange={(e) => dispatch(setWorkerQuery(e.target.value))}
        />
        <select
          className="worker-grouping"
          value={workerGrouping}
          onChange={(e) => dispatch(setWorkerGrouping(e.target.value as 'none' | 'tag'))}
        >
          <option value="none">Sin agrupar</option>
          <option value="tag">Agrupar por tag</option>
        </select>
      </div>

      {filteredWorkers.length === 0 && (
        <div className="empty-sessions">No hay workers</div>
      )}

      {filteredWorkers.length > 0 && groupedWorkerEntries.map(([groupLabel, groupWorkers]) => (
        <div key={groupLabel} className="worker-group">
          {workerGrouping === 'tag' && <div className="worker-group-title">{groupLabel}</div>}
          {groupWorkers.map((worker: Worker) => {
            const workerKey = normalizeWorkerKey(worker.name);
            const tags = workerTags[workerKey] || [];
            return (
              <div
                key={worker.id}
                className={`worker-item ${worker.status === 'offline' ? 'offline' : ''}`}
                onClick={() => onSelectWorker(worker.id)}
              >
                <div className="worker-main">
                  <div className="worker-name">{worker.name}</div>
                  <div className="worker-meta">
                    <span className={`worker-status ${worker.status}`}>
                      {worker.status === 'offline' ? 'Offline' : 'Online'}
                    </span>
                  </div>
                </div>
                <div className="worker-tags">
                  {tags.length > 0
                    ? tags.map((tag) => (
                      <span key={`${worker.id}-${tag}`} className="tag-chip">
                        {tag}
                      </span>
                    ))
                    : <span className="tag-chip empty">Sin tags</span>}
                </div>
                <div className="worker-actions">
                  <button
                    className="delete-worker-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConfirm(worker);
                    }}
                    title="Eliminar worker"
                  >
                    <Trash2 />
                  </button>
                  <button
                    className="add-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewSession(worker.id);
                    }}
                    title="Nueva sesión en este worker"
                  >
                    <Plus />
                  </button>
                  <button
                    className="share-worker-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(setShareModalWorker(worker));
                    }}
                    title="Compartir worker"
                  >
                    <Link />
                  </button>
                  {worker.status === 'offline' && worker.api_key && (
                    <button
                      className="install-worker-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstallWorker(worker);
                      }}
                      title="Ver instrucciones de instalación"
                    >
                      <Download />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
