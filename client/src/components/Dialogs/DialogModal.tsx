import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { closeDialog, setDialogLoading } from '../../store';
import type { DialogAction } from '../../store/slices/uiSlice';
import { X } from 'lucide-react';
import './DialogModal.css';

interface DialogModalProps {
  onAction?: (actionId: string) => void | Promise<void>;
}

export function DialogModal({ onAction }: DialogModalProps) {
  const dispatch = useAppDispatch();
  const dialog = useAppSelector((state) => state.ui.dialog);
  const dialogLoading = useAppSelector((state) => state.ui.dialogLoading);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!dialog) return;
    const timer = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(timer);
  }, [dialog]);

  if (!dialog) return null;

  const toneClass = dialog.tone === 'danger' ? 'danger' : 'info';
  const actions: DialogAction[] = dialog.actions && dialog.actions.length > 0
    ? dialog.actions
    : [{ label: 'Cerrar', variant: 'primary' }];

  const handleClose = () => {
    if (dialogLoading || !ready) return;
    dispatch(closeDialog());
  };

  const handleAction = async (action: DialogAction) => {
    if (dialogLoading || !ready) return;

    if (action.actionId && onAction) {
      dispatch(setDialogLoading(true));
      try {
        await onAction(action.actionId);
      } finally {
        dispatch(setDialogLoading(false));
      }
    } else {
      dispatch(closeDialog());
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className={`dialog-modal ${toneClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{dialog.title}</h3>
          <button
            className="dialog-close-btn"
            onClick={handleClose}
            aria-label="Cerrar"
            disabled={dialogLoading}
          >
            <X />
          </button>
        </div>
        <div className="dialog-body">
          <p className="dialog-message">{dialog.message}</p>
        </div>
        <div className="dialog-actions">
          {actions.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              className={`dialog-btn ${action.variant || 'primary'}`}
              onClick={() => handleAction(action)}
              disabled={dialogLoading || !ready}
            >
              {dialogLoading && action.variant === 'danger' ? 'Procesando...' : action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
