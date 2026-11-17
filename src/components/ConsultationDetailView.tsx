import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Eye,
  Download,
  Award,
  CheckCircle2,
  AlertCircle,
  Ban,
  Save,
  Plus,
  Trash2,
  ArrowUpDown,
  TrendingDown,
  Landmark,
  FileCheck2,
  X,
  ClipboardList,
  Printer,
  Pencil,
} from 'lucide-react';
import {
  Bank,
  CurrencyConsultation,
  ExchangeQuote,
  PaymentOrder,
  User,
} from '../types/payment';
import {
  formatConsultationAmount,
  formatConsultationDate,
  formatConsultationTime,
  downloadConsultationPdf,
} from '../utils/consultationPdf';
import {
  BankOfferDraft,
  RankedBankOffer,
  buildInitialOfferDrafts,
  parseOfferDraftsToQuotes,
  rankBankOffers,
  computeOfferRankingSummary,
} from '../utils/consultationQuotes';
import {
  buildPurchaseConfirmations,
  computeDefaultValueDate,
  generateNextConfirmationRef,
} from '../utils/purchaseConfirmationPdf';
import { formatTndCurrency, STATUS_META } from '../utils/workflowRules';
import { downloadTablePdf } from '../utils/tablePdf';
import { canUserManageConsultation, isAdministrator } from '../utils/adminRules';
import { AdminEditConsultationModal } from './AdminEditConsultationModal';
import { AdminConfirmDeleteModal } from './AdminConfirmDeleteModal';

interface ConsultationDetailViewProps {
  consultation: CurrencyConsultation;
  orders: PaymentOrder[];
  consultations: CurrencyConsultation[];
  banks: Bank[];
  currentUser?: User;
  onBack: () => void;
  onOpenPdfModal: (consultation: CurrencyConsultation) => void;
  onOpenConfirmationModal: (consultation: CurrencyConsultation, initialTab?: 'recap' | number) => void;
  onSelectOrder: (orderId: string) => void;
  onNavigateToOrders?: () => void;
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
}

