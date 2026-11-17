import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Building2,
  FilePlus2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Paperclip,
  Upload,
  FileText,
  X,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Globe,
  Landmark,
  Download,
  Printer,
  Pencil,
} from 'lucide-react';
import {
  Invoice,
  InvoicePaymentScheme,
  InvoicePaymentStatus,
  PaymentOrder,
  Supplier,
  User,
  PaymentDocument,
} from '../types/payment';
import {
  computeInvoicePaymentSummary,
  getInvoiceDefinitiveRef,
  getInvoiceProformaRef,
  getOrderDeductionsTotal,
  getOrderInvoiceGrossAmount,
} from '../utils/invoiceUtils';
import { STATUS_META } from '../utils/workflowRules';
import { downloadTablePdf } from '../utils/tablePdf';
import { canUserManageInvoice, isAdministrator } from '../utils/adminRules';
import { AdminEditInvoiceModal } from './AdminEditInvoiceModal';
import { AdminConfirmDeleteModal } from './AdminConfirmDeleteModal';

interface InvoicesViewProps {
  invoices: Invoice[];
  orders: PaymentOrder[];
  suppliers: Supplier[];
  currentUser: User;
  onCreateInvoice: (payload: Partial<Invoice>) => Promise<Invoice>;
  onUpdateInvoice?: (id: string, payload: Partial<Invoice>) => Promise<Invoice>;
  onAttachDefinitiveInvoice?: (
    id: string,
    payload: {
      definitiveInvoiceNumber: string;
      definitiveInvoiceDate?: string;
      document?: Omit<PaymentDocument, 'id' | 'orderId'>;
    }
  ) => Promise<Invoice>;
  onDeleteInvoice: (id: string) => Promise<void>;
  onCreateOrderFromInvoice: (invoiceId: string) => void;
  onSelectOrder: (orderId: string) => void;
}

const STATUS_BADGE: Record<
  InvoicePaymentStatus,
  { label: string; badgeClass: string; barClass: string }
