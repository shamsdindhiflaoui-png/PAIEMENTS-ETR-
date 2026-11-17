import React, { useState } from 'react';
import {
  FileText,
  UserCheck,
  CreditCard,
  Paperclip,
  GitBranch,
  Building2,
  Printer,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Send,
  Building,
  Upload,
  Calendar,
  Lock,
  Download,
  Eye,
  Info,
  DollarSign,
  Ban,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  MinusCircle,
} from 'lucide-react';
import {
  Bank,
  CurrencyConsultation,
  Invoice,
  OrderDeduction,
  OrderDeductionCategory,
  PaymentOrder,
  User,
  PaymentStatus,
  DocumentType,
} from '../types/payment';
import {
  STATUS_META,
  canExecuteOrder,
  formatForeignCurrency,
  formatTndCurrency,
} from '../utils/workflowRules';
import {
  DEDUCTION_CATEGORY_META,
  canEditOrderDeductions,
  getOrderDeductionsTotal,
  getOrderInvoiceGrossAmount,
  validateExistingOrderDeductionsUpdate,
} from '../utils/invoiceUtils';
import { numberToFrenchWords } from '../utils/numberToFrenchWords';
import { canUserManageOrder, isAdministrator } from '../utils/adminRules';
import { AdminEditOrderModal } from './AdminEditOrderModal';
import { AdminConfirmDeleteModal } from './AdminConfirmDeleteModal';

interface OrderDetailViewProps {
  order: PaymentOrder;
  allOrders?: PaymentOrder[];
  banks?: Bank[];
  linkedInvoice?: Invoice;
  consultations?: CurrencyConsultation[];
  currentUser: User;
  onBack: () => void;
  onStatusChange: (targetStatus: PaymentStatus, comment: string) => Promise<void>;
  onOpenDepositModal: () => void;
  onOpenExecutionModal: () => void;
  onOpenConsultations?: (consultationId?: string) => void;
  onPrintOrder: () => void;
  onAddDocument: (doc: any) => Promise<void>;
  onUpdateDeductions?: (payload: {
    deductions: OrderDeduction[];
    grossAmount?: number;
  }) => Promise<void>;
  onUpdateOrder?: (id: string, payload: Partial<PaymentOrder>) => Promise<void>;
  onDeleteOrder?: (id: string) => Promise<void>;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  allOrders = [],
  banks = [],
  linkedInvoice,
  consultations = [],
  currentUser,
  onBack,
  onStatusChange,
  onOpenDepositModal,
  onOpenExecutionModal,
  onOpenConsultations,
  onPrintOrder,
  onAddDocument,
  onUpdateDeductions,
  onUpdateOrder,
  onDeleteOrder,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('AUTRE');
  const [adminEditOpen, setAdminEditOpen] = useState<boolean>(false);
  const [adminDeleteOpen, setAdminDeleteOpen] = useState<boolean>(false);

  const isAdmin = isAdministrator(currentUser);
  const canManageOrder = canUserManageOrder(currentUser, order).allowed;

  // Inline editing of deductions / registration fees directly on this single order
  const [isEditingDeductions, setIsEditingDeductions] = useState<boolean>(false);
  const [draftGrossAmount, setDraftGrossAmount] = useState<string>('');
  const [draftDeductions, setDraftDeductions] = useState<
    Array<{
      id: string;
      category: OrderDeductionCategory;
      label: string;
      reference: string;
      amount: string;
    }>
  >([]);
  const [deductionError, setDeductionError] = useState<string>('');
  const [isSavingDeductions, setIsSavingDeductions] = useState<boolean>(false);

  React.useEffect(() => {
    setIsEditingDeductions(false);
    setDeductionError('');
  }, [order.id]);

  const deductionsEditCheck = canEditOrderDeductions(order);
  const canEditDeductions = Boolean(onUpdateDeductions && deductionsEditCheck.allowed);

  const openDeductionsEditor = (initialCategory?: OrderDeductionCategory) => {
    setActiveTab(3);
    setDraftGrossAmount(String(getOrderInvoiceGrossAmount(order)));
    const existingRows = (order.deductions || []).map(d => ({
      id: d.id,
      category: d.category,
      label: d.label,
      reference: d.reference || '',
      amount: String(d.amount),
    }));
    if (existingRows.length === 0 || initialCategory) {
      const cat = initialCategory || 'FRAIS_ENREGISTREMENT';
      existingRows.push({
        id: 'ded_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        category: cat,
        label: DEDUCTION_CATEGORY_META[cat].label,
        reference: '',
        amount: '',
      });
    }
    setDraftDeductions(existingRows);
    setDeductionError('');
    setIsEditingDeductions(true);
  };

  const handleAddDraftDeduction = (category: OrderDeductionCategory = 'FRAIS_ENREGISTREMENT') => {
    setDraftDeductions(prev => [
      ...prev,
      {
        id: 'ded_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        category,
        label: DEDUCTION_CATEGORY_META[category].label,
        reference: '',
        amount: '',
      },
    ]);
    setDeductionError('');
  };