export const ConsultationDetailView: React.FC<ConsultationDetailViewProps> = ({
  consultation,
  orders,
  consultations,
  banks,
  currentUser,
  onBack,
  onOpenPdfModal,
  onOpenConfirmationModal,
  onSelectOrder,
  onNavigateToOrders,
  onRecordQuotes,
  onCancelConsultation,
  onUpdateConsultation,
  onDeleteConsultation,
}) => {
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminDeleteOpen, setAdminDeleteOpen] = useState(false);

  const isAdmin = isAdministrator(currentUser);
  const canManageConsultation = canUserManageConsultation(currentUser, consultation).allowed;
  const [drafts, setDrafts] = useState<BankOfferDraft[]>(() =>
    buildInitialOfferDrafts(banks, consultation)
  );
  const [sessionNotes, setSessionNotes] = useState<string>(consultation.notes || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [bankToAddId, setBankToAddId] = useState<string>('');
  const [closingOffer, setClosingOffer] = useState<RankedBankOffer | null>(null);
  const [confRef, setConfRef] = useState<string>('');
  const [confDate, setConfDate] = useState<string>(consultation.operationDate);
  const [confValueDate, setConfValueDate] = useState<string>(() =>
    computeDefaultValueDate(consultation.operationDate)
  );

  // Re-sync drafts when switching to another consultation or after server update
  useEffect(() => {
    setDrafts(buildInitialOfferDrafts(banks, consultation));
    setSessionNotes(consultation.notes || '');
    setErrorMsg(null);
    setIsDirty(false);
    setClosingOffer(null);
  }, [consultation.id, consultation.quotes, consultation.status, consultation.notes, banks]);

  const isReadOnly = consultation.status !== 'OUVERTE';

  const remainingBanksToAdd = useMemo(() => {
    const presentIds = new Set(drafts.map(d => d.bankId));
    return banks.filter(b => !presentIds.has(b.id));
  }, [banks, drafts]);

  const handleToggleFullAmount = (bankId: string, checked: boolean) => {
    setErrorMsg(null);
    setIsDirty(true);
    setDrafts(prev =>
      prev.map(d => {
        if (d.bankId !== bankId) return d;
        return {
          ...d,
          isFullAmount: checked,
          proposedAmount: checked
            ? String(consultation.totalAmount)
            : d.proposedAmount === String(consultation.totalAmount)
            ? ''
            : d.proposedAmount,
        };
      })
    );
  };

  const handleAmountChange = (bankId: string, value: string) => {
    setErrorMsg(null);
    setIsDirty(true);
    setDrafts(prev =>
      prev.map(d => (d.bankId === bankId ? { ...d, proposedAmount: value } : d))
    );
  };

  const handleRateChange = (bankId: string, value: string) => {
    setErrorMsg(null);
    setIsDirty(true);
    setDrafts(prev =>
      prev.map(d => (d.bankId === bankId ? { ...d, rate: value } : d))
    );
  };

  const handleClearBankOffer = (bankId: string) => {
    setErrorMsg(null);
    setIsDirty(true);
    setDrafts(prev =>
      prev.map(d =>
        d.bankId === bankId
          ? {
              ...d,
              isFullAmount: true,
              proposedAmount: String(consultation.totalAmount),
              rate: '',
            }
          : d
      )
    );
  };

  const handleAddBankRow = () => {
    if (!bankToAddId) return;
    const bank = banks.find(b => b.id === bankToAddId);
    if (!bank) return;
    setDrafts(prev => [
      ...prev,
      {
        bankId: bank.id,
        bankName: bank.name,
        bankCode: bank.code,
        isFullAmount: true,
        proposedAmount: String(consultation.totalAmount),
        rate: '',
      },
    ]);
    setBankToAddId('');
    setIsDirty(true);
  };

  // Live parsed & ranked offers (du moins-disant au plus-disant)
  const parsedLive = useMemo(
    () => parseOfferDraftsToQuotes(drafts, consultation.totalAmount),
    [drafts, consultation.totalAmount]
  );

  const rankedOffers = useMemo(() => {
    // When read-only (clôturée/annulée), rank persisted quotes; otherwise live drafts
    const sourceQuotes =
      isReadOnly && consultation.quotes && consultation.quotes.length > 0
        ? consultation.quotes
        : parsedLive.quotes;
    return rankBankOffers(sourceQuotes, consultation.totalAmount);
  }, [isReadOnly, consultation.quotes, parsedLive.quotes, consultation.totalAmount]);

  const rankingSummary = useMemo(
    () => computeOfferRankingSummary(rankedOffers, consultation.totalAmount),
    [rankedOffers, consultation.totalAmount]
  );

  const handleSaveOffers = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    if (parsedLive.errors.length > 0) {
      setErrorMsg(parsedLive.errors[0]);
      return;
    }

    if (parsedLive.quotes.length === 0) {
      setErrorMsg('Veuillez saisir au moins une cote / offre bancaire avant d’enregistrer.');
      return;
    }

    try {
      setIsSaving(true);
      await onRecordQuotes(consultation.id, {
        quotes: parsedLive.quotes,
        close: false,
        notes: sessionNotes,
      });
      setIsDirty(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l’enregistrement des offres');
    } finally {
      setIsSaving(false);
    }
  };

  const previewLetters = useMemo(() => {
    if (!closingOffer) return [];
    return buildPurchaseConfirmations(consultation, orders, banks, {
      selectedBankId: closingOffer.bankId,
      selectedBankName: closingOffer.bankName,
      negotiatedRate: closingOffer.rate,
      confirmationRef: confRef,
      confirmationDate: confDate,
      valueDate: confValueDate,
    });
  }, [closingOffer, consultation, orders, banks, confRef, confDate, confValueDate]);

  const closedLettersCount = useMemo(() => {
    if (consultation.status !== 'CLOTUREE') return 0;
    return buildPurchaseConfirmations(consultation, orders, banks).length;
  }, [consultation, orders, banks]);

  const handleOpenCloseModal = (winner: RankedBankOffer) => {
    setErrorMsg(null);
    if (parsedLive.errors.length > 0) {
      setErrorMsg(parsedLive.errors[0]);
      return;
    }
    const baseDate = consultation.confirmationDate || consultation.operationDate;
    setConfRef(consultation.confirmationRef || generateNextConfirmationRef(consultations));
    setConfDate(baseDate);
    setConfValueDate(consultation.valueDate || computeDefaultValueDate(baseDate));
    setClosingOffer(winner);
  };

  const handleConfirmCloseWithOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingOffer) return;
    setErrorMsg(null);

    try {
      setIsSaving(true);
      await onRecordQuotes(consultation.id, {
        quotes: parsedLive.quotes,
        selectedBankId: closingOffer.bankId,
        selectedBankName: closingOffer.bankName,
        negotiatedRate: closingOffer.rate,
        confirmationRef: confRef.trim() || undefined,
        confirmationDate: confDate || undefined,
        valueDate: confValueDate || undefined,
        close: true,
        notes: sessionNotes,
      });
      setClosingOffer(null);
      setIsDirty(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la clôture de la consultation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-300 px-3.5 py-2 rounded-lg transition-colors self-start shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux consultations</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenPdfModal(consultation)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Aperçu PDF officiel</span>
          </button>

          <button
            type="button"
            onClick={() => downloadConsultationPdf(consultation)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Télécharger le PDF</span>
          </button>

          {consultation.status === 'CLOTUREE' && (
            <>
              <button
                type="button"
                onClick={() => onOpenConfirmationModal(consultation, 0)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>
                  Confirmations d'achat{closedLettersCount > 0 ? ` (${closedLettersCount})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenConfirmationModal(consultation, 'recap')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Récap PDF</span>
              </button>
            </>
          )}

          {consultation.status === 'OUVERTE' && (
            <button
              type="button"
              onClick={() => {
                onCancelConsultation(consultation.id, 'Annulation par la trésorerie');
                onBack();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Annuler</span>
            </button>
          )}

          {canManageConsultation && onUpdateConsultation && (
            <button
              type="button"
              onClick={() => setAdminEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors shadow-2xs"
              title={
                isAdmin
                  ? 'Modifier la consultation (Administrateur)'
                  : 'Modifier ma consultation'
              }
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>
          )}

          {canManageConsultation && onDeleteConsultation && (
            <button
              type="button"
              onClick={() => setAdminDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg transition-colors shadow-2xs"
              title={
                isAdmin
                  ? 'Supprimer la consultation (Administrateur)'
                  : 'Supprimer ma consultation'
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </button>
          )}
        </div>
      </div>

      {/* Consultation Summary Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-bold text-lg text-blue-800">
                {consultation.consultationNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  consultation.status === 'CLOTUREE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : consultation.status === 'ANNULEE'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {consultation.status === 'CLOTUREE'
                  ? 'Clôturée'
                  : consultation.status === 'ANNULEE'
                  ? 'Annulée'
                  : 'Ouverte · Saisie des offres'}
              </span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-medium">
                {consultation.purchaseType}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
              <span>
                Opération du{' '}
                <strong className="font-mono text-slate-900">
                  {formatConsultationDate(consultation.operationDate)}
                </strong>
              </span>
              <span>·</span>
              <span>
                Limite cotation :{' '}
                <strong className="font-mono text-slate-900">
                  {formatConsultationTime(consultation.submissionDeadlineTime)}
                </strong>
              </span>
              <span>·</span>
              <span>
                Validité offre :{' '}
                <strong className="font-mono text-slate-900">
                  {formatConsultationTime(consultation.validityDeadlineTime)}
                </strong>
              </span>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-xl px-5 py-3 text-right shrink-0">
            <div className="text-[11px] text-blue-300 font-medium uppercase tracking-wider">
              Montant total de la consultation
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums mt-0.5">
              {formatConsultationAmount(consultation.totalAmount, consultation.currency)}
            </div>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium">Ordres regroupés :</span>
            {consultation.orderIds.map((oid, idx) => {
              const liveOrder = orders.find(o => o.id === oid);
              const liveStatusMeta = liveOrder ? STATUS_META[liveOrder.status] : null;
              return (
                <button
                  key={oid}
                  type="button"
                  onClick={() => onSelectOrder(oid)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 font-mono font-semibold border border-blue-200 transition-colors"
                >
                  <span>{consultation.orderNumbers[idx] || oid}</span>
                  {liveStatusMeta && (
                    <span
                      className={`font-sans text-[10px] px-1.5 py-0.2 rounded border ${liveStatusMeta.badgeBg} ${liveStatusMeta.badgeText} ${liveStatusMeta.badgeBorder}`}
                    >
                      {liveStatusMeta.label}
                    </span>
                  )}
                </button>
              );
            })}
            {consultation.status === 'CLOTUREE' && onNavigateToOrders && (
              <button
                type="button"
                onClick={onNavigateToOrders}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline ml-1"
              >
                Voir la liste des ordres actualisée &rarr;
              </button>
            )}
          </div>

          {consultation.selectedBankName && consultation.negotiatedRate && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
                <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Adjudicataire : <strong>{consultation.selectedBankName}</strong> au cours de{' '}
                  <strong className="font-mono">{consultation.negotiatedRate.toFixed(4)} TND</strong>
                </span>
              </div>
              {consultation.status === 'CLOTUREE' && (
                <button
                  type="button"
                  onClick={() => onOpenConfirmationModal(consultation)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Voir confirmations ({closedLettersCount || 1})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: SAISIE DES OFFRES PAR BANQUE */}
      <form
        onSubmit={handleSaveOffers}
        className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                1. Saisie des montants proposés et cotes reçues par banque
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cochez « Montant total » si la banque couvre l’intégralité ({formatConsultationAmount(consultation.totalAmount, consultation.currency)}), sinon décochez pour saisir le montant partiel proposé, puis entrez la cote reçue.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="text-xs font-mono font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
              {rankedOffers.length} / {drafts.length} banque(s) cotée(s)
            </div>
            <button
              type="button"
              onClick={() =>
                downloadTablePdf({
                  title: `Tableau des Cotations Bancaires - ${consultation.consultationNumber}`,
                  subtitle: `Opération du ${formatConsultationDate(
                    consultation.operationDate
                  )} | Montant : ${formatConsultationAmount(
                    consultation.totalAmount,
                    consultation.currency
                  )}`,
                  filename: `Cotations_${consultation.consultationNumber}_MTK.pdf`,
                  columns: [
                    { header: 'Banque', widthRatio: 2.0 },
                    { header: 'Couverture', align: 'center', widthRatio: 1.0 },
                    { header: `Montant proposé (${consultation.currency})`, align: 'right', widthRatio: 1.4 },
                    { header: 'Cote reçue (TND)', align: 'right', widthRatio: 1.2 },
                    { header: 'Contre-valeur estimée', align: 'right', widthRatio: 1.4 },
                  ],
                  rows: drafts.map(draft => {
                    const parsedRate = parseFloat((draft.rate || '').replace(',', '.'));
                    const effectiveAmount = draft.isFullAmount
                      ? consultation.totalAmount
                      : parseFloat((draft.proposedAmount || '').replace(/\s+/g, '').replace(',', '.'));
                    const hasValidPreview =
                      !isNaN(parsedRate) &&
                      parsedRate > 0 &&
                      !isNaN(effectiveAmount) &&
                      effectiveAmount > 0;
                    const counterValue = hasValidPreview
                      ? Number((effectiveAmount * parsedRate).toFixed(3))
                      : 0;
                    return [
                      `${draft.bankName} (${draft.bankCode || 'BQ'})`,
                      draft.isFullAmount ? 'Total' : 'Partiel',
                      !isNaN(effectiveAmount) && effectiveAmount > 0
                        ? formatConsultationAmount(effectiveAmount, consultation.currency)
                        : '-',
                      !isNaN(parsedRate) && parsedRate > 0 ? `${parsedRate.toFixed(4)} TND` : '-',
                      hasValidPreview ? formatTndCurrency(counterValue) : '-',
                    ];
                  }),
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimer tableau PDF</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Banque</th>
                <th className="py-3 px-4 text-center">Montant total ?</th>
                <th className="py-3 px-4">Montant proposé ({consultation.currency})</th>
                <th className="py-3 px-4">Cote / Cours reçu (TND)</th>
                <th className="py-3 px-4 text-right">Contre-valeur estimée</th>
                {!isReadOnly && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {drafts.map(draft => {
                const bankObj = banks.find(b => b.id === draft.bankId);
                const parsedRate = parseFloat((draft.rate || '').replace(',', '.'));
                const effectiveAmount = draft.isFullAmount
                  ? consultation.totalAmount
                  : parseFloat((draft.proposedAmount || '').replace(/\s+/g, '').replace(',', '.'));
                const hasValidPreview =
                  !isNaN(parsedRate) &&
                  parsedRate > 0 &&
                  !isNaN(effectiveAmount) &&
                  effectiveAmount > 0;
                const counterValue = hasValidPreview
                  ? Number((effectiveAmount * parsedRate).toFixed(3))
                  : 0;

                return (
                  <tr
                    key={draft.bankId}
                    className={`transition-colors ${
                      hasValidPreview ? 'bg-blue-50/20' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[10px]">
                          {draft.bankCode || bankObj?.code || 'BQ'}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900">{draft.bankName}</div>
                          {bankObj?.swiftCode && (
                            <div className="text-[10px] font-mono text-slate-400">
                              SWIFT : {bankObj.swiftCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={draft.isFullAmount}
                          disabled={isReadOnly}
                          onChange={e => handleToggleFullAmount(draft.bankId, e.target.checked)}
                          aria-label={`Montant total pour ${draft.bankName}`}
                          className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500 cursor-pointer disabled:opacity-60"
                        />
                        <span
                          className={`text-[11px] font-semibold ${
                            draft.isFullAmount ? 'text-blue-700' : 'text-slate-500'
                          }`}
                        >
                          {draft.isFullAmount ? 'Total' : 'Partiel'}
                        </span>
                      </label>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={consultation.totalAmount}
                          disabled={draft.isFullAmount || isReadOnly}
                          value={
                            draft.isFullAmount
                              ? String(consultation.totalAmount)
                              : draft.proposedAmount
                          }
                          onChange={e => handleAmountChange(draft.bankId, e.target.value)}
                          placeholder={`Max ${consultation.totalAmount}`}
                          aria-label={`Montant proposé par ${draft.bankName}`}
                          className={`w-36 font-mono font-semibold text-xs rounded-lg px-2.5 py-1.5 border focus:outline-none ${
                            draft.isFullAmount
                              ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-900 border-blue-300 focus:ring-2 focus:ring-blue-500/20'
                          }`}
                        />
                        <span className="text-[11px] font-mono text-slate-500">
                          {consultation.currency}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          disabled={isReadOnly}
                          value={draft.rate}
                          onChange={e => handleRateChange(draft.bankId, e.target.value)}
                          placeholder={consultation.currency === 'EUR' ? 'Ex : 3.3250' : 'Ex : 3.1120'}
                          aria-label={`Cote reçue de ${draft.bankName}`}
                          className="w-32 font-mono font-bold text-xs bg-white text-slate-900 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                        />
                        <span className="text-[11px] font-mono text-slate-500">TND</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {hasValidPreview ? formatTndCurrency(counterValue) : '—'}
                    </td>

                    {!isReadOnly && (
                      <td className="py-3.5 px-3 text-center">
                        {draft.rate || !draft.isFullAmount ? (
                          <button
                            type="button"
                            onClick={() => handleClearBankOffer(draft.bankId)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title={`Effacer l'offre de ${draft.bankName}`}
                            aria-label={`Effacer l'offre de ${draft.bankName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer of Saisie Table */}
        <div className="p-5 bg-slate-50/70 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {!isReadOnly && remainingBanksToAdd.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={bankToAddId}
                  onChange={e => setBankToAddId(e.target.value)}
                  aria-label="Ajouter une banque du référentiel"
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  <option value="">+ Ajouter une autre banque...</option>
                  {remainingBanksToAdd.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!bankToAddId}
                  onClick={handleAddBankRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            )}

            <input
              type="text"
              disabled={isReadOnly}
              value={sessionNotes}
              onChange={e => {
                setSessionNotes(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Observations de la séance de change (optionnel)..."
              className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-3 shrink-0">
              {isDirty && (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                  Modifications non enregistrées
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 rounded-lg shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer les offres reçues'}
                </span>
              </button>
            </div>
          )}
        </div>
      </form>

      {/* SECTION 2: CLASSEMENT DU MOINS-DISANT AU PLUS-DISANT */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ArrowUpDown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                2. Classement des Offres Reçues (du Moins-Disant au Plus-Disant)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tri automatique du cours d’achat le plus avantageux (moins-disant, rang #1) vers le cours le plus élevé (plus-disant).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {rankingSummary.bestOffer && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <span>
                  Moins-disant : {rankingSummary.bestOffer.bankCode || rankingSummary.bestOffer.bankName}{' '}
                  ({rankingSummary.bestOffer.rate.toFixed(4)} TND)
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                downloadTablePdf({
                  title: `Classement des Offres (Moins-Disant) - ${consultation.consultationNumber}`,
                  subtitle: `Opération du ${formatConsultationDate(
                    consultation.operationDate
                  )} | Montant : ${formatConsultationAmount(
                    consultation.totalAmount,
                    consultation.currency
                  )}`,
                  filename: `Classement_Offres_${consultation.consultationNumber}_MTK.pdf`,
                  columns: [
                    { header: 'Rang', widthRatio: 1.1 },
                    { header: 'Banque', widthRatio: 1.8 },
                    { header: 'Montant proposé', align: 'right', widthRatio: 1.4 },
                    { header: 'Cote (TND)', align: 'right', widthRatio: 1.0 },
                    { header: 'Contre-valeur TND', align: 'right', widthRatio: 1.3 },
                    { header: 'Écart vs Moins-Disant', align: 'right', widthRatio: 1.4 },
                    { header: 'Décision', align: 'center', widthRatio: 1.1 },
                  ],
                  rows: rankedOffers.map(offer => {
                    const isSelectedWinner =
                      consultation.status === 'CLOTUREE' &&
                      consultation.selectedBankId === offer.bankId;
                    return [
                      offer.isLowestRate
                        ? '#1 - Moins-disant'
                        : offer.isHighestRate
                        ? `#${offer.rank} - Plus-disant`
                        : `#${offer.rank}`,
                      `${offer.bankName}${offer.bankCode ? ` (${offer.bankCode})` : ''}`,
                      `${formatConsultationAmount(offer.proposedAmount, consultation.currency)} (${
                        offer.isFullAmount ? '100%' : `${offer.coveragePercent}%`
                      })`,
                      offer.rate.toFixed(4),
                      formatTndCurrency(offer.counterValueTnd),
                      offer.isLowestRate
                        ? 'Meilleure offre'
                        : `+${offer.spreadVsBestRate.toFixed(4)} TND`,
                      consultation.status === 'OUVERTE'
                        ? offer.isLowestRate
                          ? 'Recommandée'
                          : 'En concurrence'
                        : isSelectedWinner
                        ? 'Offre retenue'
                        : 'Non retenue',
                    ];
                  }),
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimer tableau PDF</span>
            </button>
          </div>
        </div>

        {rankedOffers.length > 0 ? (
          <>
            {/* Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 bg-slate-50/70 border-b border-slate-100">
              <div className="bg-white rounded-lg border border-emerald-200 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  1er · Offre Moins-Disante
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {rankingSummary.bestOffer?.bankName}
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-700 tabular-nums whitespace-nowrap shrink-0 ml-2">
                    {rankingSummary.bestOffer?.rate.toFixed(4)} TND
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Montant proposé :{' '}
                  <strong className="font-mono text-slate-700">
                    {formatConsultationAmount(
                      rankingSummary.bestOffer?.proposedAmount || 0,
                      consultation.currency
                    )}
                  </strong>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Offre Plus-Disante
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {rankingSummary.worstOffer?.bankName}
                  </span>
                  <span className="text-base font-bold font-mono text-slate-700 tabular-nums whitespace-nowrap shrink-0 ml-2">
                    {rankingSummary.worstOffer?.rate.toFixed(4)} TND
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Écart de cours :{' '}
                  <strong className="font-mono text-slate-700">
                    +{rankingSummary.maxSpreadRate.toFixed(4)} TND
                  </strong>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-blue-200 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Économie potentielle vs Plus-Disant
                </div>
                <div className="mt-1 text-lg font-bold font-mono text-blue-900 tabular-nums">
                  {formatTndCurrency(rankingSummary.potentialSavingsTnd)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {rankingSummary.fullCoverageCount} offre(s) couvrant 100% du besoin
                </div>
              </div>
            </div>

            {/* Ranked Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Rang</th>
                    <th className="py-3 px-4">Banque</th>
                    <th className="py-3 px-4">Montant proposé</th>
                    <th className="py-3 px-4">Cote / Cours (TND)</th>
                    <th className="py-3 px-4 text-right">Contre-valeur TND</th>
                    <th className="py-3 px-4 text-right">Écart vs Moins-Disant</th>
                    <th className="py-3 px-4 text-right">Décision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rankedOffers.map(offer => {
                    const isSelectedWinner =
                      consultation.status === 'CLOTUREE' &&
                      consultation.selectedBankId === offer.bankId;
                    return (
                      <tr
                        key={offer.bankId}
                        className={
                          isSelectedWinner
                            ? 'bg-emerald-50/70'
                            : offer.isLowestRate
                            ? 'bg-emerald-50/30'
                            : 'hover:bg-slate-50/60'
                        }
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {offer.isLowestRate ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              #1 · Moins-disant
                            </span>
                          ) : offer.isHighestRate ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              #{offer.rank} · Plus-disant
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              #{offer.rank}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{offer.bankName}</div>
                          {offer.bankCode && (
                            <div className="text-[10px] font-mono text-slate-400">
                              {offer.bankCode}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900 tabular-nums">
                            {formatConsultationAmount(offer.proposedAmount, consultation.currency)}
                          </div>
                          <div className="mt-0.5">
                            {offer.isFullAmount ? (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                Montant total (100%)
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                Partiel ({offer.coveragePercent}%)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-900 tabular-nums">
                          {offer.rate.toFixed(4)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatTndCurrency(offer.counterValueTnd)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                          {offer.isLowestRate ? (
                            <span className="text-emerald-700 font-semibold">Meilleure offre</span>
                          ) : (
                            <div className="text-rose-700">
                              <div>+{offer.spreadVsBestRate.toFixed(4)} TND</div>
                              <div className="text-[10px] text-slate-500">
                                (+{formatTndCurrency(offer.extraCostOnFullAmountTnd)} sur total)
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {consultation.status === 'OUVERTE' ? (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleOpenCloseModal(offer)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                offer.isLowestRate
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>Retenir & Clôturer</span>
                            </button>
                          ) : isSelectedWinner ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Offre retenue</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Non retenue</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Smart Coverage Allocation Notice if #1 is partial */}
            {rankingSummary.bestOffer && !rankingSummary.bestOffer.isFullAmount && (
              <div className="p-4 bg-amber-50/70 border-t border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Couverture partielle sur l’offre #1 ({rankingSummary.bestOffer.bankName}) — Répartition recommandée par ordre moins-disant :
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-5">
                  {rankingSummary.allocationSteps.map(step => (
                    <span
                      key={step.bankId}
                      className="px-2.5 py-1 rounded-md bg-white border border-amber-200 font-mono text-[11px]"
                    >
                      #{step.rank} {step.bankName} :{' '}
                      <strong>
                        {formatConsultationAmount(step.allocatedAmount, consultation.currency)}
                      </strong>{' '}
                      à {step.rate.toFixed(4)} TND
                    </span>
                  ))}
                  {rankingSummary.remainingUncoveredAmount > 0 && (
                    <span className="px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-200 font-semibold">
                      Reste non couvert :{' '}
                      {formatConsultationAmount(
                        rankingSummary.remainingUncoveredAmount,
                        consultation.currency
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-10 text-center text-xs text-slate-400">
            Saisissez ci-dessus les montants proposés et les cotes reçues pour les banques afin d’afficher automatiquement le classement du moins-disant au plus-disant.
          </div>
        )}
      </div>

      {/* Modal de confirmation d'achat & génération des lettres */}
      {closingOffer && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmCloseWithOffer}
            className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Retenir l’offre & Générer la Confirmation d’Achat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClosingOffer(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
                aria-label="Fermer la fenêtre de confirmation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-800 font-semibold">Banque d’achat retenue :</span>
                <span className="font-bold text-slate-900">{closingOffer.bankName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-800 font-semibold">Cours retenu :</span>
                <span className="font-mono font-bold text-emerald-900">
                  {closingOffer.rate.toFixed(4)} TND
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-800 font-semibold">Montant :</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatConsultationAmount(consultation.totalAmount, consultation.currency)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Réf. Confirmation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={confRef}
                  onChange={e => setConfRef(e.target.value)}
                  placeholder="Ex : 102/26"
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date confirmation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={confDate}
                  onChange={e => setConfDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date de valeur <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={confValueDate}
                  onChange={e => setConfValueDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
                />
              </div>
            </div>

            {/* Règle métier Domiciliation vs Achat */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Lettres générées automatiquement :</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  {previewLetters.length} confirmation{previewLetters.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                {previewLetters.length === 1 && previewLetters[0].role === 'SAME_BANK_PURCHASE'
                  ? 'Banque de domiciliation = Banque d’achat : une seule lettre de confirmation sera générée.'
                  : 'Banque(s) de domiciliation ≠ Banque d’achat : une lettre avec instructions de virement BCT sera générée pour chaque banque de domiciliation, plus une lettre pour la banque d’achat.'}
              </p>
              <ul className="space-y-1 pt-1">
                {previewLetters.map((letter, idx) => (
                  <li
                    key={letter.id}
                    className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200 text-[11px]"
                  >
                    <span className="font-semibold text-slate-800">
                      {idx + 1}. {letter.title}
                    </span>
                    <span className="font-mono text-slate-500">{letter.destLabel}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosingOffer(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 rounded-lg shadow-xs"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>
                  {isSaving ? 'Génération...' : 'Confirmer & Générer les PDF'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {adminEditOpen && onUpdateConsultation && (
        <AdminEditConsultationModal
          consultation={consultation}
          banks={banks}
          isAdmin={isAdmin}
          onSave={onUpdateConsultation}
          onClose={() => setAdminEditOpen(false)}
        />
      )}

      {adminDeleteOpen && onDeleteConsultation && (
        <AdminConfirmDeleteModal
          title="Supprimer définitivement cette consultation"
          entityRef={consultation.consultationNumber}
          description={`Vous êtes sur le point de supprimer la consultation ${consultation.consultationNumber} (${formatConsultationAmount(consultation.totalAmount, consultation.currency)}).`}
          warningNote={
            consultation.orderIds.length > 0
              ? `${consultation.orderIds.length} ordre(s) rattaché(s) auront leur passerelle change réinitialisée (« NON_DEMARRE ») afin de pouvoir être rattachés à une nouvelle consultation.`
              : undefined
          }
          onConfirm={async () => {
            await onDeleteConsultation(consultation.id);
            onBack();
          }}
          onClose={() => setAdminDeleteOpen(false)}
        />
      )}
    </div>
  );
};