> = {
  NON_PAYEE: {
    label: 'Non payée',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    barClass: 'bg-slate-400',
  },
  PARTIELLEMENT_PAYEE: {
    label: 'Partiellement payée',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    barClass: 'bg-amber-500',
  },
  PAYEE: {
    label: 'Payée (Soldée)',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    barClass: 'bg-emerald-600',
  },
};

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  orders,
  suppliers,
  currentUser,
  onCreateInvoice,
  onUpdateInvoice,
  onAttachDefinitiveInvoice,
  onDeleteInvoice,
  onCreateOrderFromInvoice,
  onSelectOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoicePaymentStatus>('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceEntry, setEditingInvoiceEntry] = useState<{
    invoice: Invoice;
    linkedOrdersCount: number;
    allocatedAmount: number;
  } | null>(null);
  const [adminDeleteEntry, setAdminDeleteEntry] = useState<{
    invoice: Invoice;
    linkedOrdersCount: number;
  } | null>(null);

  // Inline attach definitive invoice state (detail view)
  const [attachDefNumber, setAttachDefNumber] = useState('');
  const [attachDefDate, setAttachDefDate] = useState(new Date().toISOString().split('T')[0]);
  const [attachDefDoc, setAttachDefDoc] = useState<Omit<PaymentDocument, 'id' | 'orderId'> | undefined>(
    undefined
  );
  const [attachDefError, setAttachDefError] = useState<string | null>(null);
  const [isAttachingDef, setIsAttachingDef] = useState(false);

  const isAdmin = isAdministrator(currentUser);

  // Create form fields
  const todayStr = new Date().toISOString().split('T')[0];
  const [paymentScheme, setPaymentScheme] = useState<InvoicePaymentScheme>('STANDARD');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [proformaNumber, setProformaNumber] = useState('');
  const [proformaDate, setProformaDate] = useState(todayStr);
  const [definitiveInvoiceNumber, setDefinitiveInvoiceNumber] = useState('');
  const [definitiveInvoiceDate, setDefinitiveInvoiceDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierBank, setSupplierBank] = useState('');
  const [supplierIban, setSupplierIban] = useState('');
  const [supplierSwift, setSupplierSwift] = useState('');
  const [currency, setCurrency] = useState<Invoice['currency']>('EUR');
  const [totalAmount, setTotalAmount] = useState('');
  const [operationNature, setOperationNature] = useState('Importation tabac brut');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<
    Array<Omit<PaymentDocument, 'id' | 'orderId'>>
  >([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enrichedInvoices = useMemo(() => {
    return invoices.map(invoice => ({
      invoice,
      summary: computeInvoicePaymentSummary(invoice, orders),
    }));
  }, [invoices, orders]);

  const selectedInvoiceEntry = useMemo(
    () => enrichedInvoices.find(item => item.invoice.id === selectedInvoiceId) || null,
    [enrichedInvoices, selectedInvoiceId]
  );

  const stats = useMemo(() => {
    const total = enrichedInvoices.length;
    const unpaidOrPartial = enrichedInvoices.filter(
      item => item.summary.paymentStatus !== 'PAYEE'
    ).length;
    const paid = enrichedInvoices.filter(
      item => item.summary.paymentStatus === 'PAYEE'
    ).length;

    const remainingByCurrency: Record<string, number> = {};
    enrichedInvoices.forEach(({ invoice, summary }) => {
      if (summary.remainingAmount > 0.005) {
        remainingByCurrency[invoice.currency] =
          (remainingByCurrency[invoice.currency] || 0) + summary.remainingAmount;
      }
    });

    return { total, unpaidOrPartial, paid, remainingByCurrency };
  }, [enrichedInvoices]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedInvoices.filter(({ invoice, summary }) => {
      if (statusFilter !== 'ALL' && summary.paymentStatus !== statusFilter) {
        return false;
      }
      if (q) {
        const matches =
          invoice.invoiceNumber.toLowerCase().includes(q) ||
          (invoice.proformaNumber || '').toLowerCase().includes(q) ||
          (invoice.definitiveInvoiceNumber || '').toLowerCase().includes(q) ||
          invoice.supplierName.toLowerCase().includes(q) ||
          (invoice.contractNumber || '').toLowerCase().includes(q) ||
          invoice.purpose.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [enrichedInvoices, searchQuery, statusFilter]);

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setPaymentScheme('STANDARD');
    setInvoiceNumber('');
    setInvoiceDate(today);
    setProformaNumber('');
    setProformaDate(today);
    setDefinitiveInvoiceNumber('');
    setDefinitiveInvoiceDate(today);
    setDueDate('');
    setContractNumber('');
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierCountry('');
    setSupplierAddress('');
    setSupplierBank('');
    setSupplierIban('');
    setSupplierSwift('');
    setCurrency('EUR');
    setTotalAmount('');
    setOperationNature('Importation tabac brut');
    setPurpose('');
    setNotes('');
    setDocuments([]);
    setFormError(null);
  };

  const handleSelectSupplier = (id: string) => {
    setSelectedSupplierId(id);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setDocuments(prev => [
          ...prev,
          {
            name: file.name,
            type: 'FACTURE',
            size: file.size,
            mimeType: file.type || 'application/pdf',
            uploadedAt: new Date().toISOString(),
            uploadedBy: currentUser.name,
            dataBase64: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedProf = proformaNumber.trim();
    const trimmedDef = definitiveInvoiceNumber.trim();
    const trimmedStd = invoiceNumber.trim();

    if (paymentScheme === '50_LC_50_VIREMENT') {
      if (!trimmedProf) {
        setFormError(
          'Pour un dossier 50 % LC + 50 % Virement, veuillez renseigner le N° de Facture Proforma.'
        );
        return;
      }
    } else if (!trimmedStd && !trimmedProf) {
      setFormError('Veuillez renseigner le numéro de facture.');
      return;
    }

    if (!supplierName.trim()) {
      setFormError('Veuillez renseigner le fournisseur / bénéficiaire.');
      return;
    }
    const parsedAmount = parseFloat(totalAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Veuillez saisir un montant total valide supérieur à 0.');
      return;
    }
    if (!purpose.trim()) {
      setFormError('Veuillez renseigner l’objet / désignation du dossier.');
      return;
    }

    try {
      setIsSubmitting(true);
      const effectivePayload: Partial<Invoice> =
        paymentScheme === '50_LC_50_VIREMENT'
          ? {
              paymentScheme: '50_LC_50_VIREMENT',
              proformaNumber: trimmedProf,
              proformaDate: proformaDate || todayStr,
              definitiveInvoiceNumber: trimmedDef || undefined,
              definitiveInvoiceDate: trimmedDef
                ? definitiveInvoiceDate || todayStr
                : undefined,
              invoiceNumber: trimmedDef || trimmedProf,
              invoiceDate: trimmedDef
                ? definitiveInvoiceDate || todayStr
                : proformaDate || todayStr,
            }
          : {
              paymentScheme: 'STANDARD',
              invoiceNumber: trimmedStd || trimmedProf,
              invoiceDate: invoiceDate || proformaDate || todayStr,
              proformaNumber: trimmedProf || undefined,
              proformaDate: trimmedProf ? proformaDate || invoiceDate : undefined,
              definitiveInvoiceNumber: trimmedStd || undefined,
              definitiveInvoiceDate: trimmedStd ? invoiceDate : undefined,
            };

      await onCreateInvoice({
        ...effectivePayload,
        dueDate: dueDate || undefined,
        contractNumber: contractNumber.trim() || undefined,
        supplierId: selectedSupplierId || undefined,
        supplierName: supplierName.trim(),
        supplierCountry: supplierCountry.trim(),
        supplierAddress: supplierAddress.trim(),
        supplierBank: supplierBank.trim(),
        supplierIban: supplierIban.trim(),
        supplierSwift: supplierSwift.trim().toUpperCase(),
        currency,
        totalAmount: parsedAmount,
        operationNature,
        purpose: purpose.trim(),
        notes: notes.trim() || undefined,
        documents,
        isDemo: false,
      });
      resetForm();
      setShowCreateForm(false);
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de l’ajout de la facture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachDefinitiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceEntry || !onAttachDefinitiveInvoice) return;
    setAttachDefError(null);
    if (!attachDefNumber.trim()) {
      setAttachDefError('Veuillez saisir le N° de la Facture Définitive reçue.');
      return;
    }
    try {
      setIsAttachingDef(true);
      await onAttachDefinitiveInvoice(selectedInvoiceEntry.invoice.id, {
        definitiveInvoiceNumber: attachDefNumber.trim(),
        definitiveInvoiceDate: attachDefDate || undefined,
        document: attachDefDoc,
      });
      setAttachDefNumber('');
      setAttachDefDoc(undefined);
    } catch (err: any) {
      setAttachDefError(
        err.message || 'Erreur lors de l’enregistrement de la facture définitive'
      );
    } finally {
      setIsAttachingDef(false);
    }
  };

  const formatMoney = (val: number, cur: string) =>
    `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  const remainingSummaryEntries = Object.entries(stats.remainingByCurrency);

  // Detail View when user clicks an invoice row
  if (selectedInvoiceEntry) {
    const { invoice, summary } = selectedInvoiceEntry;
    const statusMeta = STATUS_BADGE[summary.paymentStatus];
    const canCreateOrder = summary.remainingAmount > 0.005;
    const canManageInvoice = canUserManageInvoice(currentUser, invoice).allowed;
    const profRef = getInvoiceProformaRef(invoice);
    const defRef = getInvoiceDefinitiveRef(invoice);
    const isMixedScheme = invoice.paymentScheme === '50_LC_50_VIREMENT';

    return (
      <div className="space-y-5 max-w-6xl mx-auto pb-12">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedInvoiceId(null);
              }}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              title="Retour au tableau des factures"
              aria-label="Retour au tableau des factures"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold font-mono text-blue-700 whitespace-nowrap">
                  {invoice.invoiceNumber}
                </span>
                {isMixedScheme && (
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 whitespace-nowrap">
                    50 % LC (Proforma) + 50 % Virement (Facture Déf.)
                  </span>
                )}
                {profRef && !defRef && (
                  <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                    Sur Proforma · Attente Facture Définitive
                  </span>
                )}
                {invoice.isDemo && (
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                    DONNÉE DE DÉMO
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${statusMeta.badgeClass}`}
                >
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{invoice.purpose}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canCreateOrder && (
              <button
                type="button"
                onClick={() => onCreateOrderFromInvoice(invoice.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition-colors shadow-xs whitespace-nowrap"
              >
                <FilePlus2 className="w-4 h-4" />
                <span>Créer un Ordre de Paiement</span>
              </button>
            )}

            {canManageInvoice && onUpdateInvoice && (
              <button
                type="button"
                onClick={() =>
                  setEditingInvoiceEntry({
                    invoice,
                    linkedOrdersCount: summary.linkedOrders.length,
                    allocatedAmount: summary.allocatedAmount,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            )}

            {canManageInvoice && (
              <button
                type="button"
                onClick={() =>
                  setAdminDeleteEntry({
                    invoice,
                    linkedOrdersCount: summary.linkedOrders.length,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>
            )}
          </div>
        </div>

        {/* Financial Summary & Progress Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Montant Total Facture
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatMoney(invoice.totalAmount, invoice.currency)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                Déjà Ordonnancé (Brut)
              </div>
              <div className="text-lg font-bold font-mono text-blue-900 mt-1">
                {formatMoney(summary.allocatedAmount, invoice.currency)}
              </div>
              {summary.deductionsTotal > 0 && (
                <div className="text-[11px] text-blue-800/80 mt-0.5 font-mono">
                  Net : {formatMoney(summary.netOrderedAmount, invoice.currency)} · Déd. : −
                  {formatMoney(summary.deductionsTotal, invoice.currency)}
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Reste à Payer
              </div>
              <div
                className={`text-lg font-bold font-mono mt-1 ${
                  summary.remainingAmount > 0.005 ? 'text-amber-900' : 'text-emerald-700'
                }`}
              >
                {formatMoney(summary.remainingAmount, invoice.currency)}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Taux de Règlement
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                {summary.progressPercent}% ({summary.linkedOrders.length} ordre
                {summary.linkedOrders.length > 1 ? 's' : ''})
              </div>
            </div>
          </div>

          <div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-300 ${statusMeta.barClass}`}
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Attach Definitive Invoice Inline Card when Dossier started on Proforma */}
        {profRef && !defRef && onAttachDefinitiveInvoice && (
          <form
            onSubmit={handleAttachDefinitiveSubmit}
            className="bg-amber-50/70 rounded-xl border-2 border-amber-300 p-5 shadow-2xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>Renseigner la Facture Définitive reçue</span>
                </h3>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Ce dossier est actuellement ouvert sur Proforma{' '}
                  <strong className="font-mono">{profRef.number}</strong>. Rattachez la Facture
                  Définitive pour l’émission du Virement : le montant total du dossier (
                  <strong className="font-mono">
                    {formatMoney(invoice.totalAmount, invoice.currency)}
                  </strong>
                  ) reste inchangé.
                </p>
              </div>
            </div>

            {attachDefError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{attachDefError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                  N° Facture Définitive <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex : FAC-DEF-2026-088"
                  value={attachDefNumber}
                  onChange={e => setAttachDefNumber(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                  Date Facture Définitive
                </label>
                <input
                  type="date"
                  value={attachDefDate}
                  onChange={e => setAttachDefDate(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-white border border-amber-300 hover:bg-amber-100/50 rounded-lg text-xs font-semibold text-amber-900 cursor-pointer truncate">
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {attachDefDoc ? attachDefDoc.name : 'Joindre PDF (optionnel)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setAttachDefDoc({
                          name: file.name,
                          type: 'FACTURE',
                          docRole: 'FACTURE_DEFINITIVE',
                          size: file.size,
                          mimeType: file.type || 'application/pdf',
                          uploadedAt: new Date().toISOString(),
                          uploadedBy: currentUser.name,
                          dataBase64: reader.result as string,
                        });
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isAttachingDef}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isAttachingDef ? 'Enreg...' : 'Valider'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Details Grid: Invoice Info & Supplier Bank */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* General Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Informations du Dossier d&apos;Engagement</span>
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-slate-500">Réf. Proforma (LC)</dt>
                <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                  {profRef ? (
                    <>
                      {profRef.number}
                      {profRef.date ? (
                        <span className="text-slate-500 font-normal"> ({profRef.date})</span>
                      ) : null}
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Réf. Facture Définitive</dt>
                <dd className="font-mono font-bold text-blue-700 mt-0.5">
                  {defRef ? (
                    <>
                      {defRef.number}
                      {defRef.date ? (
                        <span className="text-slate-500 font-normal"> ({defRef.date})</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-amber-700 font-sans font-semibold">
                      En attente de réception
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Schéma de règlement</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {isMixedScheme
                    ? '50 % LC (Proforma) + 50 % Virement'
                    : 'Standard'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">N° Contrat / Marché</dt>
                <dd className="font-mono font-semibold text-blue-700 mt-0.5">
                  {invoice.contractNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Date document actif</dt>
                <dd className="font-mono text-slate-900 mt-0.5">{invoice.invoiceDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Date d&apos;Échéance</dt>
                <dd className="font-mono text-slate-900 mt-0.5">{invoice.dueDate || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Nature de l&apos;opération</dt>
                <dd className="font-medium text-slate-900 mt-0.5">{invoice.operationNature}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Objet / Désignation</dt>
                <dd className="text-slate-900 mt-0.5">{invoice.purpose}</dd>
              </div>
              {invoice.notes && (
                <div className="col-span-2">
                  <dt className="text-slate-500">Observations / Modalités</dt>
                  <dd className="text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-1">
                    {invoice.notes}
                  </dd>
                </div>
              )}
              <div className="col-span-2 pt-1 text-[11px] text-slate-400">
                Saisie par {invoice.createdBy} · {invoice.createdAt.split('T')[0]}
              </div>
            </dl>
          </div>

          {/* Supplier & Bank Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>Fournisseur & Coordonnées Bancaires</span>
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div className="col-span-2">
                <dt className="text-slate-500">Raison Sociale</dt>
                <dd className="font-bold text-slate-900 mt-0.5">{invoice.supplierName}</dd>
              </div>
              <div>
                <dt className="text-slate-500 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>Pays</span>
                </dt>
                <dd className="font-medium text-slate-900 mt-0.5">{invoice.supplierCountry || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Code SWIFT / BIC</dt>
                <dd className="font-mono font-bold text-slate-900 mt-0.5">
                  {invoice.supplierSwift || '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Adresse</dt>
                <dd className="text-slate-800 mt-0.5">{invoice.supplierAddress || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500 flex items-center gap-1">
                  <Landmark className="w-3 h-3" />
                  <span>Banque Étrangère</span>
                </dt>
                <dd className="font-medium text-slate-900 mt-0.5">{invoice.supplierBank || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">IBAN / Numéro de Compte</dt>
                <dd className="font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 mt-0.5 break-all">
                  {invoice.supplierIban || '—'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Linked Payment Orders Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ordres de Paiement Rattachés ({summary.linkedOrders.length})
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadTablePdf({
                    title: `Ordres de Paiement - Facture ${invoice.invoiceNumber}`,
                    subtitle: `${invoice.supplierName} | Montant : ${formatMoney(
                      invoice.totalAmount,
                      invoice.currency
                    )} | Reste à payer : ${formatMoney(
                      summary.remainingAmount,
                      invoice.currency
                    )}`,
                    filename: `Facture_${invoice.invoiceNumber}_Ordres_MTK.pdf`,
                    columns: [
                      { header: 'N° Ordre', widthRatio: 1.2 },
                      { header: 'Date Création', widthRatio: 0.9 },
                      { header: 'Banque MTK', widthRatio: 1.6 },
                      { header: 'Mode', widthRatio: 0.9 },
                      { header: 'Déductions', align: 'right', widthRatio: 1.1 },
                      { header: 'Montant Net / Imputé', align: 'right', widthRatio: 1.4 },
                      { header: 'Statut', widthRatio: 1.2 },
                    ],
                    rows: summary.linkedOrders.map(ord => {
                      const dedTotal = getOrderDeductionsTotal(ord);
                      const grossAmt = getOrderInvoiceGrossAmount(ord);
                      return [
                        ord.orderNumber,
                        ord.createdAt.split('T')[0],
                        ord.bankName,
                        ord.transferType || 'VIREMENT',
                        dedTotal > 0 ? `-${formatMoney(dedTotal, ord.currency)}` : '—',
                        dedTotal > 0
                          ? `${formatMoney(ord.amount, ord.currency)} (Brut ${formatMoney(
                              grossAmt,
                              ord.currency
                            )})`
                          : formatMoney(ord.amount, ord.currency),
                        STATUS_META[ord.status]?.label || ord.status,
                      ];
                    }),
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimer tableau PDF</span>
              </button>
              {canCreateOrder && (
                <button
                  type="button"
                  onClick={() => onCreateOrderFromInvoice(invoice.id)}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Émettre un ordre sur cette facture</span>
                </button>
              )}
            </div>
          </div>

          {summary.linkedOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p>Aucun ordre de paiement n'est encore rattaché à cette facture.</p>
              {canCreateOrder && (
                <button
                  type="button"
                  onClick={() => onCreateOrderFromInvoice(invoice.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Créer le premier ordre</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">N° Ordre</th>
                    <th className="py-2.5 px-4">Date Création</th>
                    <th className="py-2.5 px-4">Banque MTK</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4 text-right">Montant Ordonnancé</th>
                    <th className="py-2.5 px-4">Statut</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.linkedOrders.map(ord => {
                    const ordMeta = STATUS_META[ord.status];
                    const dedTotal = getOrderDeductionsTotal(ord);
                    const grossAmt = getOrderInvoiceGrossAmount(ord);
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => onSelectOrder(ord.id)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          <div>{ord.orderNumber}</div>
                          <div className="text-[10px] font-normal text-slate-500">
                            {ord.documentBasis === 'PROFORMA'
                              ? `Proforma : ${ord.invoiceNumber}`
                              : `Facture : ${ord.invoiceNumber}`}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {ord.createdAt.split('T')[0]}
                        </td>
                        <td className="py-3 px-4 text-slate-800">{ord.bankName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{ord.transferType || 'VIREMENT'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div>{formatMoney(ord.amount, ord.currency)}</div>
                          {dedTotal > 0 && (
                            <div className="text-[10px] font-normal text-amber-700">
                              Brut {formatMoney(grossAmt, ord.currency)} · Déd. −
                              {formatMoney(dedTotal, ord.currency)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              ordMeta?.badgeBg || 'bg-slate-100'
                            } ${ordMeta?.badgeText || 'text-slate-700'} ${
                              ordMeta?.badgeBorder || 'border-slate-200'
                            }`}
                          >
                            {ordMeta?.label || ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                            <span>Ouvrir</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attached Documents */}
        {invoice.documents && invoice.documents.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Pièces Jointes ({invoice.documents.length})
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {invoice.documents.map(doc => (
                <div
                  key={doc.id}
                  className="inline-flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-medium text-slate-800">{doc.name}</span>
                  {doc.dataBase64 && (
                    <a
                      href={doc.dataBase64}
                      download={doc.name}
                      className="text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {editingInvoiceEntry && onUpdateInvoice && (
          <AdminEditInvoiceModal
            invoice={editingInvoiceEntry.invoice}
            suppliers={suppliers}
            linkedOrdersCount={editingInvoiceEntry.linkedOrdersCount}
            allocatedAmount={editingInvoiceEntry.allocatedAmount}
            isAdmin={isAdmin}
            onSave={async (id, payload) => {
              await onUpdateInvoice(id, payload);
            }}
            onClose={() => setEditingInvoiceEntry(null)}
          />
        )}

        {adminDeleteEntry && (
          <AdminConfirmDeleteModal
            title="Supprimer définitivement cette facture"
            entityRef={adminDeleteEntry.invoice.invoiceNumber}
            description={`Vous êtes sur le point de supprimer la facture ${adminDeleteEntry.invoice.invoiceNumber} (${adminDeleteEntry.invoice.supplierName} — ${formatMoney(adminDeleteEntry.invoice.totalAmount, adminDeleteEntry.invoice.currency)}).`}
            warningNote={
              adminDeleteEntry.linkedOrdersCount > 0
                ? `${adminDeleteEntry.linkedOrdersCount} ordre(s) de paiement sont actuellement rattaché(s) à cette facture : leur lien vers cette facture sera détaché automatiquement (les ordres resteront conservés).`
                : undefined
            }
            onConfirm={async () => {
              await onDeleteInvoice(adminDeleteEntry.invoice.id);
              setSelectedInvoiceId(null);
            }}
            onClose={() => setAdminDeleteEntry(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Module 00 · Point d'Entrée du Processus
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1.5 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-700" />
            <span>Gestion des Factures Fournisseurs</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enregistrez les factures fournisseurs avant d'émettre les ordres de paiement. Chaque facture peut être réglée en un seul ordre ou fractionnée sur plusieurs ordres.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setShowCreateForm(prev => !prev);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs whitespace-nowrap"
        >
          {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showCreateForm ? 'Fermer le formulaire' : 'Ajouter une Facture'}</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Factures</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Factures enregistrées</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>À régler / En cours</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">{stats.unpaidOrPartial}</div>
          <div className="text-[11px] text-slate-400 mt-1">Disponibles pour Nouvel Ordre</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Factures Soldées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">{stats.paid}</div>
          <div className="text-[11px] text-slate-400 mt-1">100 % ordonnancées</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Reste à ordonnancer</span>
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 space-y-0.5">
            {remainingSummaryEntries.length > 0 ? (
              remainingSummaryEntries.slice(0, 2).map(([cur, amt]) => (
                <div key={cur} className="text-sm font-bold text-slate-900 font-mono">
                  {formatMoney(amt, cur)}
                </div>
              ))
            ) : (
              <div className="text-sm font-bold text-slate-500 font-mono">0,00</div>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Solde ouvert multi-devises</div>
        </div>
      </div>

      {/* Inline Create Invoice Form */}
      {showCreateForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Nouvelle Facture Fournisseur
              </h3>
              <p className="text-xs text-slate-500">
                Une fois enregistrée, cette facture apparaîtra dans le sélecteur de « Nouvel ordre de paiement ».
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          {/* Schéma de règlement du dossier */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Schéma de Règlement &amp; Références Documentaires
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentScheme('STANDARD')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  paymentScheme === 'STANDARD'
                    ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">
                  Facture Standard (Règlement classique)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Une facture unique (règlement en 1 ou plusieurs ordres) avec Proforma optionnelle.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentScheme('50_LC_50_VIREMENT')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  paymentScheme === '50_LC_50_VIREMENT'
                    ? 'bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-indigo-950">
                  Dossier Mixte : 50 % LC (Proforma) + 50 % Virement (Facture Déf.)
                </div>
                <div className="text-[11px] text-indigo-800/80 mt-0.5">
                  Ouverture sur Proforma pour la LC, puis rattachement de la Facture Définitive pour le Virement.
                </div>
              </button>
            </div>
          </div>

          {/* Row 1: Références facture / Proforma */}
          {paymentScheme === '50_LC_50_VIREMENT' ? (
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-indigo-950 mb-1">
                    N° Proforma (pour la LC) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : PROF-2026-045"
                    value={proformaNumber}
                    onChange={e => setProformaNumber(e.target.value)}
                    className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-950 mb-1">
                    Date Proforma <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={proformaDate}
                    onChange={e => setProformaDate(e.target.value)}
                    className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Facture Définitive (si reçue)
                  </label>
                  <input
                    type="text"
                    placeholder="Laisser vide si en attente"
                    value={definitiveInvoiceNumber}
                    onChange={e => setDefinitiveInvoiceNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date Facture Définitive
                  </label>
                  <input
                    type="date"
                    value={definitiveInvoiceDate}
                    onChange={e => setDefinitiveInvoiceDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date d&apos;Échéance
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Contrat / Marché
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : CT-2026/MTK-042"
                    value={contractNumber}
                    onChange={e => setContractNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>
              {parseFloat(totalAmount) > 0 && (
                <div className="p-2.5 rounded-lg bg-white border border-indigo-200 text-[11px] text-indigo-950 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>Répartition automatique prévue :</strong> Tranche 1 (50 % LC sur Proforma) :{' '}
                    <strong className="font-mono">
                      {formatMoney(Number((parseFloat(totalAmount) / 2).toFixed(2)), currency)}
                    </strong>{' '}
                    · Tranche 2 (50 % Virement sur Facture Définitive) :{' '}
                    <strong className="font-mono">
                      {formatMoney(Number((parseFloat(totalAmount) / 2).toFixed(2)), currency)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Facture <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : FAC-2026-045"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date Facture <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date d&apos;Échéance
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    N° Contrat / Marché
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : CT-2026/MTK-042"
                    value={contractNumber}
                    onChange={e => setContractNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    N° Proforma associée (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : PROF-2026-045 (si issue d'une Proforma)"
                    value={proformaNumber}
                    onChange={e => setProformaNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Date Proforma (si renseignée)
                  </label>
                  <input
                    type="date"
                    value={proformaDate}
                    onChange={e => setProformaDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Row 2: Fournisseur */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Fournisseur / Bénéficiaire
              </span>
              <select
                value={selectedSupplierId}
                onChange={e => handleSelectSupplier(e.target.value)}
                className="text-xs bg-white border border-blue-200 text-blue-800 font-medium rounded-md px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">-- Choisir dans le référentiel fournisseurs --</option>
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
                  Raison Sociale <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nom du fournisseur"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pays
                </label>
                <input
                  type="text"
                  placeholder="Ex : États-Unis, Allemagne..."
                  value={supplierCountry}
                  onChange={e => setSupplierCountry(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Banque du Fournisseur
                </label>
                <input
                  type="text"
                  placeholder="Banque étrangère"
                  value={supplierBank}
                  onChange={e => setSupplierBank(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                  placeholder="Adresse du siège"
                  value={supplierAddress}
                  onChange={e => setSupplierAddress(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  IBAN / Compte
                </label>
                <input
                  type="text"
                  placeholder="IBAN"
                  value={supplierIban}
                  onChange={e => setSupplierIban(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  SWIFT / BIC
                </label>
                <input
                  type="text"
                  placeholder="Code SWIFT"
                  value={supplierSwift}
                  onChange={e => setSupplierSwift(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Montant, Devise, Nature, Objet */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Devise <span className="text-rose-500">*</span>
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as Invoice['currency'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
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
                Montant Total Facture <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Objet / Désignation de la Facture <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex : Importation feuilles de tabac Virginie - Lot Q1 2026"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observations / Modalités (ex : paiement en plusieurs tranches)
              </label>
              <input
                type="text"
                placeholder="Ex : Règlement prévu en 2 tranches (30% acompte + 70% solde)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Upload Facture PDF */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-dashed border-slate-300">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Paperclip className="w-4 h-4 text-blue-600" />
              <span>
                Pièce jointe (Facture PDF/Scan) — sera automatiquement reprise dans les ordres de paiement rattachés.
              </span>
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Joindre PDF / Image</span>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {documents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-medium">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}
                    className="text-blue-500 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreateForm(false);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer la Facture'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par N° facture, fournisseur, contrat ou objet..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: 'Toutes' },
              { id: 'NON_PAYEE', label: 'Non payées' },
              { id: 'PARTIELLEMENT_PAYEE', label: 'Partiellement payées' },
              { id: 'PAYEE', label: 'Payées' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() =>
              downloadTablePdf({
                title: 'Registre des Factures Fournisseurs MTK',
                subtitle: `Filtre statut : ${
                  statusFilter === 'ALL' ? 'Toutes' : STATUS_BADGE[statusFilter].label
                }${searchQuery.trim() ? ` | Recherche : "${searchQuery.trim()}"` : ''}`,
                filename: `Tableau_Factures_MTK_${new Date().toISOString().split('T')[0]}.pdf`,
                columns: [
                  { header: 'N° Facture', widthRatio: 1.2 },
                  { header: 'Date', widthRatio: 0.9 },
                  { header: 'Fournisseur', widthRatio: 2.0 },
                  { header: 'Montant Facture', align: 'right', widthRatio: 1.2 },
                  { header: 'Reste à Payer', align: 'right', widthRatio: 1.2 },
                  { header: 'Statut', widthRatio: 1.2 },
                ],
                rows: filteredInvoices.map(({ invoice, summary }) => [
                  invoice.invoiceNumber,
                  invoice.invoiceDate,
                  invoice.supplierName,
                  formatMoney(invoice.totalAmount, invoice.currency),
                  formatMoney(summary.remainingAmount, invoice.currency),
                  STATUS_BADGE[summary.paymentStatus].label,
                ]),
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Imprimer tableau PDF</span>
          </button>
        </div>
      </div>

      {/* Simple Invoices List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">N° Facture</th>
                <th className="py-3 px-4 whitespace-nowrap">Date</th>
                <th className="py-3 px-4">Fournisseur</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Montant Facture</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Reste à Payer</th>
                <th className="py-3 px-4 whitespace-nowrap">Statut</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Aucune facture ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(({ invoice, summary }) => {
                  const statusMeta = STATUS_BADGE[summary.paymentStatus];
                  const canManageRow = canUserManageInvoice(currentUser, invoice).allowed;
                  const rowProfRef = getInvoiceProformaRef(invoice);
                  const rowDefRef = getInvoiceDefinitiveRef(invoice);
                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => {
                        setSelectedInvoiceId(invoice.id);
                      }}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 group-hover:underline">
                            {invoice.invoiceNumber}
                          </span>
                          {invoice.paymentScheme === '50_LC_50_VIREMENT' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              50% LC / 50% Vir.
                            </span>
                          )}
                          {invoice.isDemo && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Démo
                            </span>
                          )}
                        </div>
                        {rowProfRef && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {rowDefRef
                              ? `Proforma : ${rowProfRef.number}`
                              : 'Proforma seule · Attente Facture Déf.'}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {invoice.invoiceDate}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {invoice.supplierName}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatMoney(invoice.totalAmount, invoice.currency)}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-mono font-semibold whitespace-nowrap ${
                          summary.remainingAmount > 0.005 ? 'text-blue-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(summary.remainingAmount, invoice.currency)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceId(invoice.id);
                            }}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-700 font-medium px-1.5 py-1 rounded hover:bg-blue-50"
                          >
                            <span>Voir</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          {canManageRow && onUpdateInvoice && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingInvoiceEntry({
                                  invoice,
                                  linkedOrdersCount: summary.linkedOrders.length,
                                  allocatedAmount: summary.allocatedAmount,
                                })
                              }
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                              title={
                                isAdmin
                                  ? 'Modifier la facture (Administrateur)'
                                  : 'Modifier ma facture'
                              }
                              aria-label={`Modifier la facture ${invoice.invoiceNumber}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canManageRow && (
                            <button
                              type="button"
                              onClick={() =>
                                setAdminDeleteEntry({
                                  invoice,
                                  linkedOrdersCount: summary.linkedOrders.length,
                                })
                              }
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              title={
                                isAdmin
                                  ? 'Supprimer la facture (Administrateur)'
                                  : 'Supprimer ma facture'
                              }
                              aria-label={`Supprimer la facture ${invoice.invoiceNumber}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingInvoiceEntry && onUpdateInvoice && (
        <AdminEditInvoiceModal
          invoice={editingInvoiceEntry.invoice}
          suppliers={suppliers}
          linkedOrdersCount={editingInvoiceEntry.linkedOrdersCount}
          allocatedAmount={editingInvoiceEntry.allocatedAmount}
          isAdmin={isAdmin}
          onSave={async (id, payload) => {
            await onUpdateInvoice(id, payload);
          }}
          onClose={() => setEditingInvoiceEntry(null)}
        />
      )}

      {adminDeleteEntry && (
        <AdminConfirmDeleteModal
          title="Supprimer définitivement cette facture"
          entityRef={adminDeleteEntry.invoice.invoiceNumber}
          description={`Vous êtes sur le point de supprimer la facture ${adminDeleteEntry.invoice.invoiceNumber} (${adminDeleteEntry.invoice.supplierName} — ${formatMoney(adminDeleteEntry.invoice.totalAmount, adminDeleteEntry.invoice.currency)}).`}
          warningNote={
            adminDeleteEntry.linkedOrdersCount > 0
              ? `${adminDeleteEntry.linkedOrdersCount} ordre(s) de paiement sont actuellement rattaché(s) à cette facture : leur lien vers cette facture sera détaché automatiquement (les ordres resteront conservés).`
              : undefined
          }
          onConfirm={async () => {
            await onDeleteInvoice(adminDeleteEntry.invoice.id);
          }}
          onClose={() => setAdminDeleteEntry(null)}
        />
      )}
    </div>
  );
};
