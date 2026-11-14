import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Upload,
  Building,
  UserCheck,
  CreditCard,
  Paperclip,
  CheckCircle2,
  Send,
  Save,
  AlertCircle,
  FileCheck,
  Trash2,
  Eye,
  Info,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';
import {
  Supplier,
  Bank,
  User,
  PaymentOrder,
  DocumentType,
  PaymentDocument,
  Invoice,
} from '../types/payment';
import { numberToFrenchWords } from '../utils/numberToFrenchWords';
import { generateStructuredOrderNumber } from '../utils/workflowRules';
import {
  computeInvoicePaymentSummary,
  getAvailableInvoicesForOrder,
  validateOrderAgainstInvoice,
} from '../utils/invoiceUtils';

interface NewOrderViewProps {
  suppliers: Supplier[];
  banks: Bank[];
  invoices: Invoice[];
  orders: PaymentOrder[];
  initialInvoiceId?: string | null;
  currentUser: User;
  existingCount: number;
  onSubmit: (orderData: Partial<PaymentOrder>) => Promise<void>;
  onCancel: () => void;
}

export const NewOrderView: React.FC<NewOrderViewProps> = ({
  suppliers,
  banks,
  invoices,
  orders,
  initialInvoiceId,
  currentUser,
  existingCount,
  onSubmit,
  onCancel,
}) => {
  const currentYear = new Date().getFullYear();
  const initialStructured = generateStructuredOrderNumber(
    currentUser.userCode || '001',
    currentYear,
    existingCount
  );

  // Form State - Numéro d'ordre structuré 000 UTILISATEUR 000 ANNEE 0000 ORDRE
  const [userPart, setUserPart] = useState<string>(initialStructured.userPart);
  const [yearPart, setYearPart] = useState<string>(initialStructured.yearPart);
  const [seqPart, setSeqPart] = useState<string>(initialStructured.seqPart);

  // Contrat & Objet
  const [contractNumber, setContractNumber] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');

  // Beneficiary
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [beneficiaryCountry, setBeneficiaryCountry] = useState<string>('');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState<string>('');
  const [beneficiaryBank, setBeneficiaryBank] = useState<string>('');
  const [beneficiaryIban, setBeneficiaryIban] = useState<string>('');
  const [beneficiarySwift, setBeneficiarySwift] = useState<string>('');

  // Financial
  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND'>('EUR');
  const [amount, setAmount] = useState<string>('');
  const [amountInWords, setAmountInWords] = useState<string>('');
  const [transferPurpose, setTransferPurpose] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [operationNature, setOperationNature] = useState<string>('Importation tabac brut');

  // Local MTK Bank & Type de transfert (Virement / LC)
  const [bankId, setBankId] = useState<string>('bank_stb');
  const [bankName, setBankName] = useState<string>('Société Tunisienne de Banque');
  const [bankBranch, setBankBranch] = useState<string>('Agence Kairouan République');
  const [bankFileRef, setBankFileRef] = useState<string>('');
  const [transferType, setTransferType] = useState<'VIREMENT' | 'LC' | 'REMISE' | 'AUTRE'>('VIREMENT');
  const [lcNumber, setLcNumber] = useState<string>('');
  const [requiresRateNegotiation, setRequiresRateNegotiation] = useState<boolean>(false);
  const [remarks, setRemarks] = useState<string>('');

  // Documents
  const [documents, setDocuments] = useState<Array<Omit<PaymentDocument, 'id' | 'orderId'>>>([]);
  const [docUploadName, setDocUploadName] = useState<string>('');
  const [docUploadType, setDocUploadType] = useState<DocumentType>('FACTURE');

  // Validation & Loading
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Module 00 Facture sélectionnée (un ou plusieurs ordres par facture)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'PARTIAL'>('FULL');

  const availableInvoices = useMemo(
    () => getAvailableInvoicesForOrder(invoices, orders),
    [invoices, orders]
  );

  const selectedInvoice = useMemo(
    () => invoices.find(inv => inv.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  const selectedInvoiceSummary = useMemo(
    () => (selectedInvoice ? computeInvoicePaymentSummary(selectedInvoice, orders) : null),
    [selectedInvoice, orders]
  );

  const applyInvoiceSelection = (invoiceId: string) => {
    setErrorMsg(null);
    if (!invoiceId) {
      setSelectedInvoiceId('');
      return;
    }
    const found = invoices.find(inv => inv.id === invoiceId);
    if (!found) return;
    const summary = computeInvoicePaymentSummary(found, orders);

    setSelectedInvoiceId(found.id);
    if (found.contractNumber) setContractNumber(found.contractNumber);
    setPurpose(found.purpose || '');
    setTransferPurpose(
      `Règlement facture ${found.invoiceNumber}${
        summary.linkedOrders.length > 0 ? ` (Tranche ${summary.linkedOrders.length + 1})` : ''
      }`
    );
    setSelectedSupplierId(found.supplierId || '');
    setBeneficiaryName(found.supplierName || '');
    setBeneficiaryCountry(found.supplierCountry || '');
    setBeneficiaryAddress(found.supplierAddress || '');
    setBeneficiaryBank(found.supplierBank || '');
    setBeneficiaryIban(found.supplierIban || '');
    setBeneficiarySwift(found.supplierSwift || '');
    setCurrency(found.currency);
    setOperationNature(found.operationNature || 'Importation tabac brut');
    setInvoiceNumber(found.invoiceNumber);
    setInvoiceDate(found.invoiceDate);
    setPaymentMode('FULL');
    setAmount(summary.remainingAmount > 0 ? String(summary.remainingAmount) : '');

    if (found.documents && found.documents.length > 0) {
      setDocuments(prev => {
        const existingNames = new Set(prev.map(d => d.name));
        const newDocs = found.documents!
          .filter(d => !existingNames.has(d.name))
          .map(({ id: _id, ...rest }) => rest);
        return [...prev, ...newDocs];
      });
    }
  };

  useEffect(() => {
    if (initialInvoiceId && invoices.some(inv => inv.id === initialInvoiceId)) {
      applyInvoiceSelection(initialInvoiceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvoiceId]);

  // Auto-convert amount to French words when amount or currency changes
  useEffect(() => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      setAmountInWords(numberToFrenchWords(num, currency));
    } else {
      setAmountInWords('');
    }
  }, [amount, currency]);

  // Handle supplier selection
  const handleSupplierSelect = (id: string) => {
    setSelectedSupplierId(id);
    const found = suppliers.find(s => s.id === id);
    if (found) {
      setBeneficiaryName(found.name);
      setBeneficiaryCountry(found.country);
      setBeneficiaryAddress(found.address);
      setBeneficiaryBank(found.bankName);
      setBeneficiaryIban(found.iban);
      setBeneficiarySwift(found.swift);
    }
  };

  // Handle local bank selection
  const handleBankSelect = (id: string) => {
    setBankId(id);
    const found = banks.find(b => b.id === id);
    if (found) {
      setBankName(found.name);
      setBankBranch(found.contactAgency || 'Agence Kairouan');
    }
  };

  // File Upload Simulator with real File / base64 reading
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setDocuments(prev => [
          ...prev,
          {
            name: file.name,
            type: docUploadType,
            size: file.size,
            mimeType: file.type || 'application/pdf',
            uploadedAt: new Date().toISOString(),
            uploadedBy: currentUser.name,
            dataBase64: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // reset input
    e.target.value = '';
  };

  const removeDoc = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (targetStatus: 'SAISI' | 'TRANSMIS_SIGNATURE') => {
    setErrorMsg(null);

    // Basic Validations
    if (!contractNumber.trim()) {
      setErrorMsg('Veuillez renseigner le numéro de contrat.');
      return;
    }
    if (!purpose.trim()) {
      setErrorMsg('Veuillez renseigner l’objet général du paiement.');
      return;
    }
    if (!beneficiaryName.trim()) {
      setErrorMsg('Le nom du fournisseur / bénéficiaire est obligatoire.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setErrorMsg('La référence de la facture est obligatoire.');
      return;
    }
    if (transferType !== 'VIREMENT' && !lcNumber.trim()) {
      setErrorMsg('Veuillez renseigner le N° LC ou Remise ou Autre pour ce type de transfert.');
      return;
    }

    if (selectedInvoice) {
      const invoiceCheck = validateOrderAgainstInvoice(
        selectedInvoice,
        orders,
        parsedAmount,
        currency
      );
      if (!invoiceCheck.valid) {
        setErrorMsg(invoiceCheck.error || 'Montant incompatible avec le solde de la facture.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const structuredFullNumber = `${userPart}-${yearPart}-${seqPart}`;
      await onSubmit({
        orderNumber: structuredFullNumber,
        userCode: userPart,
        yearCode: yearPart,
        orderSeq: seqPart,
        contractNumber: contractNumber.trim(),
        transferType,
        lcNumber: transferType !== 'VIREMENT' ? lcNumber.trim() : undefined,
        requiresRateNegotiation,
        purpose,
        supplierId: selectedSupplierId || undefined,
        beneficiaryName,
        beneficiaryCountry,
        beneficiaryAddress,
        beneficiaryBank,
        beneficiaryIban,
        beneficiarySwift,
        currency,
        amount: parsedAmount,
        amountInWords: amountInWords || numberToFrenchWords(parsedAmount, currency),
        transferPurpose: transferPurpose || purpose,
        invoiceId: selectedInvoiceId || undefined,
        invoiceNumber,
        invoiceDate,
        operationNature,
        bankId,
        bankName,
        bankBranch,
        bankFileRef,
        remarks,
        status: targetStatus,
        documents: documents as any,
        isDemo: false,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création de l’ordre');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Banner / Auto Number */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Formulaire de Saisie Officiel · DFC
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-bold">
              {`${userPart}-${yearPart}-${seqPart}`}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Création d'un Ordre de Paiement à l'Étranger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dossier de transfert international soumis aux contrôles de conformité et de domiciliation bancaire.
          </p>
        </div>
        <div className="text-right sm:border-l sm:border-slate-100 sm:pl-4">
          <div className="text-xs text-slate-400">Agent Initiateur</div>
          <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
          <div className="text-[11px] text-blue-700 font-medium">{currentUser.department}</div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* SECTION 0: Facture à régler (Module Factures) */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              0. Facture à Régler (Module Factures)
            </h3>
          </div>
          <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
            {availableInvoices.length} facture(s) avec solde disponible
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Sélectionner une facture enregistrée (paiement en 1 ou plusieurs ordres)
          </label>
          <select
            aria-label="Sélectionner une facture à régler"
            value={selectedInvoiceId}
            onChange={e => applyInvoiceSelection(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">-- Saisie manuelle sans rattachement facture --</option>
            {availableInvoices.map(({ invoice, summary }) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} — {invoice.supplierName} — Reste :{' '}
                {summary.remainingAmount.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                / {invoice.totalAmount.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                {invoice.currency}
                {summary.linkedOrders.length > 0
                  ? ` (${summary.linkedOrders.length} ordre(s) déjà émis)`
                  : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedInvoice && selectedInvoiceSummary && (() => {
          const parsedAmt = parseFloat(amount) || 0;
          const remainingAfter = Math.max(
            0,
            Number((selectedInvoiceSummary.remainingAmount - parsedAmt).toFixed(2))
          );
          const exceedsBalance = parsedAmt > selectedInvoiceSummary.remainingAmount + 0.005;

          return (
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                  <div className="text-[11px] text-slate-500">Montant Total Facture</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedInvoice.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                    {selectedInvoice.currency}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                  <div className="text-[11px] text-slate-500">
                    Déjà ordonnancé ({selectedInvoiceSummary.linkedOrders.length})
                  </div>
                  <div className="font-mono font-bold text-amber-700 mt-0.5">
                    {selectedInvoiceSummary.allocatedAmount.toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    {selectedInvoice.currency}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                  <div className="text-[11px] text-slate-500">Solde restant disponible</div>
                  <div className="font-mono font-bold text-blue-700 mt-0.5">
                    {selectedInvoiceSummary.remainingAmount.toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    {selectedInvoice.currency}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                  <div className="text-[11px] text-slate-500">Reste après cet ordre</div>
                  <div
                    className={`font-mono font-bold mt-0.5 ${
                      exceedsBalance
                        ? 'text-rose-700'
                        : remainingAfter <= 0.005
                        ? 'text-emerald-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {exceedsBalance
                      ? 'Dépassement !'
                      : `${remainingAfter.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                        })} ${selectedInvoice.currency}`}
                  </div>
                </div>
              </div>

              {selectedInvoiceSummary.linkedOrders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="font-semibold">Ordres précédents :</span>
                  {selectedInvoiceSummary.linkedOrders.map(o => (
                    <span
                      key={o.id}
                      className="px-2 py-0.5 rounded bg-white border border-blue-200 font-mono text-blue-800"
                    >
                      {o.orderNumber} ({o.amount.toLocaleString('fr-FR')} {o.currency})
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('FULL');
                    setAmount(String(selectedInvoiceSummary.remainingAmount));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMode === 'FULL'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Règlement total du solde ({selectedInvoiceSummary.remainingAmount.toLocaleString('fr-FR')} {selectedInvoice.currency})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('PARTIAL');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMode === 'PARTIAL'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Règlement partiel (tranche / plusieurs ordres)
                </button>
              </div>

              {exceedsBalance && (
                <div className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Le montant saisi dépasse le solde restant de la facture ({selectedInvoiceSummary.remainingAmount.toLocaleString('fr-FR')} {selectedInvoice.currency}).
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* SECTION A: Informations Générales */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileText className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            A. Informations Générales
          </h3>
        </div>

        {/* Structure Numéro d'ordre : 000 UTILISATEUR 000 ANNEE 0000 ORDRE */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Numéro d'Ordre Structuré <span className="font-mono text-slate-400 font-normal">(000 UTILISATEUR · 000 ANNÉE · 0000 ORDRE)</span>
            </label>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {`${userPart}-${yearPart}-${seqPart}`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                000 Utilisateur
              </label>
              <input
                type="text"
                maxLength={3}
                value={userPart}
                onChange={e => setUserPart(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="001"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">Code Utilisateur</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                000 Année
              </label>
              <input
                type="text"
                maxLength={3}
                value={yearPart}
                onChange={e => setYearPart(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="026"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">Année (ex: 026)</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                0000 Ordre
              </label>
              <input
                type="text"
                maxLength={4}
                value={seqPart}
                onChange={e => setSeqPart(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0001"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 text-center focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">Séquence Chrono</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contrat <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : CT-2026/MTK-042 ou Marché N° 12/2026"
              value={contractNumber}
              onChange={e => setContractNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Objet Général du Paiement <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : Règlement importation lots tabac brut Virginie Flue-Cured"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION B: Bénéficiaire */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              B. Informations du Fournisseur / Bénéficiaire
            </h3>
          </div>
          {/* Quick select from directory */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Choisir dans le référentiel :</span>
            <select
              value={selectedSupplierId}
              onChange={e => handleSupplierSelect(e.target.value)}
              className="text-xs bg-blue-50 border border-blue-200 text-blue-800 font-medium rounded-md px-2.5 py-1 focus:outline-none"
            >
              <option value="">-- Saisie manuelle ou sélectionner --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Raison Sociale / Nom du Fournisseur <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : Universal Leaf Tobacco Company Inc."
              value={beneficiaryName}
              onChange={e => setBeneficiaryName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pays de Destination <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : États-Unis, France, Allemagne, Italie..."
              value={beneficiaryCountry}
              onChange={e => setBeneficiaryCountry(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Adresse Complète du Siège
          </label>
          <input
            type="text"
            placeholder="Ex : 9201 Forest Hill Avenue, Richmond, VA 23235"
            value={beneficiaryAddress}
            onChange={e => setBeneficiaryAddress(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Banque Bénéficiaire à l'Étranger
            </label>
            <input
              type="text"
              placeholder="Ex : JPMorgan Chase Bank, BNP Paribas, etc."
              value={beneficiaryBank}
              onChange={e => setBeneficiaryBank(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              IBAN ou Numéro de Compte
            </label>
            <input
              type="text"
              placeholder="Ex : US89CHAS32009876543210"
              value={beneficiaryIban}
              onChange={e => setBeneficiaryIban(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Code SWIFT / BIC
            </label>
            <input
              type="text"
              placeholder="Ex : CHASUS33, BNPAFRRP..."
              value={beneficiarySwift}
              onChange={e => setBeneficiarySwift(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* SECTION C: Informations Financières */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            C. Données Financières
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Devise de Facturation <span className="text-rose-500">*</span>
              {selectedInvoice && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-blue-700 font-medium">
                  <Lock className="w-2.5 h-2.5" /> Facture
                </span>
              )}
            </label>
            <select
              value={currency}
              disabled={Boolean(selectedInvoice)}
              onChange={e => setCurrency(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <option value="EUR">Euro (EUR - €)</option>
              <option value="USD">Dollar US (USD - $)</option>
              <option value="GBP">Livre Sterling (GBP - £)</option>
              <option value="CHF">Franc Suisse (CHF)</option>
              <option value="CAD">Dollar Canadien (CAD)</option>
              <option value="JPY">Yen Japonais (JPY - ¥)</option>
              <option value="TND">Dinar Tunisien (TND)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Montant à Transférer <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => {
                const val = e.target.value;
                setAmount(val);
                if (selectedInvoiceSummary) {
                  const num = parseFloat(val);
                  if (!isNaN(num) && Math.abs(num - selectedInvoiceSummary.remainingAmount) > 0.005) {
                    setPaymentMode('PARTIAL');
                  } else if (!isNaN(num) && Math.abs(num - selectedInvoiceSummary.remainingAmount) <= 0.005) {
                    setPaymentMode('FULL');
                  }
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nature de l'Opération
            </label>
            <select
              value={operationNature}
              onChange={e => setOperationNature(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="Importation tabac brut">Importation tabac brut</option>
              <option value="Consommables de fabrication tabac">Consommables (filtres, papiers, manchettes)</option>
              <option value="Pièces de rechange industrielles">Pièces de rechange machines à cigarettes</option>
              <option value="Additifs et arômes de fabrication">Additifs et arômes conformes</option>
              <option value="Prestations de services et assistance technique">Assistance technique & Révision</option>
              <option value="Licences logicielles & Maintenance">Licences logicielles & DSI</option>
            </select>
          </div>
        </div>

        {/* Montant en toutes lettres généré automatiquement */}
        <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 mb-1">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Montant en toutes lettres (génération automatique en français) :</span>
          </div>
          <div className="text-xs font-medium text-blue-950 italic">
            {amountInWords ? `« ${amountInWords} »` : 'Saisissez un montant numérique pour générer la mention en lettres.'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Référence de la Facture <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : FAC-2026-9901"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date de la Facture
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Objet du Transfert (mention SWIFT / Règlement)
          </label>
          <input
            type="text"
            placeholder="Ex : Paiement acompte commande trimestrielle feuilles de tabac selon contrat N° 2026/04"
            value={transferPurpose}
            onChange={e => setTransferPurpose(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* SECTION D: Banque Tunisienne MTK & Type de Transfert */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Building className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            D. Informations Bancaires Tunisiennes & Mode de Transfert
          </h3>
        </div>

        {/* Type de Transfert : Virement / LC / Remise / Autre */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Type de Transfert <span className="text-rose-500">*</span>
              </label>
              <select
                value={transferType}
                onChange={e => setTransferType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="VIREMENT">VIREMENT (Transfert Libre / Swift)</option>
                <option value="LC">LC (Lettre de Crédit / Crédit Documentaire)</option>
                <option value="REMISE">REMISE (Remise Documentaire)</option>
                <option value="AUTRE">AUTRE (Autre Instrument)</option>
              </select>
            </div>

            {transferType !== 'VIREMENT' ? (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  N° LC ou Remise ou Autre <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    transferType === 'LC'
                      ? 'Ex : LC-STB-2026-0045'
                      : transferType === 'REMISE'
                      ? 'Ex : REM-DOC-2026-089'
                      : 'Ex : REF-INSTRUMENT-99'
                  }
                  value={lcNumber}
                  onChange={e => setLcNumber(e.target.value)}
                  className="w-full bg-white border border-blue-400 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                />
              </div>
            ) : (
              <div className="flex items-center text-xs text-slate-500 pt-5">
                <span>Virement bancaire direct via réseau interbancaire SWIFT.</span>
              </div>
            )}
          </div>

          {/* Condition négociation du cours exigée -> détermine statut étape 4 */}
          <div className="pt-3 border-t border-slate-200/80">
            <label
              htmlFor="requiresRateNegotiation"
              className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-blue-300 cursor-pointer transition-colors"
            >
              <input
                id="requiresRateNegotiation"
                type="checkbox"
                checked={requiresRateNegotiation}
                onChange={e => setRequiresRateNegotiation(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    Négociation du cours de change exigée (achat de devises)
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      requiresRateNegotiation
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {requiresRateNegotiation
                      ? "Statut au dépôt : En attente d'achat devise"
                      : 'Statut au dépôt : Déposé à la banque'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Si coché, après le dépôt bancaire, l’ordre passera au statut{' '}
                  <strong className="text-purple-800">« En attente d’achat devise »</strong>. Sinon, il prendra le statut{' '}
                  <strong className="text-indigo-800">« Déposé à la banque »</strong>.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Banque Tunisienne MTK <span className="text-rose-500">*</span>
            </label>
            <select
              value={bankId}
              onChange={e => handleBankSelect(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {banks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agence Bancaire
            </label>
            <input
              type="text"
              value={bankBranch}
              onChange={e => setBankBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Référence du Dossier Bancaire
            </label>
            <input
              type="text"
              placeholder="Ex : STB-EXT-2026-088"
              value={bankFileRef}
              onChange={e => setBankFileRef(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Observations & Instructions Particulières
          </label>
          <textarea
            rows={2}
            placeholder="Précisions de négociation, urgence de fabrication, instructions de fret ou dispense douanière..."
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* SECTION E: Pièces Justificatives */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              E. Pièces Justificatives & Documents
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {documents.length} fichier(s) joint(s)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Type de document à ajouter
            </label>
            <select
              value={docUploadType}
              onChange={e => setDocUploadType(e.target.value as any)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="FACTURE">Facture Fournisseur / Proforma</option>
              <option value="DOMICILIATION">Fiche de Domiciliation Bancaire</option>
              <option value="CONTRAT">Contrat Commercial / Bon de Commande</option>
              <option value="BORDEREAU_DEPOT">Bordereau de Dépôt / Accusé</option>
              <option value="AUTRE">Document Complémentaire / Douane</option>
            </select>
          </div>

          <div className="w-full sm:w-auto self-end">
            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-4 h-4" />
              <span>Parcourir & Joindre un fichier</span>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="space-y-2 pt-2">
            {documents.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-blue-700">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{doc.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span className="font-medium text-blue-700">{doc.type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{(doc.size / 1024).toFixed(1)} Ko</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.dataBase64 && (
                    <a
                      href={doc.dataBase64}
                      download={doc.name}
                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"
                      title="Télécharger"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDoc(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Annuler et retourner
        </button>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Option 1: Saisi (Brouillon) */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('SAISI')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>Enregistrer : Saisi (Brouillon)</span>
          </button>

          {/* Option 2: Transmettre pour signature */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit('TRANSMIS_SIGNATURE')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>Transmettre pour signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};
