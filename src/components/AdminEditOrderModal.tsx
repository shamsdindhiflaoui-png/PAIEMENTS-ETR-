import React, { useState } from 'react';
import { AlertCircle, Save, ShieldCheck, X } from 'lucide-react';
import {
  Bank,
  InvoiceDocumentBasis,
  OrderTransferType,
  PaymentOrder,
  PaymentStatus,
} from '../types/payment';
import { STATUS_META } from '../utils/workflowRules';

interface AdminEditOrderModalProps {
  order: PaymentOrder;
  banks: Bank[];
  isAdmin?: boolean;
  onSave: (id: string, payload: Partial<PaymentOrder>) => Promise<void>;
  onClose: () => void;
}

const CURRENCIES: PaymentOrder['currency'][] = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'JPY',
  'TND',
];

const STATUSES: PaymentStatus[] = [
  'SAISI',
  'TRANSMIS_SIGNATURE',
  'SIGNE',
  'DEPOSE_BANQUE',
  'EN_ATTENTE_ACHAT_DEVISE',
  'EXECUTE',
  'ANNULE',
];

export const AdminEditOrderModal: React.FC<AdminEditOrderModalProps> = ({
  order,
  banks,
  isAdmin = true,
  onSave,
  onClose,
}) => {
  const [orderNumber, setOrderNumber] = useState(order.orderNumber);
  const [status, setStatus] = useState<PaymentStatus>(order.status);
  const [contractNumber, setContractNumber] = useState(order.contractNumber || '');
  const [documentBasis, setDocumentBasis] = useState<InvoiceDocumentBasis>(
    order.documentBasis || 'FACTURE_DEFINITIVE'
  );
  const [invoiceNumber, setInvoiceNumber] = useState(order.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(order.invoiceDate || '');
  const [proformaNumber, setProformaNumber] = useState(order.proformaNumber || '');
  const [proformaDate, setProformaDate] = useState(order.proformaDate || '');
  const [domiciliationNumber, setDomiciliationNumber] = useState(
    order.domiciliationNumber || ''
  );
  const [operationNature, setOperationNature] = useState(order.operationNature || '');
  const [purpose, setPurpose] = useState(order.purpose || '');

  const [beneficiaryName, setBeneficiaryName] = useState(order.beneficiaryName || '');
  const [beneficiaryCountry, setBeneficiaryCountry] = useState(
    order.beneficiaryCountry || ''
  );
  const [beneficiaryAddress, setBeneficiaryAddress] = useState(
    order.beneficiaryAddress || ''
  );
  const [beneficiaryBank, setBeneficiaryBank] = useState(order.beneficiaryBank || '');
  const [beneficiaryIban, setBeneficiaryIban] = useState(order.beneficiaryIban || '');
  const [beneficiarySwift, setBeneficiarySwift] = useState(order.beneficiarySwift || '');

  const [bankId, setBankId] = useState(order.bankId || '');
  const [bankName, setBankName] = useState(order.bankName || '');
  const [bankBranch, setBankBranch] = useState(order.bankBranch || '');
  const [bankFileRef, setBankFileRef] = useState(order.bankFileRef || '');
  const [transferType, setTransferType] = useState<OrderTransferType>(
    order.transferType || 'VIREMENT'
  );
  const [lcNumber, setLcNumber] = useState(order.lcNumber || '');
  const [requiresRateNegotiation, setRequiresRateNegotiation] = useState(
    Boolean(order.requiresRateNegotiation)
  );

  const [currency, setCurrency] = useState<PaymentOrder['currency']>(order.currency);
  const [amount, setAmount] = useState(String(order.amount));
  const [remarks, setRemarks] = useState(order.remarks || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleBankChange = (selectedId: string) => {
    setBankId(selectedId);
    const found = banks.find(b => b.id === selectedId);
    if (found) {
      setBankName(found.name);
      if (found.contactAgency) setBankBranch(found.contactAgency);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!orderNumber.trim()) {
      setErrorMsg('Le numéro d’ordre est obligatoire.');
      return;
    }
    if (!beneficiaryName.trim()) {
      setErrorMsg('Le nom du bénéficiaire est obligatoire.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setErrorMsg('Le montant net doit être strictement supérieur à 0.');
      return;
    }

    const deductionsTotal = Number(order.deductionsTotal || 0);
    const nextGross = Number((numAmount + deductionsTotal).toFixed(2));

    try {
      setIsSaving(true);
      await onSave(order.id, {
        ...(isAdmin
          ? {
              orderNumber: orderNumber.trim(),
              status,
            }
          : {}),
        contractNumber: contractNumber.trim(),
        documentBasis,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        proformaNumber: proformaNumber.trim() || undefined,
        proformaDate: proformaNumber.trim() ? proformaDate || undefined : undefined,
        domiciliationNumber: domiciliationNumber.trim(),
        operationNature: operationNature.trim(),
        purpose: purpose.trim(),
        transferPurpose: purpose.trim(),
        beneficiaryName: beneficiaryName.trim(),
        beneficiaryCountry: beneficiaryCountry.trim(),
        beneficiaryAddress: beneficiaryAddress.trim(),
        beneficiaryBank: beneficiaryBank.trim(),
        beneficiaryIban: beneficiaryIban.trim(),
        beneficiarySwift: beneficiarySwift.trim().toUpperCase(),
        bankId,
        bankName: bankName.trim(),
        bankBranch: bankBranch.trim(),
        bankFileRef: bankFileRef.trim(),
        transferType,
        lcNumber: lcNumber.trim(),
        requiresRateNegotiation,
        currency,
        amount: Number(numAmount.toFixed(2)),
        grossAmount: deductionsTotal > 0 ? nextGross : Number(numAmount.toFixed(2)),
        remarks: remarks.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la modification de l’ordre.');
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
        className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isAdmin
                  ? `Modification Administrateur — Ordre ${order.orderNumber}`
                  : `Modifier mon ordre — ${order.orderNumber}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAdmin
                  ? 'Toutes les modifications sont enregistrées dans le journal d’audit DFC.'
                  : 'Modification autorisée sur votre propre saisie (avant exécution). Tracée dans le journal d’audit.'}
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

        {/* Section 1: Identité & Statut */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              N° d&apos;Ordre <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isAdmin}
              value={orderNumber}
              onChange={e => setOrderNumber(e.target.value)}
              className={`w-full text-xs font-mono font-bold border border-slate-300 rounded-lg px-2.5 py-2 ${
                isAdmin ? 'bg-slate-50' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
              }`}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Statut du circuit
            </label>
            <select
              disabled={!isAdmin}
              value={status}
              onChange={e => setStatus(e.target.value as PaymentStatus)}
              className={`w-full text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-2 ${
                isAdmin ? 'bg-slate-50' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
              }`}
            >
              {STATUSES.map(st => (
                <option key={st} value={st}>
                  {STATUS_META[st]?.label || st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Devise <span className="text-rose-500">*</span>
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as PaymentOrder['currency'])}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            >
              {CURRENCIES.map(cur => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Montant Net à Transférer <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-right"
            />
          </div>
        </div>

        {/* Section 2: Références commerciales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Type de document
            </label>
            <select
              value={documentBasis}
              onChange={e => setDocumentBasis(e.target.value as InvoiceDocumentBasis)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            >
              <option value="FACTURE_DEFINITIVE">Facture Définitive</option>
              <option value="PROFORMA">Proforma</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {documentBasis === 'PROFORMA' ? 'N° Proforma' : 'N° Facture'}
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              {documentBasis === 'PROFORMA' ? 'Date Proforma' : 'Date Facture'}
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              N° Contrat / Marché
            </label>
            <input
              type="text"
              value={contractNumber}
              onChange={e => setContractNumber(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Rappel N° Proforma (optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex : PROF-2026-045"
              value={proformaNumber}
              onChange={e => setProformaNumber(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Date Proforma (rappel)
            </label>
            <input
              type="date"
              value={proformaDate}
              onChange={e => setProformaDate(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              N° Domiciliation
            </label>
            <input
              type="text"
              value={domiciliationNumber}
              onChange={e => setDomiciliationNumber(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Objet du règlement
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Nature de l&apos;opération
            </label>
            <input
              type="text"
              value={operationNature}
              onChange={e => setOperationNature(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
        </div>

        {/* Section 3: Bénéficiaire */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Bénéficiaire / Fournisseur
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Raison sociale <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={beneficiaryName}
                onChange={e => setBeneficiaryName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Pays
              </label>
              <input
                type="text"
                value={beneficiaryCountry}
                onChange={e => setBeneficiaryCountry(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={beneficiaryAddress}
                onChange={e => setBeneficiaryAddress(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Banque étrangère
              </label>
              <input
                type="text"
                value={beneficiaryBank}
                onChange={e => setBeneficiaryBank(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                IBAN / Compte
              </label>
              <input
                type="text"
                value={beneficiaryIban}
                onChange={e => setBeneficiaryIban(e.target.value)}
                className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Code SWIFT / BIC
              </label>
              <input
                type="text"
                value={beneficiarySwift}
                onChange={e => setBeneficiarySwift(e.target.value)}
                className="w-full text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Banque MTK & Mode transfert */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Banque MTK & Modalités d&apos;exécution
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Banque MTK
              </label>
              <select
                value={bankId}
                onChange={e => handleBankChange(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="">-- Banque personnalisée --</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Agence
              </label>
              <input
                type="text"
                value={bankBranch}
                onChange={e => setBankBranch(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Type de transfert
              </label>
              <select
                value={transferType}
                onChange={e => setTransferType(e.target.value as OrderTransferType)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="VIREMENT">VIREMENT</option>
                <option value="LC">LC (Crédit Documentaire)</option>
                <option value="REMISE">REMISE Documentaire</option>
                <option value="AUTRE">AUTRE</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                N° LC / Réf. Dossier
              </label>
              <input
                type="text"
                value={lcNumber}
                onChange={e => setLcNumber(e.target.value)}
                placeholder={bankFileRef || 'N° LC ou Remise'}
                className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresRateNegotiation}
                onChange={e => setRequiresRateNegotiation(e.target.checked)}
                className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>Négociation du cours de change exigée (Module 02)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Observations / Remarques
          </label>
          <textarea
            rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
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
