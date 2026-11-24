import React, { useState } from 'react';
import { AlertCircle, Save, ShieldCheck, X } from 'lucide-react';
import { Invoice, InvoiceDocumentType, Supplier } from '../types/payment';
import { getInvoiceDocumentType } from '../utils/invoiceUtils';

interface AdminEditInvoiceModalProps {
  invoice: Invoice;
  suppliers: Supplier[];
  linkedOrdersCount: number;
  allocatedAmount: number;
  isAdmin?: boolean;
  onSave: (id: string, payload: Partial<Invoice>) => Promise<void>;
  onClose: () => void;
}

export const AdminEditInvoiceModal: React.FC<AdminEditInvoiceModalProps> = ({
  invoice,
  suppliers,
  linkedOrdersCount,
  allocatedAmount,
  isAdmin = true,
  onSave,
  onClose,
}) => {
  const initialDocType = getInvoiceDocumentType(invoice);
  const [documentType, setDocumentType] = useState<InvoiceDocumentType>(initialDocType);
  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice.definitiveInvoiceNumber || invoice.invoiceNumber
  );
  const [invoiceDate, setInvoiceDate] = useState(
    invoice.definitiveInvoiceDate || invoice.invoiceDate
  );
  const [proformaNumber, setProformaNumber] = useState(
    invoice.proformaNumber || (initialDocType === 'PROFORMA' ? invoice.invoiceNumber : '')
  );
  const [proformaDate, setProformaDate] = useState(
    invoice.proformaDate || (initialDocType === 'PROFORMA' ? invoice.invoiceDate : '')
  );
  const [dueDate, setDueDate] = useState(invoice.dueDate || '');
  const [contractNumber, setContractNumber] = useState(invoice.contractNumber || '');
  const [supplierId, setSupplierId] = useState(invoice.supplierId || '');
  const [supplierName, setSupplierName] = useState(invoice.supplierName);
  const [supplierCountry, setSupplierCountry] = useState(invoice.supplierCountry || '');
  const [supplierAddress, setSupplierAddress] = useState(invoice.supplierAddress || '');
  const [supplierBank, setSupplierBank] = useState(invoice.supplierBank || '');
  const [supplierIban, setSupplierIban] = useState(invoice.supplierIban || '');
  const [supplierSwift, setSupplierSwift] = useState(invoice.supplierSwift || '');
  const [currency, setCurrency] = useState<Invoice['currency']>(invoice.currency);
  const [totalAmount, setTotalAmount] = useState(String(invoice.totalAmount));
  const [operationNature, setOperationNature] = useState(invoice.operationNature);
  const [purpose, setPurpose] = useState(invoice.purpose);
  const [notes, setNotes] = useState(invoice.notes || '');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectSupplier = (id: string) => {
    setSupplierId(id);
    const found = suppliers.find(s => s.id === id);
    if (found) {
      setSupplierName(found.name);
      setSupplierCountry(found.country);
      setSupplierAddress(found.address);
      setSupplierBank(found.bankName);
      setSupplierIban(found.iban);
      setSupplierSwift(found.swift);
    }
  };

  const handleDocumentTypeChange = (nextType: InvoiceDocumentType) => {
    setDocumentType(nextType);
    if (nextType === 'PROFORMA' && !proformaNumber.trim()) {
      setProformaNumber(invoice.proformaNumber || invoiceNumber);
      setProformaDate(invoice.proformaDate || invoiceDate);
    } else if (nextType === 'FACTURE' && !invoiceNumber.trim()) {
      setInvoiceNumber(invoice.definitiveInvoiceNumber || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedProf = proformaNumber.trim();
    const trimmedInv = invoiceNumber.trim();

    if (documentType === 'PROFORMA') {
      if (!trimmedProf) {
        setErrorMsg('Le numéro de Proforma est obligatoire.');
        return;
      }
    } else {
      if (!trimmedInv) {
        setErrorMsg('Le numéro de Facture est obligatoire.');
        return;
      }
      if (trimmedProf && trimmedProf.toLowerCase() === trimmedInv.toLowerCase()) {
        setErrorMsg(
          `La nouvelle référence de Facture (${trimmedInv}) doit être différente de la référence Proforma (${trimmedProf}).`
        );
        return;
      }
    }

    if (!supplierName.trim()) {
      setErrorMsg('Le nom du fournisseur est obligatoire.');
      return;
    }
    if (!purpose.trim()) {
      setErrorMsg('L’objet de la facture est obligatoire.');
      return;
    }
    const parsedAmount = parseFloat(totalAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Le montant total doit être strictement supérieur à 0.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(
        invoice.id,
        documentType === 'PROFORMA'
          ? {
              documentType: 'PROFORMA',
              paymentScheme: 'STANDARD',
              invoiceNumber: trimmedProf,
              invoiceDate: proformaDate || invoiceDate,
              proformaNumber: trimmedProf,
              proformaDate: proformaDate || invoiceDate,
              definitiveInvoiceNumber: '',
              definitiveInvoiceDate: '',
              dueDate: dueDate || undefined,
              contractNumber: contractNumber.trim() || undefined,
              supplierId: supplierId || undefined,
              supplierName: supplierName.trim(),
              supplierCountry: supplierCountry.trim(),
              supplierAddress: supplierAddress.trim(),
              supplierBank: supplierBank.trim(),
              supplierIban: supplierIban.trim(),
              supplierSwift: supplierSwift.trim().toUpperCase(),
              currency,
              totalAmount: Number(parsedAmount.toFixed(2)),
              operationNature: operationNature.trim(),
              purpose: purpose.trim(),
              notes: notes.trim() || undefined,
            }
          : {
              documentType: 'FACTURE',
              paymentScheme: 'STANDARD',
              invoiceNumber: trimmedInv,
              invoiceDate,
              definitiveInvoiceNumber: trimmedInv,
              definitiveInvoiceDate: invoiceDate,
              proformaNumber: trimmedProf || undefined,
              proformaDate: trimmedProf ? proformaDate || invoiceDate : undefined,
              dueDate: dueDate || undefined,
              contractNumber: contractNumber.trim() || undefined,
              supplierId: supplierId || undefined,
              supplierName: supplierName.trim(),
              supplierCountry: supplierCountry.trim(),
              supplierAddress: supplierAddress.trim(),
              supplierBank: supplierBank.trim(),
              supplierIban: supplierIban.trim(),
              supplierSwift: supplierSwift.trim().toUpperCase(),
              currency,
              totalAmount: Number(parsedAmount.toFixed(2)),
              operationNature: operationNature.trim(),
              purpose: purpose.trim(),
              notes: notes.trim() || undefined,
            }
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la modification de la facture.');
    } finally {
      setIsSaving(false);
    }
  };

  const parsedTotal = parseFloat(totalAmount) || 0;

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
                  ? `Modification Administrateur — Dossier ${invoice.invoiceNumber}`
                  : `Modifier mon dossier — ${invoice.invoiceNumber}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                Mise à jour des données facture / Proforma et fournisseur (tracée dans l&apos;audit DFC).
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

        {linkedOrdersCount > 0 && parsedTotal > 0 && parsedTotal < allocatedAmount && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-900">
            Attention : {linkedOrdersCount} ordre(s) déjà rattaché(s) totalisent{' '}
            <strong className="font-mono">
              {allocatedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
              {invoice.currency}
            </strong>
            . Le nouveau montant saisi est inférieur à ce cumul.
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Type de document (Facture / Proforma) + références */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Type de document <span className="text-rose-500">*</span>
              </label>
              <select
                aria-label="Type de document"
                value={documentType}
                onChange={e => handleDocumentTypeChange(e.target.value as InvoiceDocumentType)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900"
              >
                <option value="FACTURE">Facture</option>
                <option value="PROFORMA">Proforma</option>
              </select>
            </div>

            {documentType === 'PROFORMA' ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    N° Proforma <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={proformaNumber}
                    onChange={e => setProformaNumber(e.target.value)}
                    placeholder="Ex : PROF-2026-045"
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Date Proforma <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={proformaDate}
                    onChange={e => setProformaDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    N° Facture <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="Ex : FAC-2026-088"
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Date Facture <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                N° Contrat / Marché
              </label>
              <input
                type="text"
                value={contractNumber}
                onChange={e => setContractNumber(e.target.value)}
                className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Date d&apos;Échéance
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>

            {documentType === 'FACTURE' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    N° Proforma d&apos;origine (si convertie)
                  </label>
                  <input
                    type="text"
                    placeholder="Optionnel"
                    value={proformaNumber}
                    onChange={e => setProformaNumber(e.target.value)}
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Date Proforma d&apos;origine
                  </label>
                  <input
                    type="date"
                    value={proformaDate}
                    onChange={e => setProformaDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Fournisseur / Coordonnées Bancaires
            </span>
            <select
              value={supplierId}
              onChange={e => handleSelectSupplier(e.target.value)}
              className="text-xs bg-white border border-blue-200 text-blue-800 rounded-md px-2.5 py-1"
            >
              <option value="">-- Reprendre du référentiel fournisseurs --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Raison sociale <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Pays
              </label>
              <input
                type="text"
                value={supplierCountry}
                onChange={e => setSupplierCountry(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Banque
              </label>
              <input
                type="text"
                value={supplierBank}
                onChange={e => setSupplierBank(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={supplierAddress}
                onChange={e => setSupplierAddress(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                IBAN / Compte
              </label>
              <input
                type="text"
                value={supplierIban}
                onChange={e => setSupplierIban(e.target.value)}
                className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                SWIFT / BIC
              </label>
              <input
                type="text"
                value={supplierSwift}
                onChange={e => setSupplierSwift(e.target.value)}
                className="w-full text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Devise <span className="text-rose-500">*</span>
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as Invoice['currency'])}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
              <option value="CAD">CAD</option>
              <option value="JPY">JPY</option>
              <option value="TND">TND</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Montant Total Facture <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-right"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Objet / Désignation <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Observations / Modalités
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
            />
          </div>
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
