import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  setCommandTab,
  clearHistory,
  addSnippet,
  removeSnippet,
  selectHistoryForWorker,
  selectSnippetsForWorker,
} from '../../../store';
import { Play, Star, X } from 'lucide-react';
import './CommandPanel.css';

interface CommandPanelProps {
  onExecuteCommand: (command: string) => void;
}

export function CommandPanel({ onExecuteCommand }: CommandPanelProps) {
  const dispatch = useAppDispatch();
  const commandTab = useAppSelector((state) => state.commands.commandTab);
  const activeSession = useAppSelector((state) => {
    const sessions = state.sessions.sessions;
    return sessions.find((s) => s.id === state.sessions.activeSessionId);
  });
  const offlineSessionIds = useAppSelector((state) => state.sessions.offlineSessionIds);

  const activeWorkerKey = activeSession?.workerKey || '';
  const activeWorkerName = activeSession?.workerName || '';
  const isOffline = activeSession ? offlineSessionIds.includes(activeSession.id) : false;

  const activeHistory = useAppSelector((state) =>
    activeWorkerKey ? selectHistoryForWorker(state, activeWorkerKey) : []
  );
  const activeSnippets = useAppSelector((state) =>
    activeWorkerKey ? selectSnippetsForWorker(state, activeWorkerKey) : []
  );

  const handleClearHistory = () => {
    if (activeWorkerKey) {
      dispatch(clearHistory(activeWorkerKey));
    }
  };

  const handleAddSnippet = (command?: string) => {
    if (!activeWorkerKey) return;
    const defaultCommand = command || '';
    const label = window.prompt('Nombre del snippet', defaultCommand.slice(0, 24) || 'Snippet');
    if (label === null) return;
    const cmd = command || window.prompt('Comando', defaultCommand);
    if (cmd === null) return;

    dispatch(addSnippet({
      workerKey: activeWorkerKey,
      snippet: {
        id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: label.trim(),
        command: cmd.trim(),
      },
    }));
  };

  const handleRemoveSnippet = (snippetId: string) => {
    if (activeWorkerKey) {
      dispatch(removeSnippet({ workerKey: activeWorkerKey, snippetId }));
    }
  };

  return (
    <div className="sidebar-section">
      <div className="section-title">Comandos</div>
      <div className="command-header">
        <span className="command-target">
          {activeWorkerName || 'Sin sesión activa'}
        </span>
        {isOffline && <span className="badge-offline">Offline</span>}
      </div>

      <div className="command-tabs">
        <button
          className={commandTab === 'history' ? 'active' : ''}
          onClick={() => dispatch(setCommandTab('history'))}
        >
          Historial
        </button>
        <button
          className={commandTab === 'snippets' ? 'active' : ''}
          onClick={() => dispatch(setCommandTab('snippets'))}
        >
          Snippets
        </button>
      </div>

      {!activeSession && (
        <div className="empty-sessions">
          Selecciona una sesión para ver comandos
        </div>
      )}

      {activeSession && commandTab === 'history' && (
        <>
          <div className="command-actions">
            <button
              className="mini-btn"
              onClick={handleClearHistory}
              disabled={!activeHistory.length}
            >
              Limpiar
            </button>
          </div>
          <div className="command-list">
            {activeHistory.length === 0 && (
              <div className="empty-sessions">Sin historial</div>
            )}
            {activeHistory.map((cmd, index) => (
              <div key={`${cmd}-${index}`} className="command-item">
                <button
                  className="command-run"
                  onClick={() => onExecuteCommand(cmd)}
                  disabled={isOffline}
                  title="Ejecutar"
                >
                  <Play />
                </button>
                <div className="command-text" title={cmd}>{cmd}</div>
                <button
                  className="command-star"
                  onClick={() => handleAddSnippet(cmd)}
                  disabled={isOffline}
                  title="Guardar como snippet"
                >
                  <Star />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {activeSession && commandTab === 'snippets' && (
        <>
          <div className="command-actions">
            <button
              className="mini-btn"
              onClick={() => handleAddSnippet()}
              disabled={isOffline}
            >
              Agregar
            </button>
          </div>
          <div className="command-list">
            {activeSnippets.length === 0 && (
              <div className="empty-sessions">Sin snippets</div>
            )}
            {activeSnippets.map((snippet) => (
              <div key={snippet.id} className="command-item">
                <button
                  className="command-run"
                  onClick={() => onExecuteCommand(snippet.command)}
                  disabled={isOffline}
                  title="Ejecutar"
                >
                  <Play />
                </button>
                <div className="command-text">
                  <div className="command-title">{snippet.label}</div>
                  <div className="command-subtext">{snippet.command}</div>
                </div>
                <button
                  className="command-remove"
                  onClick={() => handleRemoveSnippet(snippet.id)}
                  disabled={isOffline}
                  title="Eliminar"
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
