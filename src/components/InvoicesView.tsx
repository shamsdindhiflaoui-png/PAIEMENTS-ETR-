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
} from 'lucide-react';
import {
  Invoice,
  InvoicePaymentStatus,
  PaymentOrder,
  Supplier,
  User,
  PaymentDocument,
} from '../types/payment';
import { computeInvoicePaymentSummary } from '../utils/invoiceUtils';
import { STATUS_META } from '../utils/workflowRules';

interface InvoicesViewProps {
  invoices: Invoice[];
  orders: PaymentOrder[];
  suppliers: Supplier[];
  currentUser: User;
  onCreateInvoice: (payload: Partial<Invoice>) => Promise<Invoice>;
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
  onDeleteInvoice,
  onCreateOrderFromInvoice,
  onSelectOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoicePaymentStatus>('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
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
          invoice.supplierName.toLowerCase().includes(q) ||
          (invoice.contractNumber || '').toLowerCase().includes(q) ||
          invoice.purpose.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [enrichedInvoices, searchQuery, statusFilter]);

  const resetForm = () => {
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
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

    if (!invoiceNumber.trim()) {
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
      setFormError('Veuillez renseigner l’objet / désignation de la facture.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateInvoice({
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
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

  const formatMoney = (val: number, cur: string) =>
    `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

  const remainingSummaryEntries = Object.entries(stats.remainingByCurrency);

  // Detail View when user clicks an invoice row
  if (selectedInvoiceEntry) {
    const { invoice, summary } = selectedInvoiceEntry;
    const statusMeta = STATUS_BADGE[summary.paymentStatus];
    const canCreateOrder = summary.remainingAmount > 0.005;
    const canDelete = summary.linkedOrders.length === 0;

    return (
      <div className="space-y-5 max-w-6xl mx-auto pb-12">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedInvoiceId(null);
                setConfirmDeleteId(null);
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

            {canDelete &&
              (confirmDeleteId === invoice.id ? (
                <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                  <span className="text-[11px] font-medium text-rose-800">Supprimer ?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteInvoice(invoice.id);
                      setConfirmDeleteId(null);
                      setSelectedInvoiceId(null);
                    }}
                    className="px-2.5 py-1 rounded bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1 rounded bg-white text-slate-600 text-[11px] font-semibold border border-slate-200 hover:bg-slate-100"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(invoice.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              ))}
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
                Déjà Ordonnancé
              </div>
              <div className="text-lg font-bold font-mono text-blue-900 mt-1">
                {formatMoney(summary.allocatedAmount, invoice.currency)}
              </div>
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

        {/* Details Grid: Invoice Info & Supplier Bank */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* General Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Informations de la Facture</span>
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-slate-500">N° Facture</dt>
                <dd className="font-mono font-bold text-slate-900 mt-0.5">{invoice.invoiceNumber}</dd>
              </div>
              <div>
                <dt className="text-slate-500">N° Contrat / Marché</dt>
                <dd className="font-mono font-semibold text-blue-700 mt-0.5">
                  {invoice.contractNumber || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Date Facture</dt>
                <dd className="font-mono text-slate-900 mt-0.5">{invoice.invoiceDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Date d'Échéance</dt>
                <dd className="font-mono text-slate-900 mt-0.5">{invoice.dueDate || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Nature de l'opération</dt>
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
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ordres de Paiement Rattachés ({summary.linkedOrders.length})
            </h3>
            {canCreateOrder && (
              <button
                type="button"
                onClick={() => onCreateOrderFromInvoice(invoice.id)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Émettre un ordre sur cette facture</span>
              </button>
            )}
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
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => onSelectOrder(ord.id)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {ord.orderNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {ord.createdAt.split('T')[0]}
                        </td>
                        <td className="py-3 px-4 text-slate-800">{ord.bankName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{ord.transferType || 'VIREMENT'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatMoney(ord.amount, ord.currency)}
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

          {/* Row 1: Références facture */}
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
                Date d'Échéance
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
                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setSelectedInvoiceId(invoice.id);
                      }}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 group-hover:underline">
                            {invoice.invoiceNumber}
                          </span>
                          {invoice.isDemo && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Démo
                            </span>
                          )}
                        </div>
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

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-400 group-hover:text-blue-700 font-medium">
                          <span>Voir</span>
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
