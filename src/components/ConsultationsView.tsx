import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Printer,
  Download,
  RefreshCw,
  FileText,
  AlertCircle,
  Pencil,
  Trash2,
  Plus,
  ArrowLeft,
  Landmark,
  CheckSquare,
  Square,
  Award,
  X,
  FileCheck2,
  ClipboardList,
  Ban,
} from 'lucide-react';
import {
  PaymentOrder,
  Bank,
  User,
  CurrencyConsultation,
  ExchangeQuote,
  Invoice,
} from '../types/payment';
import {
  formatConsultationAmount,
  formatConsultationTime,
  downloadConsultationPdf,
} from '../utils/consultationPdf';
import {
  computeDefaultValueDate,
  generateNextConfirmationRef,
} from '../utils/purchaseConfirmationPdf';
import { canUserManageConsultation, isAdministrator } from '../utils/adminRules';
import { downloadTablePdf } from '../utils/tablePdf';
import {
  CONSULTATION_STATUS_META,
  ConsultationFilterParams,
  ConsultationSortField,
  ConsultationSortOrder,
  filterConsultations,
  sortConsultations,
  getConsultationBeneficiarySummary,
  getConsultationFiscalYears,
} from '../utils/consultationFilters';
import { AdminEditConsultationModal } from './AdminEditConsultationModal';
import { AdminConfirmDeleteModal } from './AdminConfirmDeleteModal';

interface ConsultationsViewProps {
  orders: PaymentOrder[];
  invoices?: Invoice[];
  consultations: CurrencyConsultation[];
  banks: Bank[];
  currentUser: User;
  onCreateConsultation: (payload: {
    orderIds: string[];
    operationDate: string;
    purchaseType: string;
    submissionDeadlineTime: string;
    validityDeadlineTime: string;
    contactPhone?: string;
    contactEmail?: string;
    faxNumbers?: string;
    consultedBankIds?: string[];
    notes?: string;
  }) => Promise<CurrencyConsultation>;
  onRecordQuotes: (
    consultationId: string,
    payload: {
      quotes?: ExchangeQuote[];
      selectedBankId?: string;
      selectedBankName?: string;
      negotiatedRate?: number;
      confirmationRef?: string;
      confirmationDate?: string;
      valueDate?: string;
      close?: boolean;
      notes?: string;
    }
  ) => Promise<void>;
  onCancelConsultation: (consultationId: string, reason: string) => Promise<void>;
  onUpdateConsultation?: (
    consultationId: string,
    payload: Partial<CurrencyConsultation>
  ) => Promise<void>;
  onDeleteConsultation?: (consultationId: string) => Promise<void>;
  onOpenPdfModal: (consultation: CurrencyConsultation) => void;
  onOpenConfirmationModal: (consultation: CurrencyConsultation, initialTab?: 'recap' | number) => void;
  onSelectOrder: (orderId: string) => void;
  onSelectConsultation: (consultationId: string) => void;
  onRefresh?: () => Promise<void> | void;
}

