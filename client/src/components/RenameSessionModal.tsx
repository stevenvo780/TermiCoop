import React, { useState, useEffect, useRef } from 'react';

interface RenameSessionModalProps {
  initialName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export const RenameSessionModal: React.FC<RenameSessionModalProps> = ({
  initialName,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tag-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Renombrar Sesión</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-label">
            <label htmlFor="session-name">Nuevo nombre:</label>
            <input
              id="session-name"
              ref={inputRef}
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la sesión"
              autoComplete="off"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="dialog-btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="dialog-btn">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
