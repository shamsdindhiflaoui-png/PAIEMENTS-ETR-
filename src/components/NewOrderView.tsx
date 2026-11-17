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
  Plus,
  MinusCircle,
} from 'lucide-react';
import {
  Supplier,
  Bank,
  User,
  PaymentOrder,
  DocumentType,
  PaymentDocument,
  Invoice,
  InvoiceDocumentBasis,
  OrderDeduction,
  OrderDeductionCategory,
} from '../types/payment';
import { numberToFrenchWords } from '../utils/numberToFrenchWords';
import { computeNextStructuredOrderNumber, StructuredOrderNumberParts } from '../utils/workflowRules';
import { api } from '../services/api';
import {
  DEDUCTION_CATEGORY_META,
  computeInvoicePaymentSummary,
  getAvailableInvoicesForOrder,
  getInvoiceDefinitiveRef,
  getInvoiceProformaRef,
  getSuggestedNextTranche,
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
  onSubmit: (
    orderData: Partial<PaymentOrder> & {
      definitiveInvoiceNumber?: string;
      definitiveInvoiceDate?: string;
    }
  ) => Promise<void>;
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
  const localAutoStructured = useMemo(
    () =>
      computeNextStructuredOrderNumber(
        currentUser.userCode || '001',
        currentYear,
        orders
      ),
    [currentUser.userCode, currentYear, orders]
  );

  // Numéro d'ordre structuré 000 UTILISATEUR 000 ANNÉE 0000 ORDRE (généré automatiquement)
  const [serverAutoStructured, setServerAutoStructured] =
    useState<StructuredOrderNumberParts | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getNextOrderNumber(currentYear)
      .then(res => {
        if (active) setServerAutoStructured(res);
      })
      .catch(() => {
        if (active) setServerAutoStructured(null);
      });
    return () => {
      active = false;
    };
  }, [currentUser.id, currentUser.userCode, currentYear, orders.length]);

  const autoStructured = serverAutoStructured ?? localAutoStructured;
  const { userPart, yearPart, seqPart, orderNumber: autoOrderNumber } = autoStructured;

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

  // Module 00 Facture sélectionnée (un ou plusieurs ordres par facture + déductions/frais)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [documentBasis, setDocumentBasis] = useState<InvoiceDocumentBasis>('FACTURE_DEFINITIVE');
  const [inlineDefinitiveNumber, setInlineDefinitiveNumber] = useState<string>('');
  const [inlineDefinitiveDate, setInlineDefinitiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [grossAmountInput, setGrossAmountInput] = useState<string>('');
  const [deductions, setDeductions] = useState<
    Array<{
      id: string;
      category: OrderDeductionCategory;
      label: string;
      amount: string;
      reference: string;
    }>
  >([]);

  const deductionsTotal = useMemo(() => {
    const sum = deductions.reduce((acc, d) => {
      const val = parseFloat(d.amount);
      return acc + (Number.isFinite(val) && val > 0 ? val : 0);
    }, 0);
    return Number(sum.toFixed(2));
  }, [deductions]);

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

  const syncNetFromGross = (nextGrossValue: number, nextDeductionsTotal: number) => {
    if (!Number.isFinite(nextGrossValue) || nextGrossValue <= 0) {
      setAmount('');
      return;
    }
    const net = Number((nextGrossValue - nextDeductionsTotal).toFixed(2));
    setAmount(net > 0 ? String(net) : '0');
  };

  const handleAddDeduction = (category: OrderDeductionCategory = 'FRAIS_ENREGISTREMENT') => {
    const meta = DEDUCTION_CATEGORY_META[category];
    setDeductions(prev => [
      ...prev,
      {
        id: 'ded_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        category,
        label: meta.label,
        amount: '',
        reference: '',
      },
    ]);
  };

  const handleUpdateDeduction = (
    id: string,
    patch: Partial<{
      category: OrderDeductionCategory;
      label: string;
      amount: string;
      reference: string;
    }>
  ) => {
    const nextList = deductions.map(d => {
      if (d.id !== id) return d;
      const updated = { ...d, ...patch };
      if (patch.category) {
        const prevDefault = DEDUCTION_CATEGORY_META[d.category].label;
        if (!d.label.trim() || d.label === prevDefault) {
          updated.label = DEDUCTION_CATEGORY_META[patch.category].label;
        }
      }
      return updated;
    });
    setDeductions(nextList);

    if (selectedInvoiceSummary) {
      const nextTotal = Number(
        nextList
          .reduce((acc, item) => {
            const v = parseFloat(item.amount);
            return acc + (Number.isFinite(v) && v > 0 ? v : 0);
          }, 0)
          .toFixed(2)
      );
      const baseGross =
        paymentMode === 'FULL'
          ? selectedInvoiceSummary.remainingAmount
          : parseFloat(grossAmountInput) || 0;
      syncNetFromGross(baseGross, nextTotal);
    }
  };

  const handleRemoveDeduction = (id: string) => {
    const nextList = deductions.filter(d => d.id !== id);
    setDeductions(nextList);

    if (selectedInvoiceSummary) {
      const nextTotal = Number(
        nextList
          .reduce((acc, item) => {
            const v = parseFloat(item.amount);
            return acc + (Number.isFinite(v) && v > 0 ? v : 0);
          }, 0)
          .toFixed(2)
      );
      const baseGross =
        paymentMode === 'FULL'
          ? selectedInvoiceSummary.remainingAmount
          : parseFloat(grossAmountInput) || 0;
      syncNetFromGross(baseGross, nextTotal);
    }
  };

  const handleDocumentBasisChange = (
    nextBasis: InvoiceDocumentBasis,
    invOverride?: Invoice | null
  ) => {
    const inv = invOverride ?? selectedInvoice;
    setDocumentBasis(nextBasis);
    if (!inv) return;

    const profRef = getInvoiceProformaRef(inv);
    const defRef = getInvoiceDefinitiveRef(inv);
    const today = new Date().toISOString().split('T')[0];

    if (nextBasis === 'PROFORMA') {
      setInvoiceNumber(profRef?.number || inv.invoiceNumber);
      setInvoiceDate(profRef?.date || inv.invoiceDate);
    } else if (defRef) {
      setInvoiceNumber(defRef.number);
      setInvoiceDate(defRef.date || inv.invoiceDate);
    } else {
      setInvoiceNumber(inlineDefinitiveNumber);
      setInvoiceDate(inlineDefinitiveDate || today);
    }
  };

  const applyInvoiceSelection = (invoiceId: string) => {
    setErrorMsg(null);
    setDeductions([]);
    const today = new Date().toISOString().split('T')[0];
    if (!invoiceId) {
      setSelectedInvoiceId('');
      setDocumentBasis('FACTURE_DEFINITIVE');
      setInlineDefinitiveNumber('');
      setInlineDefinitiveDate(today);
      setGrossAmountInput('');
      return;
    }
    const found = invoices.find(inv => inv.id === invoiceId);
    if (!found) return;
    const summary = computeInvoicePaymentSummary(found, orders);
    const suggestion = getSuggestedNextTranche(found, summary);
    const profRef = getInvoiceProformaRef(found);
    const defRef = getInvoiceDefinitiveRef(found);

    setSelectedInvoiceId(found.id);
    if (found.contractNumber) setContractNumber(found.contractNumber);
    setPurpose(found.purpose || '');
    setTransferType(suggestion.transferType);
    setDocumentBasis(suggestion.documentBasis);
    setInlineDefinitiveNumber('');
    setInlineDefinitiveDate(today);

    if (suggestion.isMixedScheme && summary.linkedOrders.length === 0) {
      setTransferPurpose(
        `Ouverture LC 50 % sur Proforma ${profRef?.number || found.invoiceNumber}`
      );
    } else if (suggestion.isMixedScheme) {
      setTransferPurpose(
        `Solde 50 % Virement sur Facture Définitive${
          defRef ? ` ${defRef.number}` : ''
        }`
      );
    } else {
      setTransferPurpose(
        `Règlement facture ${found.invoiceNumber}${
          summary.linkedOrders.length > 0 ? ` (Tranche ${summary.linkedOrders.length + 1})` : ''
        }`
      );
    }

    setSelectedSupplierId(found.supplierId || '');
    setBeneficiaryName(found.supplierName || '');
    setBeneficiaryCountry(found.supplierCountry || '');
    setBeneficiaryAddress(found.supplierAddress || '');
    setBeneficiaryBank(found.supplierBank || '');
    setBeneficiaryIban(found.supplierIban || '');
    setBeneficiarySwift(found.supplierSwift || '');
    setCurrency(found.currency);
    setOperationNature(found.operationNature || 'Importation tabac brut');

    if (suggestion.documentBasis === 'PROFORMA') {
      setInvoiceNumber(profRef?.number || found.invoiceNumber);
      setInvoiceDate(profRef?.date || found.invoiceDate);
    } else if (defRef) {
      setInvoiceNumber(defRef.number);
      setInvoiceDate(defRef.date || found.invoiceDate);
    } else {
      setInvoiceNumber('');
      setInvoiceDate(today);
    }

    setPaymentMode(suggestion.paymentMode);
    const suggestedStr =
      suggestion.suggestedGrossAmount > 0 ? String(suggestion.suggestedGrossAmount) : '';
    setGrossAmountInput(suggestedStr);
    setAmount(suggestedStr);

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
      setErrorMsg(
        deductionsTotal > 0
          ? 'Le montant net à transférer après déductions doit être strictement supérieur à 0.'
          : 'Veuillez saisir un montant valide supérieur à 0.'
      );
      return;
    }
    const selectedProfRef = selectedInvoice ? getInvoiceProformaRef(selectedInvoice) : null;
    const selectedDefRef = selectedInvoice ? getInvoiceDefinitiveRef(selectedInvoice) : null;
    const effectiveInvoiceNumber = (
      selectedInvoice && documentBasis === 'FACTURE_DEFINITIVE' && !selectedDefRef
        ? inlineDefinitiveNumber || invoiceNumber
        : invoiceNumber
    ).trim();
    const effectiveInvoiceDate =
      selectedInvoice && documentBasis === 'FACTURE_DEFINITIVE' && !selectedDefRef
        ? inlineDefinitiveDate || invoiceDate
        : invoiceDate;

    if (!effectiveInvoiceNumber) {
      setErrorMsg(
        selectedInvoice && documentBasis === 'FACTURE_DEFINITIVE' && !selectedDefRef
          ? 'Veuillez saisir le N° de la Facture Définitive reçue pour cet ordre.'
          : 'La référence de la facture est obligatoire.'
      );
      return;
    }
    if (transferType !== 'VIREMENT' && !lcNumber.trim()) {
      setErrorMsg('Veuillez renseigner le N° LC ou Remise ou Autre pour ce type de transfert.');
      return;
    }

    const hasInvalidDeduction = deductions.some(d => {
      if (!d.amount.trim()) return false;
      const val = parseFloat(d.amount);
      return !Number.isFinite(val) || val < 0;
    });
    if (hasInvalidDeduction) {
      setErrorMsg('Veuillez saisir un montant valide (positif) pour chaque ligne de déduction.');
      return;
    }

    const deductionPayload: OrderDeduction[] = deductions
      .map(d => ({
        id: d.id,
        category: d.category,
        label: d.label.trim() || DEDUCTION_CATEGORY_META[d.category].label,
        amount: Number((parseFloat(d.amount) || 0).toFixed(2)),
        reference: d.reference.trim() || undefined,
      }))
      .filter(d => d.amount > 0);

    const computedGross = selectedInvoice
      ? paymentMode === 'FULL' && selectedInvoiceSummary
        ? selectedInvoiceSummary.remainingAmount
        : Number((parseFloat(grossAmountInput) || parsedAmount + deductionsTotal).toFixed(2))
      : parsedAmount;

    if (selectedInvoice) {
      const invoiceCheck = validateOrderAgainstInvoice(
        selectedInvoice,
        orders,
        parsedAmount,
        currency,
        deductionPayload,
        computedGross
      );
      if (!invoiceCheck.valid) {
        setErrorMsg(invoiceCheck.error || 'Montant incompatible avec le solde de la facture.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        fiscalYear: currentYear,
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
        grossAmount: selectedInvoice ? computedGross : parsedAmount,
        deductionsTotal: selectedInvoice ? deductionsTotal : 0,
        deductions: selectedInvoice ? deductionPayload : [],
        amount: parsedAmount,
        amountInWords: amountInWords || numberToFrenchWords(parsedAmount, currency),
        transferPurpose: transferPurpose || purpose,
        invoiceId: selectedInvoiceId || undefined,
        documentBasis: selectedInvoice ? documentBasis : 'FACTURE_DEFINITIVE',
        invoiceNumber: effectiveInvoiceNumber,
        invoiceDate: effectiveInvoiceDate,
        proformaNumber: selectedProfRef?.number,
        proformaDate: selectedProfRef?.date,
        ...(selectedInvoice && documentBasis === 'FACTURE_DEFINITIVE' && !selectedDefRef
          ? {
              definitiveInvoiceNumber: effectiveInvoiceNumber,
              definitiveInvoiceDate: effectiveInvoiceDate,
            }
          : {}),
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
            <span
              data-testid="auto-order-number-banner"
              className="text-xs font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-bold inline-flex items-center gap-1"
            >
              <Lock className="w-3 h-3 text-blue-600" />
              {autoOrderNumber}
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
            {availableInvoices.map(({ invoice, summary }) => {
              const pRef = getInvoiceProformaRef(invoice);
              const dRef = getInvoiceDefinitiveRef(invoice);
              const refLabel =
                pRef && dRef
                  ? `${dRef.number} (Proforma ${pRef.number})`
                  : pRef && !dRef
                  ? `Proforma ${pRef.number}`
                  : invoice.invoiceNumber;
              return (
                <option key={invoice.id} value={invoice.id}>
                  {refLabel} — {invoice.supplierName}
                  {invoice.paymentScheme === '50_LC_50_VIREMENT' ? ' [50% LC / 50% Vir.]' : ''} — Reste :{' '}
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
              );
            })}
          </select>
        </div>

        {selectedInvoice && selectedInvoiceSummary && (() => {
          const parsedNet = parseFloat(amount) || 0;
          const parsedGross =
            paymentMode === 'FULL'
              ? selectedInvoiceSummary.remainingAmount
              : parseFloat(grossAmountInput) || 0;
          const remainingAfter = Math.max(
            0,
            Number((selectedInvoiceSummary.remainingAmount - parsedGross).toFixed(2))
          );
          const exceedsBalance = parsedGross > selectedInvoiceSummary.remainingAmount + 0.005;
          const netInvalidAfterDeductions = deductionsTotal > 0 && parsedNet <= 0;
          const profRef = getInvoiceProformaRef(selectedInvoice);
          const defRef = getInvoiceDefinitiveRef(selectedInvoice);
          const halfAmount = Number((selectedInvoice.totalAmount / 2).toFixed(2));
          const suggestion = getSuggestedNextTranche(selectedInvoice, selectedInvoiceSummary);

          return (
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-4">
              {selectedInvoice.paymentScheme === '50_LC_50_VIREMENT' && (
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold">Dossier Mixte 50 % LC + 50 % Virement · </span>
                    <span>{suggestion.label}</span>
                  </div>
                  <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-indigo-200">
                    {profRef ? `Proforma : ${profRef.number}` : ''}
                    {profRef && defRef ? ' · ' : ''}
                    {defRef ? `Facture Déf. : ${defRef.number}` : ''}
                  </span>
                </div>
              )}

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

              {/* Document justificatif de cet ordre (Proforma vs Facture Définitive) */}
              {(profRef || selectedInvoice.paymentScheme === '50_LC_50_VIREMENT') && (
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Document justificatif de cet ordre
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {profRef && (
                        <button
                          type="button"
                          onClick={() => handleDocumentBasisChange('PROFORMA')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            documentBasis === 'PROFORMA'
                              ? 'bg-indigo-700 text-white border-indigo-700'
                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Proforma ({profRef.number})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDocumentBasisChange('FACTURE_DEFINITIVE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          documentBasis === 'FACTURE_DEFINITIVE'
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {defRef
                          ? `Facture Définitive (${defRef.number})`
                          : 'Facture Définitive (à saisir)'}
                      </button>
                    </div>
                  </div>

                  {documentBasis === 'FACTURE_DEFINITIVE' && !defRef && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-2.5">
                      <div className="text-xs font-bold text-amber-950">
                        Renseigner la Facture Définitive reçue pour ce Virement (sans modifier le montant total du dossier)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                            N° Facture Définitive <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ex : FAC-DEF-2026-088"
                            value={inlineDefinitiveNumber}
                            onChange={e => {
                              const val = e.target.value;
                              setInlineDefinitiveNumber(val);
                              setInvoiceNumber(val);
                            }}
                            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                            Date Facture Définitive
                          </label>
                          <input
                            type="date"
                            value={inlineDefinitiveDate}
                            onChange={e => {
                              const val = e.target.value;
                              setInlineDefinitiveDate(val);
                              setInvoiceDate(val);
                            }}
                            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {documentBasis === 'FACTURE_DEFINITIVE' && profRef && (
                    <div className="text-[11px] text-slate-600">
                      Rappel automatique sur l&apos;imprimé Demi-A4 :{' '}
                      <strong className="font-mono text-slate-800">
                        sur Proforma {profRef.number}
                        {profRef.date ? ` (${profRef.date})` : ''}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {selectedInvoiceSummary.linkedOrders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="font-semibold">Ordres précédents :</span>
                  {selectedInvoiceSummary.linkedOrders.map(o => (
                    <span
                      key={o.id}
                      className="px-2 py-0.5 rounded bg-white border border-blue-200 font-mono text-blue-800"
                    >
                      {o.orderNumber} ({o.amount.toLocaleString('fr-FR')} {o.currency}
                      {o.documentBasis === 'PROFORMA'
                        ? ` · Proforma ${o.invoiceNumber}`
                        : ` · Facture ${o.invoiceNumber}`}
                      {(o.deductionsTotal || 0) > 0
                        ? ` · Déd. -${(o.deductionsTotal || 0).toLocaleString('fr-FR')}`
                        : ''}
                      )
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('FULL');
                    const rem = selectedInvoiceSummary.remainingAmount;
                    setGrossAmountInput(String(rem));
                    syncNetFromGross(rem, deductionsTotal);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMode === 'FULL'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Règlement total du solde ({selectedInvoiceSummary.remainingAmount.toLocaleString('fr-FR')} {selectedInvoice.currency})
                </button>
                {selectedInvoice.paymentScheme === '50_LC_50_VIREMENT' &&
                  halfAmount < selectedInvoiceSummary.remainingAmount - 0.005 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('PARTIAL');
                        setGrossAmountInput(String(halfAmount));
                        syncNetFromGross(halfAmount, deductionsTotal);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        paymentMode === 'PARTIAL' &&
                        Math.abs((parseFloat(grossAmountInput) || 0) - halfAmount) <= 0.01
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      50 % Tranche ({halfAmount.toLocaleString('fr-FR')} {selectedInvoice.currency})
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('PARTIAL');
                    if (!grossAmountInput) {
                      setGrossAmountInput(String(selectedInvoiceSummary.remainingAmount));
                    }
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

              {paymentMode === 'PARTIAL' && (
                <div className="bg-white rounded-lg border border-amber-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label
                      htmlFor="grossAmountInput"
                      className="block text-xs font-bold text-slate-800"
                    >
                      Montant brut imputé sur la facture ({selectedInvoice.currency})
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Montant de la tranche facturée avant déduction des frais ou retenues ci-dessous.
                    </p>
                  </div>
                  <input
                    id="grossAmountInput"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={grossAmountInput}
                    onChange={e => {
                      const val = e.target.value;
                      setGrossAmountInput(val);
                      const num = parseFloat(val);
                      if (!isNaN(num) && Math.abs(num - selectedInvoiceSummary.remainingAmount) <= 0.005) {
                        setPaymentMode('FULL');
                      }
                      syncNetFromGross(num, deductionsTotal);
                    }}
                    className="w-full sm:w-52 bg-slate-50 border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                  />
                </div>
              )}

              {/* Déductions, Frais d'enregistrement & Retenues sur facture */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <MinusCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Déductions, Frais d’Enregistrement & Retenues sur Facture
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Les montants déduits sont retranchés du montant brut facture pour obtenir le net à transférer.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDeduction('FRAIS_ENREGISTREMENT')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter une déduction / frais</span>
                  </button>
                </div>

                {/* Quick preset shortcuts */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-1">Ajout rapide :</span>
                  {(
                    [
                      'FRAIS_ENREGISTREMENT',
                      'RETENUE_SOURCE',
                      'PENALITE_RETARD',
                      'AVOIR_REMISE',
                      'FRAIS_BANCAIRES',
                      'DROITS_TIMBRE',
                    ] as OrderDeductionCategory[]
                  ).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleAddDeduction(cat)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition-colors"
                    >
                      + {DEDUCTION_CATEGORY_META[cat].shortLabel}
                    </button>
                  ))}
                </div>

                {deductions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {deductions.map((ded, idx) => {
                      const catMeta = DEDUCTION_CATEGORY_META[ded.category];
                      return (
                        <div
                          key={ded.id}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 items-end"
                        >
                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              Nature / Catégorie
                            </label>
                            <select
                              aria-label={`Catégorie déduction ${idx + 1}`}
                              value={ded.category}
                              onChange={e =>
                                handleUpdateDeduction(ded.id, {
                                  category: e.target.value as OrderDeductionCategory,
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            >
                              {(
                                Object.keys(DEDUCTION_CATEGORY_META) as OrderDeductionCategory[]
                              ).map(catKey => (
                                <option key={catKey} value={catKey}>
                                  {DEDUCTION_CATEGORY_META[catKey].label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              Libellé / Motif de la déduction
                            </label>
                            <input
                              type="text"
                              aria-label={`Libellé déduction ${idx + 1}`}
                              placeholder={catMeta.label}
                              value={ded.label}
                              onChange={e =>
                                handleUpdateDeduction(ded.id, { label: e.target.value })
                              }
                              className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              Réf. pièce (optionnel)
                            </label>
                            <input
                              type="text"
                              aria-label={`Référence déduction ${idx + 1}`}
                              placeholder={catMeta.placeholderRef}
                              value={ded.reference}
                              onChange={e =>
                                handleUpdateDeduction(ded.id, { reference: e.target.value })
                              }
                              className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              Montant ({selectedInvoice.currency})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`Montant déduction ${idx + 1}`}
                              placeholder="0.00"
                              value={ded.amount}
                              onChange={e =>
                                handleUpdateDeduction(ded.id, { amount: e.target.value })
                              }
                              className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveDeduction(ded.id)}
                              aria-label={`Supprimer la déduction ${ded.label || idx + 1}`}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-md border border-transparent hover:border-rose-200 transition-colors"
                              title="Supprimer cette déduction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Récapitulatif Brut - Déductions = Net à transférer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="text-slate-600">Brut imputé facture</span>
                    <span className="font-mono font-bold text-slate-900">
                      {parsedGross.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <span className="text-amber-800">Total déductions / frais</span>
                    <span className="font-mono font-bold text-amber-900">
                      − {deductionsTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
                    <span className="font-semibold text-blue-900">Net à transférer</span>
                    <span className="font-mono font-extrabold text-blue-950">
                      {parsedNet.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                </div>
              </div>

              {exceedsBalance && (
                <div className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Le montant brut imputé ({parsedGross.toLocaleString('fr-FR')} {selectedInvoice.currency}) dépasse le solde restant de la facture ({selectedInvoiceSummary.remainingAmount.toLocaleString('fr-FR')} {selectedInvoice.currency}).
                  </span>
                </div>
              )}

              {netInvalidAfterDeductions && (
                <div className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Le total des déductions ({deductionsTotal.toLocaleString('fr-FR')} {selectedInvoice.currency}) doit être strictement inférieur au montant brut imputé ({parsedGross.toLocaleString('fr-FR')} {selectedInvoice.currency}).
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

        {/* Structure Numéro d'ordre : 000 UTILISATEUR 000 ANNEE 0000 ORDRE (génération automatique) */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Numéro d'Ordre Structuré{' '}
              <span className="font-mono text-slate-400 font-normal">
                (000 UTILISATEUR · 000 ANNÉE · 0000 ORDRE)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Lock className="w-3 h-3" />
                Généré automatiquement
              </span>
              <span
                data-testid="auto-order-number-preview"
                className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200"
              >
                {autoOrderNumber}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-center gap-1">
                <span>000 Utilisateur</span>
              </div>
              <div
                aria-label="000 Utilisateur généré automatiquement"
                className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 text-center select-all"
              >
                {userPart}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">
                Code agent ({currentUser.name.split(' ')[0]})
              </span>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1 text-center">
                000 Année
              </div>
              <div
                aria-label="000 Année générée automatiquement"
                className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 text-center select-all"
              >
                {yearPart}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">
                Exercice {currentYear}
              </span>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1 text-center">
                0000 Ordre
              </div>
              <div
                aria-label="0000 Ordre généré automatiquement"
                className="w-full bg-slate-100 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-slate-800 text-center select-all"
              >
                {seqPart}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block text-center">
                Séquence chrono auto
              </span>
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
              {selectedInvoice && deductionsTotal > 0
                ? 'Montant Net à Transférer (après déductions)'
                : 'Montant à Transférer'}{' '}
              <span className="text-rose-500">*</span>
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
                  if (!isNaN(num)) {
                    const nextGross = Number((num + deductionsTotal).toFixed(2));
                    setGrossAmountInput(String(nextGross));
                    if (Math.abs(nextGross - selectedInvoiceSummary.remainingAmount) > 0.005) {
                      setPaymentMode('PARTIAL');
                    } else {
                      setPaymentMode('FULL');
                    }
                  } else {
                    setGrossAmountInput('');
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
              {selectedInvoice && documentBasis === 'PROFORMA'
                ? 'Référence de la Proforma'
                : selectedInvoice
                ? 'Référence de la Facture Définitive'
                : 'Référence de la Facture'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : FAC-2026-9901"
              value={invoiceNumber}
              onChange={e => {
                const val = e.target.value;
                setInvoiceNumber(val);
                if (
                  selectedInvoice &&
                  documentBasis === 'FACTURE_DEFINITIVE' &&
                  !getInvoiceDefinitiveRef(selectedInvoice)
                ) {
                  setInlineDefinitiveNumber(val);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            {selectedInvoice &&
              documentBasis === 'FACTURE_DEFINITIVE' &&
              getInvoiceProformaRef(selectedInvoice) && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Rappel Proforma d&apos;origine :{' '}
                  <span className="font-mono font-semibold text-slate-700">
                    {getInvoiceProformaRef(selectedInvoice)?.number}
                    {getInvoiceProformaRef(selectedInvoice)?.date
                      ? ` (${getInvoiceProformaRef(selectedInvoice)?.date})`
                      : ''}
                  </span>
                </div>
              )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {selectedInvoice && documentBasis === 'PROFORMA'
                ? 'Date de la Proforma'
                : 'Date de la Facture'}
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => {
                const val = e.target.value;
                setInvoiceDate(val);
                if (
                  selectedInvoice &&
                  documentBasis === 'FACTURE_DEFINITIVE' &&
                  !getInvoiceDefinitiveRef(selectedInvoice)
                ) {
                  setInlineDefinitiveDate(val);
                }
              }}
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
