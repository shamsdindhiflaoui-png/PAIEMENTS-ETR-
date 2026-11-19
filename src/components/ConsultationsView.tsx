import React, { useState, useMemo } from 'react';
import {
  Landmark,
  FileText,
  Download,
  Eye,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  BadgeDollarSign,
  CheckSquare,
  Square,
  Award,
  X,
  FileCheck2,
  ClipboardList,
  Pencil,
  Trash2,
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
  formatConsultationDate,
  formatConsultationTime,
  downloadConsultationPdf,
} from '../utils/consultationPdf';
import {
  computeDefaultValueDate,
  generateNextConfirmationRef,
} from '../utils/purchaseConfirmationPdf';
import { canUserManageConsultation, isAdministrator } from '../utils/adminRules';
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
}) => {
  const [editingConsultation, setEditingConsultation] =
    useState<CurrencyConsultation | null>(null);
  const [deletingConsultation, setDeletingConsultation] =
    useState<CurrencyConsultation | null>(null);

  const isAdmin = isAdministrator(currentUser);
  // Ordres éligibles : déposés à la banque avec achat de devise exigé (EN_ATTENTE_ACHAT_DEVISE)
  const eligibleOrdersAll = useMemo(
    () => orders.filter(o => o.status === 'EN_ATTENTE_ACHAT_DEVISE'),
    [orders]
  );

  // Ordres déjà rattachés à une consultation active (OUVERTE ou CLOTUREE)
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

  // Form state
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
  const [quoteModalConsultation, setQuoteModalConsultation] = useState<CurrencyConsultation | null>(
    null
  );
  const [winningBankId, setWinningBankId] = useState<string>('bank_stb');
  const [winningRate, setWinningRate] = useState<string>('3.1150');
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [isSavingQuote, setIsSavingQuote] = useState<boolean>(false);

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

  // Unique currencies available
  const availableCurrencies = useMemo(
    () => Array.from(new Set(availableOrders.map(o => o.currency))),
    [availableOrders]
  );

  const openConsultationsCount = consultations.filter(c => c.status === 'OUVERTE').length;
  const closedConsultationsCount = consultations.filter(c => c.status === 'CLOTUREE').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* KPI Header Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Ordres à consulter</span>
            <BadgeDollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {availableOrders.length}
          </div>
          <div className="text-[11px] text-purple-700 font-medium mt-1">
            Statut : En attente d'achat devise
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Déjà en consultation</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {eligibleOrdersAll.length - availableOrders.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ordres rattachés à une lettre PDF
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Consultations ouvertes</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1 tabular-nums">
            {openConsultationsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            En attente de cotations bancaires
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Consultations clôturées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            {closedConsultationsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cours négociés & retenus
          </div>
        </div>
      </div>

      {/* Creation Form Section */}
      <form
        onSubmit={handleCreateSubmit}
        className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shadow-2xs">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Créer une Consultation pour Achat de Devises (Module 02)
              </h2>
              <p className="text-xs text-slate-500">
                Regroupez un ou plusieurs ordres déposés avec achat de devise exigé et générez la lettre PDF officielle MTK.
              </p>
            </div>
          </div>

          {availableCurrencies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Sélection rapide :</span>
              {availableCurrencies.map(cur => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => selectAllByCurrency(cur)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-700 rounded-md transition-colors"
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

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
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
                            Banque dépôt : <strong className="text-slate-700">{order.bankName}</strong>
                          </span>
                          {order.deposit?.depositDate && (
                            <>
                              <span>·</span>
                              <span className="font-mono">Déposé le {order.deposit.depositDate}</span>
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

            {/* Computed Amount (Read-only from selected orders) */}
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

      {/* Consultations List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Registre des Consultations d'Achat de Devises ({consultations.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consultez, téléchargez la lettre officielle PDF MTK ou saisissez la cotation bancaire retenue.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {consultations.map(c => {
            const quotesCount = c.quotes?.length || 0;
            return (
              <div
                key={c.id}
                className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectConsultation(c.id)}
                      className="font-mono font-bold text-sm text-blue-800 hover:text-blue-950 hover:underline text-left"
                    >
                      {c.consultationNumber}
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        c.status === 'CLOTUREE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : c.status === 'ANNULEE'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {c.status === 'CLOTUREE'
                        ? 'Clôturée'
                        : c.status === 'ANNULEE'
                        ? 'Annulée'
                        : 'Ouverte'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Opération : {formatConsultationDate(c.operationDate)}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {c.purchaseType}
                    </span>
                    <span className="text-xs font-mono text-slate-600">
                      Heures : <strong>{c.submissionDeadlineTime}</strong> /{' '}
                      <strong>{c.validityDeadlineTime}</strong>
                    </span>
                    {quotesCount > 0 && (
                      <span className="text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                        {quotesCount} offre(s) bancaire(s)
                      </span>
                    )}
                  </div>

                  {/* Linked Order Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-slate-500 text-[11px]">Ordres regroupés :</span>
                    {c.orderIds.map((oid, idx) => (
                      <button
                        key={oid}
                        type="button"
                        onClick={() => onSelectOrder(oid)}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 font-mono font-semibold text-[11px] border border-blue-200 transition-colors"
                      >
                        {c.orderNumbers[idx] || oid}
                      </button>
                    ))}
                  </div>

                  {c.selectedBankName && c.negotiatedRate && (
                    <div className="text-xs text-emerald-800 font-medium flex items-center gap-1.5 pt-0.5">
                      <Award className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Banque retenue : <strong>{c.selectedBankName}</strong> au cours de{' '}
                        <strong className="font-mono">{c.negotiatedRate.toFixed(4)} TND</strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                      {formatConsultationAmount(c.totalAmount, c.currency)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Créée par {c.createdBy}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectConsultation(c.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      <span>
                        {c.status === 'OUVERTE'
                          ? quotesCount > 0
                            ? 'Offres & Classement'
                            : 'Saisir offres banques'
                          : 'Voir classement'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPdfModal(c)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Aperçu PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadConsultationPdf(c, undefined, orders, invoices)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    {c.status === 'CLOTUREE' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenConfirmationModal(c, 0)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Confirmations d'achat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenConfirmationModal(c, 'recap')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>Récap PDF</span>
                        </button>
                      </>
                    )}

                    {c.status === 'OUVERTE' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openQuoteModal(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Clôturer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelConsultation(c.id, 'Annulation par le service trésorerie')}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Annuler cette consultation"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {canUserManageConsultation(currentUser, c).allowed && onUpdateConsultation && (
                      <button
                        type="button"
                        onClick={() => setEditingConsultation(c)}
                        className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors"
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

                    {canUserManageConsultation(currentUser, c).allowed && onDeleteConsultation && (
                      <button
                        type="button"
                        onClick={() => setDeletingConsultation(c)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
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
                </div>
              </div>
            );
          })}

          {consultations.length === 0 && (
            <div className="p-10 text-center text-xs text-slate-400">
              Aucune consultation créée pour le moment. Sélectionnez un ou plusieurs ordres ci-dessus pour générer votre première lettre de consultation PDF.
            </div>
          )}
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
                  Clôturer & Retenir la Cotation
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
                <span className="font-mono font-bold">
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
                Valider & Clôturer
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
          description={`Vous êtes sur le point de supprimer la consultation ${deletingConsultation.consultationNumber} (${formatConsultationAmount(deletingConsultation.totalAmount, deletingConsultation.currency)}).`}
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