export const ConsultationsView: React.FC<ConsultationsViewProps> = ({
  orders,
  invoices = [],
  consultations,
  banks,
  currentUser,
  onCreateConsultation,
  onRecordQuotes,
  onCancelConsultation,
  onUpdateConsultation,
  onDeleteConsultation,
  onOpenPdfModal,
  onOpenConfirmationModal,
  onSelectOrder,
  onSelectConsultation,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // List / Filter / Sort / Pagination state (aligned with OrderListView)
  const [filters, setFilters] = useState<ConsultationFilterParams>({
    searchQuery: '',
    status: 'ALL',
    currency: 'ALL',
    bank: 'ALL',
    fiscalYear: 'ALL',
  });
  const [sortField, setSortField] = useState<ConsultationSortField>('operationDate');
  const [sortOrder, setSortOrder] = useState<ConsultationSortOrder>('desc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Admin Edit / Delete Modals
  const [editingConsultation, setEditingConsultation] =
    useState<CurrencyConsultation | null>(null);
  const [deletingConsultation, setDeletingConsultation] =
    useState<CurrencyConsultation | null>(null);

  const isAdmin = isAdministrator(currentUser);

  // Eligible orders awaiting consultation
  const eligibleOrdersAll = useMemo(
    () => orders.filter(o => o.status === 'EN_ATTENTE_ACHAT_DEVISE'),
    [orders]
  );

  const consultedOrderMap = useMemo(() => {
    const map = new Map<string, CurrencyConsultation>();
    consultations.forEach(c => {
      if (c.status !== 'ANNULEE') {
        c.orderIds.forEach(oid => map.set(oid, c));
      }
    });
    return map;
  }, [consultations]);

  const availableOrders = useMemo(
    () => eligibleOrdersAll.filter(o => !consultedOrderMap.has(o.id)),
    [eligibleOrdersAll, consultedOrderMap]
  );

  // Creation Form State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [operationDate, setOperationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [purchaseTypeOption, setPurchaseTypeOption] = useState<string>('au comptant');
  const [customPurchaseType, setCustomPurchaseType] = useState<string>('');
  const [submissionDeadlineTime, setSubmissionDeadlineTime] = useState<string>('14h20');
  const [validityDeadlineTime, setValidityDeadlineTime] = useState<string>('14h30');
  const [contactPhone, setContactPhone] = useState<string>('(77) 281 699');
  const [contactEmail, setContactEmail] = useState<string>('mtk.tn@mtk.tn');
  const [faxNumbers, setFaxNumbers] = useState<string>('(77).287.200   (77).283.130');
  const [consultedBankIds, setConsultedBankIds] = useState<string[]>(() =>
    banks.filter(b => b.active).map(b => b.id)
  );
  const [showContactOptions, setShowContactOptions] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quote / Close Modal state
  const [quoteModalConsultation, setQuoteModalConsultation] =
    useState<CurrencyConsultation | null>(null);
  const [winningBankId, setWinningBankId] = useState<string>('bank_stb');
  const [winningRate, setWinningRate] = useState<string>('3.1150');
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [isSavingQuote, setIsSavingQuote] = useState<boolean>(false);

  // Filtered & Sorted Consultations
  const filteredConsultations = useMemo(
    () => filterConsultations(consultations, orders, filters),
    [consultations, orders, filters]
  );

  const sortedConsultations = useMemo(
    () => sortConsultations(filteredConsultations, sortField, sortOrder),
    [filteredConsultations, sortField, sortOrder]
  );

  const fiscalYearOptions = useMemo(
    () => getConsultationFiscalYears(consultations),
    [consultations]
  );

  const totalPages = Math.ceil(sortedConsultations.length / pageSize) || 1;
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedConsultations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedConsultations.slice(start, start + pageSize);
  }, [sortedConsultations, currentPage, pageSize]);

  const hasActiveFilters = Boolean(
    (filters.searchQuery && filters.searchQuery.trim()) ||
      (filters.status && filters.status !== 'ALL') ||
      (filters.currency && filters.currency !== 'ALL') ||
      (filters.bank && filters.bank !== 'ALL') ||
      (filters.fiscalYear && filters.fiscalYear !== 'ALL')
  );

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      status: 'ALL',
      currency: 'ALL',
      bank: 'ALL',
      fiscalYear: 'ALL',
    });
    setCurrentPage(1);
  };

  const handleManualRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSort = (field: ConsultationSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: ConsultationSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  const handlePrintConsultationsPdf = () => {
    const activeFiltersSummary = [
      filters.status && filters.status !== 'ALL'
        ? `Statut : ${CONSULTATION_STATUS_META[filters.status]?.label || filters.status}`
        : 'Tous statuts',
      filters.currency && filters.currency !== 'ALL' ? `Devise : ${filters.currency}` : null,
      filters.fiscalYear && filters.fiscalYear !== 'ALL'
        ? `Exercice : ${filters.fiscalYear}`
        : null,
      filters.searchQuery ? `Recherche : "${filters.searchQuery}"` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    downloadTablePdf({
      title: 'Registre des Consultations pour Achat de Devises',
      subtitle: activeFiltersSummary,
      filename: `Registre_Consultations_MTK_${new Date().toISOString().split('T')[0]}.pdf`,
      orientation: 'landscape',
      columns: [
        { header: 'N° Consultation', widthRatio: 1.1 },
        { header: 'Date Op.', widthRatio: 0.85 },
        { header: 'Bénéficiaires', widthRatio: 1.7 },
        { header: 'Ordres regroupés', widthRatio: 1.5 },
        { header: 'Type & Heures', widthRatio: 1.2 },
        { header: 'Montant', align: 'right', widthRatio: 1.1 },
        { header: 'Banque & Cours retenu', widthRatio: 1.4 },
        { header: 'Statut', widthRatio: 0.9 },
      ],
      rows: sortedConsultations.map(c => {
        const summary = getConsultationBeneficiarySummary(c, orders);
        return [
          c.consultationNumber,
          c.operationDate || c.createdAt.split('T')[0],
          summary.primaryLabel,
          summary.orderNumbers.join(', ') || '—',
          `${c.purchaseType} (${c.submissionDeadlineTime}/${c.validityDeadlineTime})`,
          formatConsultationAmount(c.totalAmount, c.currency),
          c.selectedBankName && c.negotiatedRate
            ? `${c.selectedBankName} · ${c.negotiatedRate.toFixed(4)} TND`
            : `${c.quotes?.length || 0} offre(s)`,
          CONSULTATION_STATUS_META[c.status]?.label || c.status,
        ];
      }),
    });
  };

  // Creation form helpers
  const selectedOrders = useMemo(
    () => availableOrders.filter(o => selectedOrderIds.includes(o.id)),
    [availableOrders, selectedOrderIds]
  );

  const activeCurrency = selectedOrders.length > 0 ? selectedOrders[0].currency : null;
  const computedTotalAmount = useMemo(
    () => Number(selectedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toFixed(2)),
    [selectedOrders]
  );

  const effectivePurchaseType =
    purchaseTypeOption === 'AUTRE'
      ? customPurchaseType.trim() || 'au comptant'
      : purchaseTypeOption;

  const toggleOrderSelection = (order: PaymentOrder) => {
    setFormError(null);
    setSelectedOrderIds(prev => {
      if (prev.includes(order.id)) {
        return prev.filter(id => id !== order.id);
      }
      if (activeCurrency && order.currency !== activeCurrency) {
        setFormError(
          `Une consultation regroupe des ordres d'une même devise (${activeCurrency}). Désélectionnez d'abord les ordres en ${activeCurrency} pour choisir ${order.currency}.`
        );
        return prev;
      }
      return [...prev, order.id];
    });
  };

  const selectAllByCurrency = (currency: string) => {
    setFormError(null);
    const matching = availableOrders.filter(o => o.currency === currency).map(o => o.id);
    setSelectedOrderIds(matching);
  };

  const toggleBankSelection = (bankId: string) => {
    setConsultedBankIds(prev =>
      prev.includes(bankId) ? prev.filter(id => id !== bankId) : [...prev, bankId]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (selectedOrderIds.length === 0) {
      setFormError('Veuillez sélectionner au moins un ordre de paiement.');
      return;
    }
    if (!operationDate) {
      setFormError("La date d'opération est obligatoire.");
      return;
    }
    if (!submissionDeadlineTime.trim() || !validityDeadlineTime.trim()) {
      setFormError('Les heures limites de cotation et de validité sont obligatoires.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await onCreateConsultation({
        orderIds: selectedOrderIds,
        operationDate,
        purchaseType: effectivePurchaseType,
        submissionDeadlineTime: formatConsultationTime(submissionDeadlineTime),
        validityDeadlineTime: formatConsultationTime(validityDeadlineTime),
        contactPhone,
        contactEmail,
        faxNumbers,
        consultedBankIds,
      });
      setSelectedOrderIds([]);
      setViewMode('list');
      onOpenPdfModal(created);
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de la création de la consultation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openQuoteModal = (c: CurrencyConsultation) => {
    setQuoteModalConsultation(c);
    setWinningBankId(c.selectedBankId || banks[0]?.id || 'bank_stb');
    setWinningRate(
      c.negotiatedRate
        ? String(c.negotiatedRate)
        : c.currency === 'EUR'
        ? '3.3250'
        : '3.1150'
    );
    setQuoteNotes(c.notes || '');
  };

  const handleConfirmQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteModalConsultation) return;
    const rate = parseFloat(winningRate);
    if (isNaN(rate) || rate <= 0) return;
    const bank = banks.find(b => b.id === winningBankId);
    const confirmationDate =
      quoteModalConsultation.confirmationDate || quoteModalConsultation.operationDate;
    const existingQuotes = quoteModalConsultation.quotes || [];

    try {
      setIsSavingQuote(true);
      await onRecordQuotes(quoteModalConsultation.id, {
        selectedBankId: winningBankId,
        selectedBankName: bank?.name || winningBankId,
        negotiatedRate: rate,
        confirmationRef:
          quoteModalConsultation.confirmationRef || generateNextConfirmationRef(consultations),
        confirmationDate,
        valueDate:
          quoteModalConsultation.valueDate || computeDefaultValueDate(confirmationDate),
        close: true,
        notes: quoteNotes,
        quotes:
          existingQuotes.length > 0
            ? existingQuotes
            : [
                {
                  bankId: winningBankId,
                  bankName: bank?.name || winningBankId,
                  bankCode: bank?.code,
                  proposedAmount: quoteModalConsultation.totalAmount,
                  isFullAmount: true,
                  rate,
                  feesTnd: 0,
                  validityMinutes: 10,
                  receivedAt: new Date().toISOString(),
                },
              ],
      });
      setQuoteModalConsultation(null);
    } finally {
      setIsSavingQuote(false);
    }
  };

  const availableCurrencies = useMemo(
    () => Array.from(new Set(availableOrders.map(o => o.currency))),
    [availableOrders]
  );

  // =========================================================================
  // MODE CRÉATION : Nouvelle Consultation (analogue à Nouvel Ordre)
  // =========================================================================
  if (viewMode === 'create') {
    return (
      <div className="space-y-4 max-w-6xl mx-auto pb-12">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setViewMode('list');
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-300 px-3.5 py-2 rounded-lg transition-colors shadow-2xs whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la liste des consultations</span>
          </button>

          <div className="text-xs text-slate-500">
            <span className="font-mono font-semibold text-purple-700">
              {availableOrders.length}
            </span>{' '}
            ordre(s) en attente d'achat devise
          </div>
        </div>

        <form
          onSubmit={handleCreateSubmit}
          className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shadow-2xs shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Nouvelle Consultation pour Achat de Devises
                </h2>
                <p className="text-xs text-slate-500">
                  Regroupez un ou plusieurs ordres déposés avec achat de devise exigé et générez la lettre PDF officielle MTK.
                </p>
              </div>
            </div>

            {availableCurrencies.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium mr-1">
                  Sélection rapide :
                </span>
                {availableCurrencies.map(cur => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => selectAllByCurrency(cur)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 rounded-md transition-colors whitespace-nowrap"
                  >
                    Tous en {cur} ({availableOrders.filter(o => o.currency === cur).length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {formError && (
            <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Selection of eligible orders */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Ordres déposés éligibles ({availableOrders.length})
                </h3>
                {selectedOrderIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds([])}
                    className="text-[11px] text-slate-500 hover:text-rose-700 font-medium"
                  >
                    Tout décocher ({selectedOrderIds.length})
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {availableOrders.map(order => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const isDifferentCurrency =
                    activeCurrency !== null && order.currency !== activeCurrency;
                  return (
                    <div
                      key={order.id}
                      onClick={() => !isDifferentCurrency && toggleOrderSelection(order)}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-300 cursor-pointer'
                          : isDifferentCurrency
                          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-blue-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="pt-0.5 text-blue-700 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-blue-800">
                              {order.orderNumber}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {order.beneficiaryName}
                            </span>
                            {order.isDemo && (
                              <span className="text-[9px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                                DÉMO
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {order.purpose}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>
                              Banque dépôt :{' '}
                              <strong className="text-slate-700">{order.bankName}</strong>
                            </span>
                            {order.deposit?.depositDate && (
                              <>
                                <span>·</span>
                                <span className="font-mono">
                                  Déposé le {order.deposit.depositDate}
                                </span>
                              </>
                            )}
                            {isDifferentCurrency && (
                              <span className="text-rose-600 font-medium">
                                (Devise {order.currency} ≠ {activeCurrency})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                          {formatConsultationAmount(order.amount, order.currency)}
                        </div>
                        <div className="text-[10px] text-purple-700 font-semibold">
                          Achat devise exigé
                        </div>
                      </div>
                    </div>
                  );
                })}

                {availableOrders.length === 0 && (
                  <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-1.5">
                    <Landmark className="w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-xs font-semibold text-slate-700">
                      Aucun ordre disponible en attente d'achat devise
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Déposez un ordre signé avec la case « Négociation du cours exigée » cochée pour qu'il apparaisse ici.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (5 cols): Parameters of Consultation PDF */}
            <div className="lg:col-span-5 space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Paramètres du Document PDF
              </h3>

              {/* Computed Amount */}
              <div className="p-3.5 rounded-lg bg-blue-950 text-white space-y-1">
                <div className="flex items-center justify-between text-[11px] text-blue-200">
                  <span>Montant en devise (calculé automatiquement)</span>
                  <span>{selectedOrderIds.length} ordre(s)</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-300">
                  {activeCurrency
                    ? formatConsultationAmount(computedTotalAmount, activeCurrency)
                    : '0.00 —'}
                </div>
                {selectedOrders.length > 0 && (
                  <div className="text-[10px] text-blue-200 font-mono truncate">
                    Ordres : {selectedOrders.map(o => o.orderNumber).join(' + ')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date d’opération <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={operationDate}
                    onChange={e => setOperationDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type d’achat (Date valeur) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={purchaseTypeOption}
                    onChange={e => setPurchaseTypeOption(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                  >
                    <option value="au comptant">au comptant</option>
                    <option value="au comptant (Spot J+2)">au comptant (Spot J+2)</option>
                    <option value="à terme">à terme</option>
                    <option value="à terme 30 jours">à terme 30 jours</option>
                    <option value="AUTRE">Autre (personnalisé)</option>
                  </select>
                </div>
              </div>

              {purchaseTypeOption === 'AUTRE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Préciser le type d’achat / date valeur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : valeur compensée / à terme 60 jours"
                    value={customPurchaseType}
                    onChange={e => setCustomPurchaseType(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Heure limite cotation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : 14h20"
                    value={submissionDeadlineTime}
                    onChange={e => setSubmissionDeadlineTime(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Heure validité offre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : 14h30"
                    value={validityDeadlineTime}
                    onChange={e => setValidityDeadlineTime(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Consulted Banks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Banques destinataires de la consultation
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {banks.map(b => {
                    const checked = consultedBankIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBankSelection(b.id)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                          checked
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {b.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional coordinates toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowContactOptions(!showContactOptions)}
                  className="text-[11px] text-blue-700 hover:underline font-medium"
                >
                  {showContactOptions
                    ? 'Masquer les coordonnées fax / email de l’en-tête'
                    : 'Personnaliser les coordonnées fax / email de l’en-tête (optionnel)'}
                </button>

                {showContactOptions && (
                  <div className="mt-2 space-y-2 p-3 bg-white rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Téléphone N.B.
                      </label>
                      <input
                        type="text"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        E-mail
                      </label>
                      <input
                        type="text"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Numéros de Fax
                      </label>
                      <input
                        type="text"
                        value={faxNumbers}
                        onChange={e => setFaxNumbers(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || selectedOrderIds.length === 0}
                className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Génération en cours...'
                    : 'Créer la Consultation & Générer le PDF'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  // MODE REGISTRE / LISTE (Affichage similaire à OrderListView)
  // =========================================================================
  return (
    <div className="space-y-4">
      {/* Search and Main Filter Header — identique à OrderListView */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Recherche par N° consultation, N° ordre, fournisseur, banque ou réf. confirmation..."
              value={filters.searchQuery || ''}
              onChange={e => {
                setFilters({ ...filters, searchQuery: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
            />
          </div>

          {/* Quick Status & Toolbar Actions */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={filters.status || 'ALL'}
              onChange={e => {
                setFilters({ ...filters, status: e.target.value as any });
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none text-slate-800 font-medium"
            >
              <option value="ALL">Tous les statuts ({consultations.length})</option>
              <option value="OUVERTE">Ouverte</option>
              <option value="CLOTUREE">Clôturée</option>
              <option value="ANNULEE">Annulée</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                showAdvancedFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtres avancés</span>
            </button>

            {onRefresh && (
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                title="Actualiser la liste des consultations"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintConsultationsPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              title="Télécharger / Imprimer le tableau des consultations en PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimer tableau PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('create')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors whitespace-nowrap shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                Nouvelle consultation
                {availableOrders.length > 0 ? ` (${availableOrders.length})` : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Bar — identique à OrderListView */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Devise</label>
              <select
                value={filters.currency || 'ALL'}
                onChange={e => {
                  setFilters({ ...filters, currency: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Toutes devises</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dollar US (USD)</option>
                <option value="GBP">Livre Sterling (GBP)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Banque (consultée ou retenue)
              </label>
              <select
                value={filters.bank || 'ALL'}
                onChange={e => {
                  setFilters({ ...filters, bank: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Toutes les banques</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Exercice budgétaire
              </label>
              <select
                value={filters.fiscalYear || 'ALL'}
                onChange={e => {
                  setFilters({ ...filters, fiscalYear: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Tous exercices</option>
                {fiscalYearOptions.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-1.5 rounded-lg transition-colors font-medium text-center"
              >
                Effacer les filtres
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subtle 1-line notification when orders await currency purchase */}
      {availableOrders.length > 0 && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <Landmark className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              <strong className="font-mono tabular-nums">{availableOrders.length}</strong> ordre(s) en attente d'achat de devise ne sont pas encore rattachés à une consultation.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('create')}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Créer une consultation &rarr;
          </button>
        </div>
      )}

      {/* Consultations Data Table — identique à OrderListView */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <tr>
                <th
                  onClick={() => handleSort('consultationNumber')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>N° Consultation</span>
                    {renderSortIcon('consultationNumber')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('operationDate')}
                  className="py-3 px-2.5 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {renderSortIcon('operationDate')}
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  Bénéficiaire(s) / Ordres regroupés
                </th>
                <th className="py-3 px-2.5 whitespace-nowrap">Type &amp; Heures</th>
                <th
                  onClick={() => handleSort('totalAmount')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Montant</span>
                    {renderSortIcon('totalAmount')}
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Banque retenue &amp; Cours</th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Statut</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="py-3 px-2.5 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedConsultations.map(c => {
                const statusMeta = CONSULTATION_STATUS_META[c.status] || CONSULTATION_STATUS_META.OUVERTE;
                const quotesCount = c.quotes?.length || 0;
                const summary = getConsultationBeneficiarySummary(c, orders);

                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectConsultation(c.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Consultation Number */}
                    <td className="py-3 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{c.consultationNumber}</span>
                        {c.isDemo && (
                          <span
                            className="text-[9px] font-sans font-semibold bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200"
                            title="Donnée de démonstration"
                          >
                            DÉMO
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Operation Date */}
                    <td className="py-3 px-2.5 text-slate-600 whitespace-nowrap font-mono text-[11px] tabular-nums">
                      {c.operationDate || c.createdAt.split('T')[0]}
                    </td>

                    {/* Beneficiaries & Linked Orders */}
                    <td className="py-3 px-3 max-w-[230px]">
                      <div className="font-semibold text-slate-900 truncate">
                        {summary.primaryLabel}
                      </div>
                      <div
                        className="text-[11px] text-slate-500 truncate flex items-center gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {c.orderIds.slice(0, 2).map((oid, idx) => (
                          <React.Fragment key={oid}>
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <button
                              type="button"
                              onClick={() => onSelectOrder(oid)}
                              className="font-mono text-blue-700 hover:underline truncate"
                              title={`Ouvrir l'ordre ${c.orderNumbers[idx] || oid}`}
                            >
                              {c.orderNumbers[idx] || oid}
                            </button>
                          </React.Fragment>
                        ))}
                        {c.orderIds.length > 2 && (
                          <span className="font-mono text-slate-400">
                            +{c.orderIds.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Purchase Type & Deadlines */}
                    <td className="py-3 px-2.5 whitespace-nowrap">
                      <div className="font-medium text-slate-700">{c.purchaseType}</div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {c.submissionDeadlineTime} / {c.validityDeadlineTime}
                      </div>
                    </td>

                    {/* Total Amount & Order Count */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      <div>{formatConsultationAmount(c.totalAmount, c.currency)}</div>
                      <div className="text-[10px] text-slate-400 font-normal font-sans">
                        {c.orderIds.length} ordre{c.orderIds.length > 1 ? 's' : ''} ·{' '}
                        {c.createdBy}
                      </div>
                    </td>

                    {/* Selected Bank & Negotiated Rate */}
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {c.selectedBankName && c.negotiatedRate ? (
                        <>
                          <div className="truncate max-w-[165px] font-medium text-slate-900">
                            {c.selectedBankName}
                          </div>
                          <div className="text-[10px] font-mono font-semibold text-emerald-700 tabular-nums">
                            {c.negotiatedRate.toFixed(4)} TND
                            {c.confirmationRef ? ` · Réf. ${c.confirmationRef}` : ''}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-slate-400 font-medium">—</div>
                          <div className="text-[10px] text-slate-500">
                            {quotesCount > 0
                              ? `${quotesCount} offre(s) bancaire(s)`
                              : 'En attente de cotations'}
                          </div>
                        </>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.badgeBorder}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                          <span>{statusMeta.label}</span>
                        </span>
                        {c.status === 'CLOTUREE' ? (
                          <span className="text-[10px] font-semibold text-emerald-700 pl-0.5">
                            Confirmations prêtes
                          </span>
                        ) : c.status === 'OUVERTE' && quotesCount > 0 ? (
                          <span className="text-[10px] font-semibold text-blue-700 pl-0.5">
                            {quotesCount} cotation(s) saisie(s)
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3 px-2.5 text-center whitespace-nowrap"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectConsultation(c.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          title={
                            c.status === 'OUVERTE'
                              ? 'Saisir les offres & voir le classement'
                              : 'Consulter le dossier de consultation'
                          }
                          aria-label={`Consulter ${c.consultationNumber}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenPdfModal(c)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Aperçu & édition du PDF officiel"
                          aria-label={`Aperçu PDF ${c.consultationNumber}`}
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadConsultationPdf(c, undefined, orders, invoices)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          title="Télécharger la lettre PDF"
                          aria-label={`Télécharger PDF ${c.consultationNumber}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {c.status === 'CLOTUREE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenConfirmationModal(c, 0)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Confirmations d'achat de devises"
                              aria-label={`Confirmations ${c.consultationNumber}`}
                            >
                              <FileCheck2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenConfirmationModal(c, 'recap')}
                              className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-md transition-colors"
                              title="Récapitulatif PDF de la consultation"
                              aria-label={`Récap PDF ${c.consultationNumber}`}
                            >
                              <ClipboardList className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {c.status === 'OUVERTE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openQuoteModal(c)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Clôturer & retenir la cotation"
                              aria-label={`Clôturer ${c.consultationNumber}`}
                            >
                              <Award className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onCancelConsultation(c.id, 'Annulation par le service trésorerie')
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Annuler cette consultation"
                              aria-label={`Annuler ${c.consultationNumber}`}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {canUserManageConsultation(currentUser, c).allowed &&
                          onUpdateConsultation && (
                            <button
                              type="button"
                              onClick={() => setEditingConsultation(c)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                              title={
                                isAdmin
                                  ? 'Modifier la consultation (Administrateur)'
                                  : 'Modifier ma consultation'
                              }
                              aria-label={`Modifier la consultation ${c.consultationNumber}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                        {canUserManageConsultation(currentUser, c).allowed &&
                          onDeleteConsultation && (
                            <button
                              type="button"
                              onClick={() => setDeletingConsultation(c)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              title={
                                isAdmin
                                  ? 'Supprimer la consultation (Administrateur)'
                                  : 'Supprimer ma consultation'
                              }
                              aria-label={`Supprimer la consultation ${c.consultationNumber}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedConsultations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                      <p className="text-xs font-medium text-slate-500">
                        Aucune consultation de change trouvée
                      </p>
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="text-xs text-blue-700 hover:underline font-semibold"
                        >
                          Effacer les filtres &rarr;
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setViewMode('create')}
                          className="text-xs text-blue-700 hover:underline font-semibold"
                        >
                          Créer la première consultation &rarr;
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar — identique à OrderListView */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Affichage de{' '}
              <strong className="text-slate-800 tabular-nums">
                {sortedConsultations.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              à{' '}
              <strong className="text-slate-800 tabular-nums">
                {Math.min(currentPage * pageSize, sortedConsultations.length)}
              </strong>{' '}
              sur{' '}
              <strong className="text-slate-800 tabular-nums">
                {sortedConsultations.length}
              </strong>{' '}
              consultation{sortedConsultations.length > 1 ? 's' : ''}
            </span>

            <div className="flex items-center gap-1">
              <span>Lignes par page :</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <span className="font-mono px-2 font-medium tabular-nums">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Record Winning Quote Modal */}
      {quoteModalConsultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmQuote}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Clôturer &amp; Retenir la Cotation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuoteModalConsultation(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div>
                <strong>Consultation :</strong>{' '}
                <span className="font-mono text-blue-800 font-bold">
                  {quoteModalConsultation.consultationNumber}
                </span>
              </div>
              <div>
                <strong>Montant :</strong>{' '}
                <span className="font-mono font-bold tabular-nums">
                  {formatConsultationAmount(
                    quoteModalConsultation.totalAmount,
                    quoteModalConsultation.currency
                  )}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Banque retenue <span className="text-rose-500">*</span>
              </label>
              <select
                value={winningBankId}
                onChange={e => setWinningBankId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
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
                Cours de change négocié (TND) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                required
                value={winningRate}
                onChange={e => setWinningRate(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observations / Réf. confirmation
              </label>
              <textarea
                rows={2}
                value={quoteNotes}
                onChange={e => setQuoteNotes(e.target.value)}
                placeholder="Ex : Meilleure offre confirmée par téléphone avant 14h30."
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuoteModalConsultation(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSavingQuote}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                Valider &amp; Clôturer
              </button>
            </div>
          </form>
        </div>
      )}

      {editingConsultation && onUpdateConsultation && (
        <AdminEditConsultationModal
          consultation={editingConsultation}
          banks={banks}
          isAdmin={isAdmin}
          onSave={onUpdateConsultation}
          onClose={() => setEditingConsultation(null)}
        />
      )}

      {deletingConsultation && onDeleteConsultation && (
        <AdminConfirmDeleteModal
          title="Supprimer définitivement cette consultation"
          entityRef={deletingConsultation.consultationNumber}
          description={`Vous êtes sur le point de supprimer la consultation ${deletingConsultation.consultationNumber} (${formatConsultationAmount(
            deletingConsultation.totalAmount,
            deletingConsultation.currency
          )}).`}
          warningNote={
            deletingConsultation.orderIds.length > 0
              ? `${deletingConsultation.orderIds.length} ordre(s) rattaché(s) auront leur passerelle change réinitialisée (« NON_DEMARRE ») afin de pouvoir être rattachés à une nouvelle consultation.`
              : undefined
          }
          onConfirm={() => onDeleteConsultation(deletingConsultation.id)}
          onClose={() => setDeletingConsultation(null)}
        />
      )}
    </div>
  );
};
