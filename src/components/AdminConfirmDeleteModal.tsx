import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface AdminConfirmDeleteModalProps {
  title: string;
  entityRef: string;
  description: string;
  warningNote?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export const AdminConfirmDeleteModal: React.FC<AdminConfirmDeleteModalProps> = ({
  title,
  entityRef,
  description,
  warningNote,
  confirmLabel = 'Supprimer définitivement',
  onConfirm,
  onClose,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    setErrorMsg(null);
    try {
      setIsDeleting(true);
      await onConfirm();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs font-mono font-bold text-rose-700 mt-0.5">{entityRef}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>

        {warningNote && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900">
            {warningNote}
          </div>
        )}

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Suppression...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
