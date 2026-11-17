import React, { useState } from 'react';
import { AlertCircle, Save, ShieldCheck, X } from 'lucide-react';
import { Bank, ConsultationStatus, CurrencyConsultation } from '../types/payment';

interface AdminEditConsultationModalProps {
  consultation: CurrencyConsultation;
  banks: Bank[];
  isAdmin?: boolean;
  onSave: (id: string, payload: Partial<CurrencyConsultation>) => Promise<void>;
  onClose: () => void;
}

export const AdminEditConsultationModal: React.FC<AdminEditConsultationModalProps> = ({
  consultation,
  banks,
  isAdmin = true,
  onSave,
  onClose,
}) => {
  const [consultationNumber, setConsultationNumber] = useState(
    consultation.consultationNumber
  );
  const [operationDate, setOperationDate] = useState(consultation.operationDate);
  const [purchaseType, setPurchaseType] = useState(consultation.purchaseType);
  const [submissionDeadlineTime, setSubmissionDeadlineTime] = useState(
    consultation.submissionDeadlineTime
  );
  const [validityDeadlineTime, setValidityDeadlineTime] = useState(
    consultation.validityDeadlineTime
  );
  const [status, setStatus] = useState<ConsultationStatus>(consultation.status);
  const [consultedBankIds, setConsultedBankIds] = useState<string[]>(
    consultation.consultedBankIds || []
  );
  const [contactPhone, setContactPhone] = useState(consultation.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(consultation.contactEmail || '');
  const [faxNumbers, setFaxNumbers] = useState(consultation.faxNumbers || '');

  const [selectedBankId, setSelectedBankId] = useState(
    consultation.selectedBankId || ''
  );
  const [negotiatedRate, setNegotiatedRate] = useState(
    consultation.negotiatedRate !== undefined ? String(consultation.negotiatedRate) : ''
  );
  const [confirmationRef, setConfirmationRef] = useState(
    consultation.confirmationRef || ''
  );
  const [confirmationDate, setConfirmationDate] = useState(
    consultation.confirmationDate || ''
  );
  const [valueDate, setValueDate] = useState(consultation.valueDate || '');
  const [notes, setNotes] = useState(consultation.notes || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleBank = (bankId: string) => {
    setConsultedBankIds(prev =>
      prev.includes(bankId) ? prev.filter(id => id !== bankId) : [...prev, bankId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!consultationNumber.trim()) {
      setErrorMsg('Le numéro de consultation est obligatoire.');
      return;
    }
    if (!operationDate.trim()) {
      setErrorMsg('La date d’opération est obligatoire.');
      return;
    }
    if (!purchaseType.trim()) {
      setErrorMsg('Le type d’achat (date valeur) est obligatoire.');
      return;
    }

    const chosenBank = banks.find(b => b.id === selectedBankId);
    const parsedRate =
      negotiatedRate.trim() !== '' ? parseFloat(negotiatedRate) : undefined;
    if (
      negotiatedRate.trim() !== '' &&
      (!Number.isFinite(parsedRate) || (parsedRate ?? 0) <= 0)
    ) {
      setErrorMsg('Le cours négocié doit être un nombre positif valide.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(consultation.id, {
        ...(isAdmin
          ? {
              consultationNumber: consultationNumber.trim(),
              status,
              selectedBankId: selectedBankId || undefined,
              selectedBankName: chosenBank?.name || consultation.selectedBankName,
              negotiatedRate: parsedRate,
              confirmationRef: confirmationRef.trim() || undefined,
              confirmationDate: confirmationDate || undefined,
              valueDate: valueDate || undefined,
            }
          : {}),
        operationDate: operationDate.trim(),
        purchaseType: purchaseType.trim(),
        submissionDeadlineTime: submissionDeadlineTime.trim(),
        validityDeadlineTime: validityDeadlineTime.trim(),
        consultedBankIds,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        faxNumbers: faxNumbers.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la modification de la consultation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isAdmin
                  ? `Modification Administrateur — Consultation ${consultation.consultationNumber}`
                  : `Modifier ma consultation — ${consultation.consultationNumber}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAdmin
                  ? 'Ajustez les paramètres de consultation, coordonnées ou données de clôture.'
                  : 'Ajustez les paramètres de votre consultation (date, horaires, banques, coordonnées).'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              N° Consultation <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={consultationNumber}
              onChange={e => setConsultationNumber(e.target.value)}
              className={`w-full text-xs font-mono font-bold border border-slate-300 rounded-lg px-2.5 py-2 ${
                isAdmin ? 'bg-slate-50' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
              }`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Date d&apos;opération <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={operationDate}
              onChange={e => setOperationDate(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Statut
            </label>
            <select
              disabled={!isAdmin}
              value={status}
              onChange={e => setStatus(e.target.value as ConsultationStatus)}
              className={`w-full text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-2 ${
                isAdmin ? 'bg-slate-50' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
              }`}
            >
              <option value="OUVERTE">Ouverte</option>
              <option value="CLOTUREE">Clôturée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Type d&apos;achat (Date valeur) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={purchaseType}
              onChange={e => setPurchaseType(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Heure limite cotation
            </label>
            <input
              type="text"
              value={submissionDeadlineTime}
              onChange={e => setSubmissionDeadlineTime(e.target.value)}
              className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Heure validité offre
            </label>
            <input
              type="text"
              value={validityDeadlineTime}
              onChange={e => setValidityDeadlineTime(e.target.value)}
              className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
            Banques destinataires
          </label>
          <div className="flex flex-wrap gap-1.5">
            {banks.map(b => {
              const checked = consultedBankIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBank(b.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                    checked
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {b.code} — {b.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Téléphone N.B.
            </label>
            <input
              type="text"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              E-mail MTK
            </label>
            <input
              type="text"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Numéros de Fax
            </label>
            <input
              type="text"
              value={faxNumbers}
              onChange={e => setFaxNumbers(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Attribution & Références de Confirmation (optionnel)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Banque retenue
                </label>
                <select
                  value={selectedBankId}
                  onChange={e => setSelectedBankId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  <option value="">-- Aucune --</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Cours négocié
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={negotiatedRate}
                  onChange={e => setNegotiatedRate(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Réf. Confirmation
                </label>
                <input
                  type="text"
                  value={confirmationRef}
                  onChange={e => setConfirmationRef(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Date valeur
                </label>
                <input
                  type="date"
                  value={valueDate}
                  onChange={e => setValueDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Notes / Observations
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