  const handleUpdateDraftDeduction = (
    id: string,
    patch: Partial<{
      category: OrderDeductionCategory;
      label: string;
      reference: string;
      amount: string;
    }>
  ) => {
    setDraftDeductions(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const nextCategory = patch.category ?? row.category;
        let nextLabel = patch.label ?? row.label;
        if (
          patch.category &&
          patch.label === undefined &&
          row.label === DEDUCTION_CATEGORY_META[row.category]?.label
        ) {
          nextLabel = DEDUCTION_CATEGORY_META[patch.category].label;
        }
        return {
          ...row,
          ...patch,
          category: nextCategory,
          label: nextLabel,
        };
      })
    );
    setDeductionError('');
  };

  const handleRemoveDraftDeduction = (id: string) => {
    setDraftDeductions(prev => prev.filter(r => r.id !== id));
    setDeductionError('');
  };

  const handleSaveDeductions = async () => {
    if (!onUpdateDeductions) return;
    setDeductionError('');

    const parsedGross = parseFloat(draftGrossAmount);
    if (!Number.isFinite(parsedGross) || parsedGross <= 0) {
      setDeductionError("Le montant brut imputé doit être strictement supérieur à 0.");
      return;
    }

    const parsedRows: Array<Partial<OrderDeduction>> = [];
    for (let i = 0; i < draftDeductions.length; i += 1) {
      const row = draftDeductions[i];
      if (row.amount.trim() === '') continue;
      const numAmt = Number(row.amount);
      if (!Number.isFinite(numAmt) || numAmt < 0) {
        setDeductionError(`Montant invalide sur la déduction ligne ${i + 1}.`);
        return;
      }
      if (numAmt > 0) {
        parsedRows.push({
          id: row.id,
          category: row.category,
          label: row.label,
          reference: row.reference,
          amount: numAmt,
        });
      }
    }

    const check = validateExistingOrderDeductionsUpdate({
      order,
      invoice: linkedInvoice,
      allOrders: allOrders.length > 0 ? allOrders : [order],
      deductions: parsedRows,
      grossAmount: parsedGross,
    });

    if (!check.valid) {
      setDeductionError(check.error || 'Erreur de validation des déductions.');
      return;
    }

    try {
      setIsSavingDeductions(true);
      await onUpdateDeductions({
        deductions: check.normalizedDeductions,
        grossAmount: check.grossAmount,
      });
      setIsEditingDeductions(false);
    } catch (err: any) {
      setDeductionError(err?.message || 'Erreur lors de la mise à jour des déductions.');
    } finally {
      setIsSavingDeductions(false);
    }
  };

  const execCheck = canExecuteOrder(order, consultations);
  const meta = STATUS_META[order.status] || STATUS_META.SAISI;
  const currentStep = meta.stepNumber;
  const stage4Label =
    order.exchangeTransaction?.status === 'VALIDE'
      ? 'Déposé à la banque (Devise achetée)'
      : order.status === 'DEPOSE_BANQUE'
      ? 'Déposé à la banque'
      : order.requiresRateNegotiation
      ? "En attente d'achat devise"
      : 'Déposé à la banque';
  const workflowSteps = [
    { step: 1, label: 'Saisi (Brouillon)' },
    { step: 2, label: 'Transmis pour signature' },
    { step: 3, label: 'Signé' },
    { step: 4, label: stage4Label },
    { step: 5, label: 'Exécuté' },
  ];

  // Handle direct file upload in tab 4
  const handleUploadDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      await onAddDocument({
        name: file.name,
        type: uploadDocType,
        size: file.size,
        mimeType: file.type || 'application/pdf',
        dataBase64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) return;
    await onStatusChange('ANNULE', cancelReason);
    setCancelModalOpen(false);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Retour à la liste"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold font-mono text-blue-700 whitespace-nowrap">
                {order.orderNumber}
              </span>
              {order.isDemo && (
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                  DONNÉE DE DÉMO
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                <span>{meta.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{order.purpose}</p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <button
            onClick={onPrintOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimer Ordre</span>
          </button>

          {/* Direct Deductions / Fees Button on existing single order */}
          {canEditDeductions && (
            <button
              type="button"
              onClick={() => openDeductionsEditor()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors shadow-2xs"
            >
              <MinusCircle className="w-4 h-4 text-amber-700" />
              <span>Déductions / Frais</span>
            </button>
          )}

          {/* Action 1: Transmit for signature if SAISI */}
          {order.status === 'SAISI' && (
            <button
              onClick={() =>
                onStatusChange(
                  'TRANSMIS_SIGNATURE',
                  'Transmission pour signature officielle de la direction'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Transmettre pour signature</span>
            </button>
          )}

          {/* Action 2: Sign or return to SAISI if TRANSMIS_SIGNATURE */}
          {order.status === 'TRANSMIS_SIGNATURE' && (
            <>
              <button
                onClick={() =>
                  onStatusChange('SAISI', 'Retour en brouillon (Saisi) pour ajustement')
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retourner (Saisi)</span>
              </button>
              <button
                onClick={() =>
                  onStatusChange(
                    'SIGNE',
                    'Ordre vérifié et signé par la direction financière'
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Signer l'ordre</span>
              </button>
            </>
          )}

          {/* Action 3: Record Bank Deposit after SIGNE */}
          {order.status === 'SIGNE' && (
            <button
              onClick={onOpenDepositModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            >
              <Building className="w-4 h-4" />
              <span>Enregistrer Dépôt Banque</span>
            </button>
          )}

          {/* Action 4: Record Transfer Execution */}
          {execCheck.allowed && (
            <button
              onClick={onOpenExecutionModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Enregistrer Exécution SWIFT</span>
            </button>
          )}

          {!execCheck.allowed &&
            (order.status === 'EN_ATTENTE_ACHAT_DEVISE' ||
              (order.status === 'DEPOSE_BANQUE' && order.requiresRateNegotiation)) && (
              <>
                <button
                  type="button"
                  disabled
                  title={execCheck.reason}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded-lg cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Exécution bloquée (Consultation requise)</span>
                </button>
                {onOpenConsultations && (
                  <button
                    type="button"
                    onClick={() => onOpenConsultations(execCheck.openConsultationId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>
                      {execCheck.openConsultationNumber
                        ? `Clôturer ${execCheck.openConsultationNumber}`
                        : 'Aller aux Consultations'}
                    </span>
                  </button>
                )}
              </>
            )}

          {/* Action 5: Administrative Cancellation (Traceable, non-destructive) */}
          {order.status !== 'EXECUTE' && order.status !== 'ANNULE' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="Annuler l'ordre avec motif obligatoire"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Annuler</span>
            </button>
          )}

          {/* Action 6: Administrator or Creator Edit & Delete */}
          {canManageOrder && onUpdateOrder && (
            <button
              type="button"
              onClick={() => setAdminEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors shadow-2xs"
              title={
                isAdmin
                  ? "Modifier les informations de l'ordre (Administrateur)"
                  : 'Modifier mon ordre de paiement'
              }
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
          )}

          {canManageOrder && onDeleteOrder && (
            <button
              type="button"
              onClick={() => setAdminDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg transition-colors shadow-2xs"
              title={
                isAdmin
                  ? 'Supprimer définitivement cet ordre (Administrateur)'
                  : 'Supprimer définitivement mon ordre'
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </button>
          )}
        </div>
      </div>

      {/* 5-Stage Visual Workflow Stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Progression du Circuit de Paiement (5 étapes)
          </span>
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border ${
              order.exchangeTransaction?.status === 'VALIDE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : order.requiresRateNegotiation
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            {order.exchangeTransaction?.status === 'VALIDE'
              ? `Devise achetée · ${
                  order.exchangeTransaction.selectedBankName || order.bankName
                } (${(
                  order.finalExchangeRate ||
                  order.exchangeTransaction.finalNegotiatedRate ||
                  0
                ).toFixed(4)} TND)`
              : order.requiresRateNegotiation
              ? "Option : Négociation cours exigée (En attente d'achat devise)"
              : 'Option : Dépôt direct (Déposé à la banque)'}
          </span>
        </div>

        {order.status === 'ANNULE' ? (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Cet ordre a été annulé administrativement. Aucun traitement ultérieur n'est autorisé.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {workflowSteps.map(ws => {
              const isCompleted = currentStep > ws.step || (ws.step === 5 && order.status === 'EXECUTE');
              const isCurrent = currentStep === ws.step && order.status !== 'EXECUTE';
              return (
                <div
                  key={ws.step}
                  className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : isCurrent
                      ? 'bg-blue-50 border-blue-400 text-blue-950 ring-1 ring-blue-300'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? '✓' : ws.step}
                  </div>
                  <span className={`leading-tight ${isCurrent ? 'font-bold' : 'font-medium'}`}>
                    {ws.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!execCheck.allowed &&
          (order.status === 'EN_ATTENTE_ACHAT_DEVISE' ||
            (order.status === 'DEPOSE_BANQUE' && order.requiresRateNegotiation)) && (
            <div className="mt-3 p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-700 shrink-0" />
                <span>{execCheck.reason}</span>
              </div>
              {onOpenConsultations && (
                <button
                  type="button"
                  onClick={() => onOpenConsultations(execCheck.openConsultationId)}
                  className="px-3 py-1 rounded-md bg-purple-700 hover:bg-purple-800 text-white font-semibold text-[11px] whitespace-nowrap self-start sm:self-auto"
                >
                  Ouvrir Consultations de change
                </button>
              )}
            </div>
          )}
      </div>

      {/* 6 Tabs Navigation Header */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 pt-2 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200">
          {[
            { id: 1, label: 'Général', icon: FileText },
            { id: 2, label: 'Bénéficiaire', icon: UserCheck },
            { id: 3, label: 'Financier & Banque', icon: CreditCard },
            { id: 4, label: `Documents (${order.documents.length})`, icon: Paperclip },
            { id: 5, label: `Circuit & Historique (${order.history.length})`, icon: GitBranch },
            { id: 6, label: 'Dépôt & Exécution SWIFT', icon: Building2 },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {/* TAB 1: Informations Générales */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Numéro d'Ordre</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">{order.orderNumber}</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Contrat / Marché</div>
                  <div className="text-sm font-bold font-mono text-blue-900 mt-1">{order.contractNumber || '—'}</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Type Transfert</div>
                  <div className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-semibold">
                      {order.transferType || 'VIREMENT'}
                    </span>
                    {order.lcNumber && (
                      <span className="text-[11px] font-mono text-slate-600">N° {order.lcNumber}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Statut Actuel</div>
                  <div className="text-xs font-bold text-slate-900 mt-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>{meta.label}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {order.requiresRateNegotiation
                      ? 'Négociation cours : Exigée'
                      : 'Négociation cours : Non exigée'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Initiateur du dossier
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{order.createdBy}</div>
                  <div className="text-xs text-blue-700 font-medium">{order.department}</div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Dernière mise à jour
                  </div>
                  <div className="text-sm font-mono text-slate-900">
                    {new Date(order.updatedAt).toLocaleString('fr-FR')}
                  </div>
                  <div className="text-xs text-slate-500">Horodatage certifié sur le serveur MTK</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Objet Détaillé du Règlement
                </div>
                <div className="text-xs text-slate-700 leading-relaxed font-medium">
                  {order.purpose}
                </div>
                {order.remarks && (
                  <div className="pt-2 mt-2 border-t border-slate-100 text-xs text-slate-500">
                    <strong>Observations :</strong> {order.remarks}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Bénéficiaire */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Raison Sociale / Fournisseur
                  </div>
                  <div className="text-sm font-bold text-slate-900">{order.beneficiaryName}</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Pays de Destination
                  </div>
                  <div className="text-sm font-bold text-slate-900">{order.beneficiaryCountry}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[11px] font-medium text-slate-500 uppercase">
                  Adresse Complète du Siège
                </div>
                <div className="text-xs text-slate-800 font-medium">
                  {order.beneficiaryAddress || 'Non spécifiée'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Banque Bénéficiaire
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {order.beneficiaryBank || '—'}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    IBAN / Numéro de Compte
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 break-all">
                    {order.beneficiaryIban || '—'}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Code SWIFT / BIC
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-700">
                    {order.beneficiarySwift || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Financier & Domiciliation */}
          {activeTab === 3 && (() => {
            const dedTotal = getOrderDeductionsTotal(order);
            const grossAmt = getOrderInvoiceGrossAmount(order);
            const hasDeductions =
              dedTotal > 0 || (Array.isArray(order.deductions) && order.deductions.length > 0);
            return (
            <div className="space-y-6">
              {/* Highlight Amount Box */}
              <div className="p-6 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                    {hasDeductions
                      ? 'Montant Net du Virement International (après déductions)'
                      : 'Montant du Virement International'}
                  </div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-blue-950 mt-1">
                    {formatForeignCurrency(order.amount, order.currency)}
                  </div>
                  {hasDeductions && (
                    <div className="text-xs text-blue-900/80 mt-1 font-mono">
                      Brut imputé facture : {formatForeignCurrency(grossAmt, order.currency)} ·
                      Déductions : −{formatForeignCurrency(dedTotal, order.currency)}
                    </div>
                  )}
                </div>
                <div className="sm:text-right">
                  <div className="text-xs text-slate-500">Devise de règlement</div>
                  <div className="text-sm font-bold text-slate-800">{order.currency}</div>
                </div>
              </div>

              {/* Amount in Words */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Montant en toutes lettres :
                </div>
                <div className="text-sm font-medium italic text-slate-900">
                  « {order.amountInWords || '—'} »
                </div>
              </div>

              {/* Décompte Déductions / Frais sur cet ordre */}
              {(() => {
                const draftGrossNum = parseFloat(draftGrossAmount) || 0;
                const draftDedSum = Number(
                  draftDeductions
                    .reduce((sum, d) => {
                      const val = parseFloat(d.amount);
                      return sum + (Number.isFinite(val) && val > 0 ? val : 0);
                    }, 0)
                    .toFixed(2)
                );
                const draftNetNum = Number((draftGrossNum - draftDedSum).toFixed(2));
                const liveValidation = isEditingDeductions
                  ? validateExistingOrderDeductionsUpdate({
                      order,
                      invoice: linkedInvoice,
                      allOrders: allOrders.length > 0 ? allOrders : [order],
                      deductions: draftDeductions.map(d => ({
                        id: d.id,
                        category: d.category,
                        label: d.label,
                        reference: d.reference,
                        amount: parseFloat(d.amount) || 0,
                      })),
                      grossAmount: draftGrossNum,
                    })
                  : null;

                return (
                  <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-200/70">
                      <div>
                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                          Décompte Facture : Déductions & Frais Appliqués
                        </span>
                        <p className="text-[11px] text-amber-900/75 mt-0.5">
                          Ajoutez ou ajustez des frais d&apos;enregistrement, retenues ou pénalités directement sur cet ordre sans en créer un nouveau.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEditingDeductions && (
                          <span className="text-xs font-mono font-bold text-amber-900">
                            {hasDeductions
                              ? `Total déduit : −${formatForeignCurrency(dedTotal, order.currency)}`
                              : 'Aucune déduction appliquée'}
                          </span>
                        )}
                        {!isEditingDeductions && canEditDeductions && (
                          <button
                            type="button"
                            onClick={() => openDeductionsEditor()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-2xs"
                          >
                            {hasDeductions ? (
                              <>
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Modifier les déductions</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Ajouter déduction / frais</span>
                              </>
                            )}
                          </button>
                        )}
                        {!isEditingDeductions && !deductionsEditCheck.allowed && (
                          <span
                            title={deductionsEditCheck.reason}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white border border-slate-200 text-slate-500"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Verrouillé</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isEditingDeductions ? (
                      <div className="space-y-3 bg-white p-4 rounded-xl border border-amber-200">
                        {deductionError && (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{deductionError}</span>
                          </div>
                        )}

                        {/* Optional gross amount input + linked invoice cap */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <label
                              htmlFor="editOrderGrossAmount"
                              className="block text-xs font-bold text-slate-800"
                            >
                              Montant brut imputé sur l&apos;ordre ({order.currency})
                            </label>
                            <p className="text-[11px] text-slate-500">
                              {linkedInvoice && liveValidation?.maxAllowedGross !== undefined
                                ? `Facture ${linkedInvoice.invoiceNumber} — Maximum imputable disponible : ${formatForeignCurrency(
                                    liveValidation.maxAllowedGross,
                                    order.currency
                                  )}`
                                : 'Le montant net à transférer sera recalculé automatiquement (Brut − Déductions).'}
                            </p>
                          </div>
                          <input
                            id="editOrderGrossAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={draftGrossAmount}
                            onChange={e => {
                              setDraftGrossAmount(e.target.value);
                              setDeductionError('');
                            }}
                            className="w-full sm:w-48 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>

                        {/* Quick-add preset buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                                'AUTRE_DEDUCTION',
                              ] as OrderDeductionCategory[]
                            ).map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => handleAddDraftDeduction(cat)}
                                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition-colors"
                              >
                                + {DEDUCTION_CATEGORY_META[cat].shortLabel}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddDraftDeduction('FRAIS_ENREGISTREMENT')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Ajouter ligne</span>
                          </button>
                        </div>

                        {/* Editable Deduction Rows */}
                        {draftDeductions.length > 0 ? (
                          <div className="space-y-2">
                            {draftDeductions.map((ded, idx) => {
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
                                        handleUpdateDraftDeduction(ded.id, {
                                          category: e.target.value as OrderDeductionCategory,
                                        })
                                      }
                                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                    >
                                      {(
                                        Object.keys(
                                          DEDUCTION_CATEGORY_META
                                        ) as OrderDeductionCategory[]
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
                                        handleUpdateDraftDeduction(ded.id, {
                                          label: e.target.value,
                                        })
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
                                        handleUpdateDraftDeduction(ded.id, {
                                          reference: e.target.value,
                                        })
                                      }
                                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                      Montant ({order.currency})
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      aria-label={`Montant déduction ${idx + 1}`}
                                      placeholder="0.00"
                                      value={ded.amount}
                                      onChange={e =>
                                        handleUpdateDraftDeduction(ded.id, {
                                          amount: e.target.value,
                                        })
                                      }
                                      className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-blue-600"
                                    />
                                  </div>

                                  <div className="md:col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDraftDeduction(ded.id)}
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
                        ) : (
                          <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                            Aucune ligne de déduction. Cliquez sur un bouton ci-dessus pour ajouter des frais ou enregistrez pour rétablir le montant net au brut.
                          </div>
                        )}

                        {/* Live Preview Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
                          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <span className="text-slate-600">Brut imputé</span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatForeignCurrency(draftGrossNum, order.currency)}
                            </span>
                          </div>
                          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                            <span className="text-amber-800">Total déductions</span>
                            <span className="font-mono font-bold text-amber-900">
                              −{formatForeignCurrency(draftDedSum, order.currency)}
                            </span>
                          </div>
                          <div
                            className={`px-3 py-2 rounded-lg border flex items-center justify-between ${
                              draftNetNum <= 0
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-blue-50 border-blue-200 text-blue-950'
                            }`}
                          >
                            <span className="font-semibold">Nouveau net à transférer</span>
                            <span className="font-mono font-extrabold">
                              {formatForeignCurrency(draftNetNum, order.currency)}
                            </span>
                          </div>
                        </div>

                        {draftNetNum > 0 && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 italic">
                            <strong className="not-italic text-slate-700">
                              Aperçu en toutes lettres :
                            </strong>{' '}
                            « {numberToFrenchWords(draftNetNum, order.currency)} »
                          </div>
                        )}

                        {liveValidation && !liveValidation.valid && !deductionError && (
                          <div className="text-[11px] text-rose-700 font-medium">
                            {liveValidation.error}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={isSavingDeductions}
                            onClick={() => {
                              setIsEditingDeductions(false);
                              setDeductionError('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Annuler</span>
                          </button>
                          <button
                            type="button"
                            disabled={
                              isSavingDeductions || Boolean(liveValidation && !liveValidation.valid)
                            }
                            onClick={handleSaveDeductions}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>
                              {isSavingDeductions
                                ? 'Enregistrement...'
                                : 'Enregistrer sur cet ordre'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {hasDeductions ? (
                          <>
                            {order.deductions && order.deductions.length > 0 && (
                              <div className="overflow-x-auto bg-white rounded-lg border border-amber-200/80">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-amber-50/70 text-amber-900 font-semibold border-b border-amber-100">
                                    <tr>
                                      <th className="py-2 px-3">Nature</th>
                                      <th className="py-2 px-3">Libellé</th>
                                      <th className="py-2 px-3">Référence</th>
                                      <th className="py-2 px-3 text-right">Montant déduit</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {order.deductions.map((d, idx) => (
                                      <tr key={d.id || idx}>
                                        <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">
                                          {DEDUCTION_CATEGORY_META[d.category]?.shortLabel ||
                                            d.category}
                                        </td>
                                        <td className="py-2 px-3 text-slate-900">{d.label}</td>
                                        <td className="py-2 px-3 font-mono text-slate-500">
                                          {d.reference || '—'}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-900 whitespace-nowrap">
                                          −{formatForeignCurrency(d.amount, order.currency)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                              <div className="bg-white rounded-lg p-2.5 border border-amber-100 flex items-center justify-between">
                                <span className="text-slate-600">Brut imputé facture</span>
                                <strong className="font-mono text-slate-900">
                                  {formatForeignCurrency(grossAmt, order.currency)}
                                </strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 border border-amber-100 flex items-center justify-between">
                                <span className="text-amber-800">Déductions / Frais</span>
                                <strong className="font-mono text-amber-900">
                                  −{formatForeignCurrency(dedTotal, order.currency)}
                                </strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 border border-blue-200 flex items-center justify-between">
                                <span className="font-semibold text-blue-900">
                                  Net à transférer
                                </span>
                                <strong className="font-mono text-blue-950">
                                  {formatForeignCurrency(order.amount, order.currency)}
                                </strong>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-600 bg-white/80 rounded-lg p-3 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span>
                              {deductionsEditCheck.allowed
                                ? "Aucune déduction ou frais d'enregistrement n'est encore appliqué à cet ordre."
                                : deductionsEditCheck.reason}
                            </span>
                            {canEditDeductions && (
                              <button
                                type="button"
                                onClick={() => openDeductionsEditor('FRAIS_ENREGISTREMENT')}
                                className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline self-start sm:self-auto"
                              >
                                + Ajouter des frais d&apos;enregistrement / retenue
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Contrat / Marché</div>
                  <div className="text-xs font-mono font-bold text-blue-900">{order.contractNumber || '—'}</div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    {order.documentBasis === 'PROFORMA'
                      ? 'Réf. Proforma'
                      : 'Réf. Facture Définitive'}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900">
                    {order.invoiceNumber}
                    {order.invoiceDate ? (
                      <span className="text-[11px] font-normal text-slate-500 ml-1">
                        ({order.invoiceDate})
                      </span>
                    ) : null}
                  </div>
                  {order.documentBasis !== 'PROFORMA' &&
                    (order.proformaNumber || linkedInvoice?.proformaNumber) &&
                    (order.proformaNumber || linkedInvoice?.proformaNumber) !== order.invoiceNumber && (
                      <div className="text-[11px] italic text-slate-600">
                        sur Proforma {order.proformaNumber || linkedInvoice?.proformaNumber}
                        {(order.proformaDate || linkedInvoice?.proformaDate)
                          ? ` (${order.proformaDate || linkedInvoice?.proformaDate})`
                          : ''}
                      </div>
                    )}
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Type Transfert & N° LC</div>
                  <div className="text-xs font-mono font-bold text-blue-700">
                    {order.transferType || 'VIREMENT'} {order.lcNumber ? `(${order.lcNumber})` : ''}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Nature de l'Opération</div>
                  <div className="text-xs font-semibold text-slate-800">{order.operationNature}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Banque Tunisienne MTK (Domiciliataire)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Établissement :</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{order.bankName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Agence :</span>
                    <p className="font-medium text-slate-800 mt-0.5">{order.bankBranch || 'Agence Kairouan'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Réf Dossier :</span>
                    <p className="font-mono text-slate-800 mt-0.5">{order.bankFileRef || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* TAB 4: Documents Justificatifs */}
          {activeTab === 4 && (
            <div className="space-y-6">
              {/* Upload bar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    Joindre une pièce :
                  </span>
                  <select
                    value={uploadDocType}
                    onChange={e => setUploadDocType(e.target.value as any)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="FACTURE">Facture</option>
                    <option value="DOMICILIATION">Fiche Domiciliation</option>
                    <option value="CONTRAT">Contrat / Bon Commande</option>
                    <option value="BORDEREAU_DEPOT">Bordereau Dépôt</option>
                    <option value="AVIS_DEBIT_SWIFT">Avis Débit SWIFT</option>
                    <option value="AUTRE">Autre Justificatif</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-4 h-4" />
                  <span>Téléverser un document</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleUploadDoc}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Document List */}
              <div className="space-y-3">
                {order.documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{doc.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-blue-700">{doc.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{(doc.size / 1024).toFixed(1)} Ko</span>
                          <span aria-hidden="true">·</span>
                          <span>Déposé par {doc.uploadedBy} le {doc.uploadedAt.split('T')[0]}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {doc.dataBase64 ? (
                        <a
                          href={doc.dataBase64}
                          download={doc.name}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => alert(`Téléchargement de la pièce : ${doc.name}`)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {order.documents.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    Aucune pièce justificative jointe à cet ordre
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Circuit de Traitement et Historique */}
          {activeTab === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Traçabilité & Historique Chronologique Inaltérable
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chaque transition de statut est journalisée avec date, heure, utilisateur et commentaire.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {order.history.length} événement(s)
                </div>
              </div>

              {/* Chronological Timeline */}
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {order.history.map((h, i) => {
                  const toMeta = STATUS_META[h.toStatus] || STATUS_META.SAISI;
                  return (
                    <div key={h.id || i} className="relative flex items-start gap-4">
                      {/* Timeline dot */}
                      <div className="w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shrink-0 -ml-[23px] shadow-2xs">
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                      </div>

                      <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${toMeta.badgeBg} ${toMeta.badgeText} ${toMeta.badgeBorder}`}
                            >
                              {toMeta.label}
                            </span>
                            {h.fromStatus !== 'INITIAL' && (
                              <span className="text-[11px] text-slate-400">
                                (ex: {STATUS_META[h.fromStatus]?.label})
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {new Date(h.timestamp).toLocaleString('fr-FR')}
                          </div>
                        </div>

                        <div className="text-xs text-slate-800 font-medium">
                          {h.comment || 'Transition effectuée'}
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-2">
                          <span className="font-semibold text-slate-700">{h.userName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{h.userRole}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: Dépôt Bancaire & Exécution SWIFT */}
          {activeTab === 6 && (
            <div className="space-y-6">
              {/* Sub-section 1: Dépôt Bancaire */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Suivi du Dépôt Bancaire
                    </h4>
                  </div>
                  {order.deposit ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Dépôt Enregistré
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Non déposé</span>
                  )}
                </div>

                {order.deposit ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Banque de dépôt :</span>
                      <p className="font-bold text-slate-900 mt-0.5">{order.deposit.bankName}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Date du dépôt physique :</span>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">{order.deposit.depositDate}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">N° de Bordereau :</span>
                      <p className="font-mono font-bold text-blue-700 mt-0.5">{order.deposit.slipNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Réf bancaire attribuée :</span>
                      <p className="font-mono text-slate-900 mt-0.5">{order.deposit.bankReference || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Agent dépositaire :</span>
                      <p className="font-medium text-slate-900 mt-0.5">{order.deposit.depositedBy}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Notes de remise :</span>
                      <p className="text-slate-700 mt-0.5">{order.deposit.notes || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 flex items-center justify-between">
                    <span>Le dossier n'a pas encore fait l'objet d'un dépôt physique en agence bancaire.</span>
                    {order.status === 'SIGNE' && (
                      <button
                        onClick={onOpenDepositModal}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                      >
                        Enregistrer maintenant
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-section 2: Exécution du Virement SWIFT */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      2. Exécution du Transfert & Débit Compte
                    </h4>
                  </div>
                  {order.status === 'EXECUTE' ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Transfert Exécuté & Clôturé
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">En attente d'exécution</span>
                  )}
                </div>

                {order.status === 'EXECUTE' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] uppercase">Réf SWIFT MT103</span>
                      <p className="font-mono font-bold text-blue-800 mt-1">{order.swiftReference}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] uppercase">Taux de Change Négocié</span>
                      <p className="font-mono font-bold text-slate-900 mt-1">
                        {order.finalExchangeRate ? order.finalExchangeRate.toFixed(4) : '—'} TND
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-emerald-800 text-[11px] uppercase font-semibold">
                        Contre-valeur Débitée TND
                      </span>
                      <p className="font-mono font-bold text-emerald-950 text-sm mt-1">
                        {order.debitAmountTnd ? formatTndCurrency(order.debitAmountTnd) : '—'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] uppercase">Date de Débit Compte</span>
                      <p className="font-mono text-slate-900 mt-1">{order.accountDebitDate || order.executionDate}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span>
                      {execCheck.allowed
                        ? 'Les informations de dénouement (message SWIFT, cours négocié et commissions) seront renseignées lors de la clôture.'
                        : execCheck.reason ||
                          'Les informations de dénouement seront renseignées après dépôt bancaire et clôture éventuelle de la consultation.'}
                    </span>
                    {execCheck.allowed ? (
                      <button
                        onClick={onOpenExecutionModal}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap"
                      >
                        Saisir exécution
                      </button>
                    ) : (
                      (order.status === 'EN_ATTENTE_ACHAT_DEVISE' ||
                        (order.status === 'DEPOSE_BANQUE' && order.requiresRateNegotiation)) && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 font-semibold whitespace-nowrap">
                          <Lock className="w-3.5 h-3.5" />
                          <span>En attente clôture consultation</span>
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Sub-section 3: Passerelle Module 02 */}
              <div className="p-5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
                    <DollarSign className="w-4 h-4 text-purple-700" />
                    <span>Passerelle Module 02 : Consultation & Négociation de Change</span>
                  </div>
                  {order.exchangeTransaction?.status === 'VALIDE' && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      Achat de devise confirmé
                    </span>
                  )}
                  {(order.exchangeTransaction?.status === 'CONSULTATION_EN_COURS' ||
                    order.exchangeTransaction?.status === 'NEGOCIE') && (
                    <span className="text-[11px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full">
                      Consultation en cours
                    </span>
                  )}
                </div>

                {order.exchangeTransaction?.consultationNumber ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-lg bg-white border border-purple-100">
                      <span className="text-slate-500 text-[11px] uppercase">Consultation</span>
                      <p className="font-mono font-bold text-blue-800 mt-0.5">
                        {order.exchangeTransaction.consultationNumber}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-purple-100">
                      <span className="text-slate-500 text-[11px] uppercase">Banque d'achat retenue</span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {order.exchangeTransaction.selectedBankName || 'En attente de clôture'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-purple-100">
                      <span className="text-slate-500 text-[11px] uppercase">Cours négocié</span>
                      <p className="font-mono font-bold text-emerald-700 mt-0.5">
                        {(
                          order.finalExchangeRate ||
                          order.exchangeTransaction.finalNegotiatedRate
                        )
                          ? `${(
                              order.finalExchangeRate ||
                              order.exchangeTransaction.finalNegotiatedRate ||
                              0
                            ).toFixed(4)} TND`
                          : '—'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-purple-100">
                      <span className="text-slate-500 text-[11px] uppercase">Économie réalisée</span>
                      <p className="font-mono font-bold text-emerald-800 mt-0.5">
                        {order.exchangeTransaction.savingsTnd
                          ? formatTndCurrency(order.exchangeTransaction.savingsTnd)
                          : '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-purple-950 leading-relaxed">
                    Cet ordre de paiement est structuré pour s'interconnecter avec le module de cotations multi-banques (salle des marchés).
                    <span className="block mt-1 text-slate-600">
                      Dès le dépôt bancaire, l'ordre est disponible pour la mise en concurrence des devises.
                    </span>
                  </p>
                )}

                {order.exchangeTransaction?.notes && (
                  <div className="text-[11px] text-slate-700 bg-white/80 border border-purple-100 rounded-lg px-3 py-2">
                    <strong>Détails confirmation :</strong> {order.exchangeTransaction.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Annulation administrative de l'ordre</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conformément à la réglementation DFC, un ordre engagé ne peut être supprimé. L'annulation sera tracée dans le journal d'audit.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif obligatoire de l'annulation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex : Annulation de la commande par le fournisseur, erreur de domiciliation, etc."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Retour
              </button>
              <button
                disabled={!cancelReason.trim()}
                onClick={handleCancelOrder}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg disabled:opacity-50"
              >
                Confirmer l'Annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {adminEditOpen && onUpdateOrder && (
        <AdminEditOrderModal
          order={order}
          banks={banks}
          isAdmin={isAdmin}
          onSave={onUpdateOrder}
          onClose={() => setAdminEditOpen(false)}
        />
      )}

      {adminDeleteOpen && onDeleteOrder && (
        <AdminConfirmDeleteModal
          title="Supprimer définitivement cet ordre de paiement"
          entityRef={order.orderNumber}
          description={`Vous êtes sur le point de supprimer l'ordre ${order.orderNumber} (${order.beneficiaryName} — ${formatForeignCurrency(order.amount, order.currency)}). Cette action est irréversible et sera journalisée.`}
          warningNote={
            order.exchangeTransaction?.consultationNumber
              ? `Cet ordre est lié à la consultation ${order.exchangeTransaction.consultationNumber} : il en sera automatiquement détaché et le montant total de la consultation sera recalculé.`
              : undefined
          }
          onConfirm={async () => {
            await onDeleteOrder(order.id);
            onBack();
          }}
          onClose={() => setAdminDeleteOpen(false)}
        />
      )}
    </div>
  );
};
