import React, { useState } from 'react';
import { Building, Upload, X, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { PaymentOrder, Bank, BankDeposit, User } from '../types/payment';

interface BankDepositModalProps {
  order: PaymentOrder;
  banks: Bank[];
  currentUser: User;
  onClose: () => void;
  onSubmit: (depositData: Partial<BankDeposit>) => Promise<void>;
}

export const BankDepositModal: React.FC<BankDepositModalProps> = ({
  order,
  banks,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [bankId, setBankId] = useState<string>(order.bankId || 'bank_stb');
  const [bankName, setBankName] = useState<string>(order.bankName || 'Société Tunisienne de Banque');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slipNumber, setSlipNumber] = useState<string>(`BORD-${new Date().getFullYear()}-${order.orderNumber}`);
  const [bankReference, setBankReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('Dépôt physique du dossier complet avec pièces justificatives visées.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBankChange = (id: string) => {
    setBankId(id);
    const found = banks.find(b => b.id === id);
    if (found) setBankName(found.name);
  };

  const handleConfirm = async () => {
    setErrorMsg(null);
    if (!slipNumber.trim()) {
      setErrorMsg('Le numéro de bordereau de dépôt est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        bankId,
        bankName,
        depositDate,
        slipNumber,
        bankReference: bankReference || slipNumber,
        depositedBy: currentUser.name,
        notes,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l’enregistrement du dépôt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Enregistrement du Dépôt Bancaire Physique
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Ordre concerné :</span>
            <span className="font-mono font-bold text-blue-800">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Bénéficiaire :</span>
            <span className="font-semibold text-slate-900">{order.beneficiaryName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Montant :</span>
            <span className="font-mono font-bold text-slate-900">{order.amount} {order.currency}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Banque Tunisienne Concernée <span className="text-rose-500">*</span>
            </label>
            <select
              value={bankId}
              onChange={e => handleBankChange(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {banks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date de Dépôt Physique <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={depositDate}
                onChange={e => setDepositDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numéro de Bordereau <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex : BORD-2026-STB-014"
                value={slipNumber}
                onChange={e => setSlipNumber(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Référence Dossier Attribuée par la Banque
            </label>
            <input
              type="text"
              placeholder="Ex : STB-DEP-9941 / Guichet Étranger"
              value={bankReference}
              onChange={e => setBankReference(e.target.value)}
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Commentaires & Observations de Remise
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
            />
          </div>

          <div
            className={`p-3 rounded-lg border text-[11px] leading-relaxed ${
              order.requiresRateNegotiation
                ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                : 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
            }`}
          >
            {order.requiresRateNegotiation ? (
              <>
                <strong>Effet automatique (Négociation du cours exigée) :</strong> L'ordre passera immédiatement au statut{' '}
                <strong>En attente d'achat devise</strong> et sera disponible pour la négociation des cotations (Module 02).
              </>
            ) : (
              <>
                <strong>Effet automatique (Sans négociation exigée) :</strong> L'ordre passera immédiatement au statut{' '}
                <strong>Déposé à la banque</strong>, prêt pour le suivi d'exécution SWIFT.
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors"
          >
            Valider le Dépôt Bancaire
          </button>
        </div>
      </div>
    </div>
  );
};
