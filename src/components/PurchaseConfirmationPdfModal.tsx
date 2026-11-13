import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  FileCheck2,
  Building2,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import {
  Bank,
  BankConfirmationContact,
  CurrencyConsultation,
  PaymentOrder,
  PurchaseConfirmationLetter,
  PurchaseConfirmationOrderLine,
} from '../types/payment';
import {
  buildPurchaseConfirmations,
  buildLetterIntroSegments,
  buildOrderBulletSegments,
  buildLetterClosingSegments,
  downloadPurchaseConfirmationPdf,
  formatContactOrderTypesTag,
  formatRate4,
  formatTndCounterValue,
  RichSegment,
} from '../utils/purchaseConfirmationPdf';
import {
  buildPurchaseConfirmationRecapData,
  downloadPurchaseConfirmationRecapPdf,
} from '../utils/purchaseConfirmationRecapPdf';
import { formatConsultationAmount, formatConsultationDate } from '../utils/consultationPdf';

interface PurchaseConfirmationPdfModalProps {
  consultation: CurrencyConsultation;
  orders: PaymentOrder[];
  banks: Bank[];
  initialTab?: 'recap' | number;
  onClose: () => void;
}

const RenderRichText: React.FC<{ segments: RichSegment[] }> = ({ segments }) => (
  <>
    {segments.map((seg, idx) => {
      const classes = [
        seg.bold ? 'font-bold' : '',
        seg.underline ? 'underline underline-offset-2' : '',
        seg.color ? 'text-blue-700' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return (
        <span key={idx} className={classes || undefined}>
          {seg.text}
        </span>
      );
    })}
  </>
);

export const PurchaseConfirmationPdfModal: React.FC<PurchaseConfirmationPdfModalProps> = ({
  consultation,
  orders,
  banks,
  initialTab = 0,
  onClose,
}) => {
  const letters = useMemo(
    () => buildPurchaseConfirmations(consultation, orders, banks),
    [consultation, orders, banks]
  );

  const recap = useMemo(
    () => buildPurchaseConfirmationRecapData(consultation, orders, banks),
    [consultation, orders, banks]
  );

  const [activeTab, setActiveTab] = useState<'recap' | number>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [consultation.id, letters.length, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activeIndex = typeof activeTab === 'number' ? activeTab : 0;
  const activeLetter: PurchaseConfirmationLetter | undefined = letters[activeIndex] || letters[0];
  const isSingleSameBank =
    letters.length === 1 && letters[0].role === 'SAME_BANK_PURCHASE';

  const handleDownloadAll = () => {
    downloadPurchaseConfirmationPdf(
      letters,
      consultation.confirmationRef || consultation.consultationNumber
    );
  };

  const handleDownloadCurrent = () => {
    if (!activeLetter) return;
    downloadPurchaseConfirmationPdf(
      [activeLetter],
      `${activeLetter.confirmationRef}_${activeLetter.recipientBankCode}`
    );
  };

  const handleDownloadRecap = () => {
    downloadPurchaseConfirmationRecapPdf(consultation, orders, banks);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-slate-100 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:shadow-none print:max-h-none print:bg-white">
        {/* Top Modal Action Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold">
                  Confirmations d’Achat de Devises · Réf {consultation.confirmationRef || '101/26'}
                </h3>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isSingleSameBank
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                      : 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                  }`}
                >
                  {isSingleSameBank
                    ? 'Domiciliation = Achat (1 confirmation)'
                    : `Domiciliation ≠ Achat (${letters.length} confirmations)`}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isSingleSameBank
                  ? `Banque unique de domiciliation et d’achat : ${activeLetter?.recipientBankName}`
                  : `Circuit BCT activé : lettre(s) aux banques de domiciliation + confirmation à la banque d’achat (${consultation.selectedBankName})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {recap && (
              <button
                type="button"
                onClick={handleDownloadRecap}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'recap'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le Récap PDF</span>
              </button>
            )}
            {activeTab !== 'recap' && letters.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadCurrent}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors border border-slate-700 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Cette lettre</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={letters.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>
                {letters.length > 1
                  ? `Lettres PDF (${letters.length} pages)`
                  : 'Lettre PDF'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              aria-label="Fermer les confirmations d'achat"
            >
              <X className="w-4 h-4" />
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* Multi-Letter Switcher Tabs + Récapitulatif PDF Tab */}
        {letters.length > 0 && (
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 flex-wrap shrink-0 print:hidden">
            {letters.map((letter, idx) => {
              const isSelected = activeTab === idx;
              return (
                <button
                  key={letter.id}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Page {idx + 1}/{letters.length} · {letter.recipientBankCode}
                  </span>
                  {letter.role === 'PURCHASE_BANK' && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-blue-800 text-blue-100' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Achat
                    </span>
                  )}
                  {letter.role === 'DOMICILIARY_BANK' && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-blue-800 text-blue-100' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Domiciliation
                    </span>
                  )}
                  {letter.role === 'SAME_BANK_PURCHASE' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  )}
                </button>
              );
            })}

            {recap && (
              <button
                type="button"
                onClick={() => setActiveTab('recap')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap ml-auto ${
                  activeTab === 'recap'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                <span>Récapitulatif PDF</span>
              </button>
            )}
          </div>
        )}

        {/* Paper Sheet Preview */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex justify-center items-start print:p-0 print:overflow-visible">
          {activeTab === 'recap' && recap ? (
            <div className="bg-white w-full max-w-[780px] shadow-md border border-slate-200 px-8 py-7 text-slate-900 space-y-5 print:shadow-none print:border-0">
              {/* MTK Official Recap Header Banner */}
              <div className="border border-slate-700 bg-[#f4f6c8] px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold tracking-wide text-slate-900">
                    MANUFACTURE DES TABACS DE KAIROUAN (MTK)
                  </div>
                  <div className="text-[11px] text-slate-700 mt-0.5">
                    Direction Financière & Comptable (DFC) — Règlements Internationaux
                  </div>
                  <div className="text-[10px] text-slate-600">
                    B.P. 106 – 3100 Kairouan | Tél : (77) 281.309 | Email : mtk.tn@mtk.tn
                  </div>
                </div>
                <div className="bg-slate-900 text-white px-3.5 py-2 rounded text-center shrink-0">
                  <div className="text-[11px] font-bold tracking-wide">
                    RÉCAP CONFIRMATION {recap.confirmationRef}
                  </div>
                  <div className="text-[10px] text-blue-200 font-mono">
                    {recap.consultationNumber}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono">
                    Date : {formatConsultationDate(recap.confirmationDate)}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h4 className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                  Récapitulatif de Confirmation d’Achat de Devises
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">{recap.routingLabel}</p>
              </div>

              {/* 4 KPI Summary Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-[9px] font-bold uppercase text-slate-500">Montant acheté</div>
                  <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                    {formatConsultationAmount(recap.totalAmount, recap.currency)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {recap.orderRows.length} ordre(s) · {recap.purchaseType}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-[9px] font-bold uppercase text-slate-500">Banque d’achat retenue</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {recap.purchaseBankCode}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{recap.purchaseBankName}</div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-[9px] font-bold uppercase text-slate-500">Cours négocié retenu</div>
                  <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
                    {formatRate4(recap.negotiatedRate)} TND
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Valeur : {formatConsultationDate(recap.valueDate)}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <div className="text-[9px] font-bold uppercase text-slate-500">Contre-valeur totale</div>
                  <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                    TND {formatTndCounterValue(recap.totalCounterValueTnd)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium">
                    {recap.potentialSavingsTnd > 0
                      ? `Économie : ${formatTndCounterValue(recap.potentialSavingsTnd)} DT`
                      : 'Meilleure offre retenue'}
                  </div>
                </div>
              </div>

              {/* Section 1: Orders Detail Table */}
              <div>
                <div className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5">
                  1. Détail des Ordres de Paiement Couverts ({recap.orderRows.length})
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="border border-slate-300 px-2 py-1.5 text-left">N° Ordre</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Bénéficiaire</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Instrument</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Domiciliation</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        Montant ({recap.currency})
                      </th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">Cours</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">
                        Contre-valeur TND
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.orderRows.map(row => (
                      <tr key={row.orderId} className="even:bg-slate-50/60">
                        <td className="border border-slate-300 px-2 py-1.5 font-mono font-bold text-blue-900 whitespace-nowrap">
                          {row.orderNumber}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5">{row.beneficiaryName}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-slate-600 whitespace-nowrap">
                          {row.instrumentLabel}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-semibold whitespace-nowrap">
                          {row.domiciliaryBankCode}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatConsultationAmount(row.amount, '')}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatRate4(row.rate)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                          {formatTndCounterValue(row.counterValueTnd)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-200 font-bold text-slate-900">
                      <td colSpan={4} className="border border-slate-300 px-2 py-1.5">
                        TOTAL GÉNÉRAL DE LA CONFIRMATION
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatConsultationAmount(recap.totalAmount, recap.currency)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-mono whitespace-nowrap">
                        {formatRate4(recap.negotiatedRate)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        TND {formatTndCounterValue(recap.totalCounterValueTnd)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2: Quotes Comparison */}
              {recap.quoteRows.length > 0 && (
                <div>
                  <div className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5">
                    2. Classement des Offres Bancaires Reçues ({recap.quoteRows.length})
                  </div>
                  <table className="w-full border-collapse border border-slate-300 text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold">
                        <th className="border border-slate-300 px-2 py-1.5 text-left">Rang</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left">Banque</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right">
                          Montant ({recap.currency})
                        </th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right">Cours (TND)</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right">
                          Contre-valeur TND
                        </th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left">Décision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recap.quoteRows.map(q => (
                        <tr
                          key={q.bankId}
                          className={q.isRetained ? 'bg-emerald-50 font-semibold' : 'even:bg-slate-50/60'}
                        >
                          <td className="border border-slate-300 px-2 py-1.5 font-mono font-bold">
                            #{q.rank}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5">
                            {q.bankCode} – {q.bankName}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                            {formatConsultationAmount(q.proposedAmount, '')}
                            {q.isFullAmount ? ' (100%)' : ''}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-bold tabular-nums">
                            {formatRate4(q.rate)}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 text-right font-mono tabular-nums">
                            {formatTndCounterValue(q.counterValueTnd)}
                          </td>
                          <td className="border border-slate-300 px-2 py-1.5 font-bold">
                            {q.isRetained ? (
                              <span className="text-emerald-700">RETENUE</span>
                            ) : (
                              <span className="text-slate-500 font-mono">
                                +{q.spreadVsLowestRate.toFixed(4)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Section 3: Generated Letters & BCT Routing */}
              <div>
                <div className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5">
                  3. Synthèse des Lettres de Confirmation & Instructions BCT ({recap.letterRows.length})
                </div>
                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Page</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Destinataire & Rôle</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Fax</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">Montant TND</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">
                        Instruction BCT / Règlement
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.letterRows.map(lr => (
                      <tr key={`${lr.pageNumber}_${lr.recipientBankCode}`} className="even:bg-slate-50/60">
                        <td className="border border-slate-300 px-2 py-1.5 font-mono font-bold">
                          {lr.pageNumber}/{recap.letterRows.length}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-semibold">
                          {lr.recipientBankCode} ({lr.role === 'DOMICILIARY_BANK' ? 'Domiciliation' : 'Achat'})
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 font-mono text-slate-600">
                          {lr.faxLabel}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-bold tabular-nums">
                          {formatTndCounterValue(lr.totalCounterValueTnd)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-slate-700">
                          {lr.instructionSummary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Visas DFC */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  'Service Trésorerie & Changes',
                  'Contrôle de Gestion',
                  'La Direction Financière',
                ].map(title => (
                  <div
                    key={title}
                    className="border border-slate-300 rounded p-2.5 h-16 flex flex-col justify-between text-center"
                  >
                    <div className="text-[10px] font-bold text-slate-700">{title}</div>
                    <div className="border-b border-slate-200 mx-4" />
                  </div>
                ))}
              </div>
            </div>
          ) : activeLetter ? (
            <div
              className="bg-white w-full max-w-[780px] shadow-md border border-slate-200 px-10 py-7 text-slate-900 print:shadow-none print:border-0"
              style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
            >
              {/* Top Pale-Yellow MTK Letterhead Box */}
              <div className="mx-3 border border-slate-700 bg-[#f4f6c8] text-center px-4 py-2.5 italic font-bold">
                <div className="text-base tracking-wide text-slate-900">
                  MANUFACTURE DES TABACS DE KAIROUAN
                </div>
                <div className="text-xs text-slate-900 mt-0.5">
                  B.P. 106 – 3100 KAIROUAN – TUNISIE
                </div>
                <div className="text-xs text-slate-900">R.C. N° : B4141995</div>
                <div className="text-xs text-slate-900">
                  TEL : (77) 281.309 – (77) 282.824 &nbsp;-&nbsp; FAX : (77) 283.130
                </div>
                <div className="text-xs text-slate-900 mt-2">
                  Email : <span className="underline">mtk.tn@mtk.tn</span>
                </div>
              </div>

              {/* 4-Column Metadata Table */}
              <table className="w-full border-collapse border border-slate-700 mt-4 text-xs italic font-bold">
                <tbody>
                  <tr>
                    <td className="border border-slate-700 px-2 py-1.5 w-24">DEST :</td>
                    <td className="border border-slate-700 px-2 py-1.5">{activeLetter.destLabel}</td>
                    <td className="border border-slate-700 px-2 py-1.5 w-16">FAX :</td>
                    <td className="border border-slate-700 px-2 py-1.5 w-36">{activeLetter.faxLabel}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-700 px-2 py-1.5">ADRESSE :</td>
                    <td
                      className={`border border-slate-700 px-2 py-1.5 ${
                        activeLetter.addressLabel.includes('@') ? 'text-blue-700 underline' : ''
                      }`}
                    >
                      {activeLetter.addressLabel}
                    </td>
                    <td className="border border-slate-700 px-2 py-1.5">
                      {activeLetter.telLabel ? 'TEL :' : ''}
                    </td>
                    <td className="border border-slate-700 px-2 py-1.5">
                      {activeLetter.telLabel || ''}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-700 px-2 py-1.5">DATE :</td>
                    <td className="border border-slate-700 px-2 py-1.5">
                      {formatConsultationDate(activeLetter.confirmationDate)}
                    </td>
                    <td className="border border-slate-700 px-2 py-1.5">Réf :</td>
                    <td className="border border-slate-700 px-2 py-1.5">{activeLetter.confirmationRef}</td>
                  </tr>
                </tbody>
              </table>

              {/* Second Pale-Yellow Expediteur Box */}
              <div className="mx-3 mt-3 border border-slate-700 bg-[#f4f6c8] text-center px-3 py-1.5 italic font-bold text-[11px]">
                <div>EXPEDITEUR : DIRECTION FINANCIERE</div>
                <div>
                  N.B. : En cas d’illisibilité du message, Veuillez nous contacter au (77) 281.309
                </div>
              </div>

              {/* TEXTE Heading */}
              <div className="text-center font-bold italic text-sm tracking-wider mt-6 mb-5">
                TEXTE
              </div>

              {/* Body */}
              <div className="space-y-4 text-[14.5px] leading-relaxed italic">
                <p>
                  <RenderRichText segments={buildLetterIntroSegments(activeLetter)} />
                </p>

                <ul className="space-y-3 pl-5">
                  {activeLetter.lines.map((line: PurchaseConfirmationOrderLine) => (
                    <li key={line.orderId} className="flex items-start gap-2.5">
                      <span>-</span>
                      <span>
                        <RenderRichText segments={buildOrderBulletSegments(line)} />
                      </span>
                    </li>
                  ))}
                </ul>

                {(() => {
                  const closing = buildLetterClosingSegments(activeLetter);
                  if (!closing) return null;
                  return (
                    <p className="pt-1">
                      <RenderRichText segments={closing} />
                    </p>
                  );
                })()}

                <div className="pt-6 text-right font-bold italic text-sm">
                  LA DIRECTION FINANCIERE
                </div>
              </div>

              {/* Bottom-left Concerned Persons & Emails */}
              <div className="mt-10 space-y-1.5 text-xs font-sans">
                {((activeLetter.footerContacts && activeLetter.footerContacts.length > 0
                  ? activeLetter.footerContacts
                  : activeLetter.footerEmails.map(email => ({ name: '', email }))) as BankConfirmationContact[]
                ).map((c, idx) => (
                  <div key={c.id || `${c.email}_${idx}`} className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                      [{formatContactOrderTypesTag(c.orderTypes)}]
                    </span>
                    {c.name && (
                      <span className="font-semibold text-slate-800">
                        {c.name}
                        {c.role ? ` (${c.role})` : ''} :
                      </span>
                    )}
                    <span className="text-blue-700 underline">{c.email}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-10 text-center text-xs text-slate-500">
              Aucune lettre de confirmation disponible pour cette consultation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
