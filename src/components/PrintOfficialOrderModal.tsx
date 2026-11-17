import React from 'react';
import { X, Printer, Download, Scissors } from 'lucide-react';
import { Invoice, PaymentOrder } from '../types/payment';
import {
  computeOrderPrintData,
  downloadHalfA4OrderPdf,
} from '../utils/orderPrintSummary';

interface PrintOfficialOrderModalProps {
  order: PaymentOrder;
  linkedInvoice?: Invoice;
  allOrders?: PaymentOrder[];
  onClose: () => void;
}

export const PrintOfficialOrderModal: React.FC<PrintOfficialOrderModalProps> = ({
  order,
  linkedInvoice,
  allOrders = [],
  onClose,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const data = React.useMemo(
    () => computeOrderPrintData(order, linkedInvoice, allOrders),
    [order, linkedInvoice, allOrders]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadHalfA4OrderPdf(order, linkedInvoice, allOrders);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0 print:overflow-visible"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-slate-100 rounded-xl max-w-[216mm] w-full my-auto shadow-2xl overflow-hidden border border-slate-300 print:bg-white print:shadow-none print:border-0 print:max-w-none print:rounded-none"
      >
        {/* Top Control Bar (hidden on print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-xs font-bold block">
                Aperçu Demi-Feuille A4 (210 × 148 mm) · Ordre {data.orderNumber}
              </span>
              <span className="text-[11px] text-slate-300">
                Format condensé Noir &amp; Blanc prêt pour impression demi-page A4 ou export PDF
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger PDF (Demi-A4)</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer (Demi-A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-4 h-4" />
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE HALF-A4 SHEET (210 x 148 mm) */}
        <div className="p-4 sm:p-5 print:p-0 flex flex-col items-center">
          <div className="print-half-a4 bg-white text-black w-full max-w-[200mm] border-2 border-neutral-900 p-4 space-y-2.5 shadow-sm print:shadow-none">
            {/* Compact Header */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b-2 border-neutral-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/aistudio/Logo_MTK_737e87ca.png"
                  alt="Logo MTK"
                  className="w-10 h-10 object-contain grayscale contrast-125 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase tracking-tight text-black leading-tight">
                    Manufacture des Tabacs de Kairouan (MTK)
                  </div>
                  <div className="text-[9.5px] font-semibold text-neutral-700 leading-tight">
                    Direction Financière et Comptable · Règlements Internationaux
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-black mt-0.5">
                    ORDRE DE PAIEMENT INTERNATIONAL
                  </div>
                </div>
              </div>

              <div className="text-right border border-neutral-900 bg-neutral-100 px-3 py-1.5 shrink-0 min-w-[175px]">
                <div className="text-[9px] font-bold uppercase text-neutral-600">
                  Ordre de Paiement N°
                </div>
                <div className="text-xs font-black font-mono text-black">
                  {data.orderNumber}
                </div>
                <div className="text-[10px] font-mono font-semibold text-neutral-800 mt-0.5">
                  Date : {data.orderDateFormatted}
                </div>
              </div>
            </div>

            {/* Row 1: Fournisseur | Type de paiement & Réf. Facture */}
            <div className="grid grid-cols-12 gap-2.5 text-[11px]">
              <div className="col-span-7 border border-neutral-500 p-2 space-y-0.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">
                  Fournisseur / Bénéficiaire
                </div>
                <div className="text-xs font-extrabold text-black truncate">
                  {data.supplierName}
                </div>
                <div className="text-[10px] text-neutral-800 flex flex-wrap gap-x-2">
                  <span>Pays : <strong>{data.supplierCountry}</strong></span>
                  <span>·</span>
                  <span className="font-mono">SWIFT : <strong>{data.supplierSwift}</strong></span>
                </div>
                <div className="text-[10px] text-neutral-700 truncate">
                  Banque : {data.supplierBank}
                </div>
                <div className="text-[10px] font-mono text-neutral-900 truncate">
                  IBAN : {data.supplierIban}
                </div>
              </div>

              <div className="col-span-5 border border-neutral-500 p-2 space-y-0.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">
                  Type de Paiement &amp; Réf. Document
                </div>
                <div className="text-[11px] font-bold text-black">
                  {data.paymentTypeLabel}
                  {data.lcNumber ? ` (N° ${data.lcNumber})` : ''}
                </div>
                <div className="text-[10px] text-neutral-800 truncate">
                  Banque MTK : <strong>{data.mtkBankName}</strong>
                </div>
                <div className="text-[10px] font-mono text-black pt-0.5 border-t border-neutral-200 mt-0.5">
                  {data.documentRefLabel} : <strong>{data.invoiceNumber}</strong>
                  {data.invoiceDateFormatted !== '—' ? ` (${data.invoiceDateFormatted})` : ''}
                </div>
                {data.proformaRecall && (
                  <div className="text-[9.5px] italic text-neutral-700 truncate">
                    {data.proformaRecall}
                  </div>
                )}
                <div className="text-[9.5px] font-mono text-neutral-700 truncate">
                  {data.contractNumber
                    ? `Contrat : ${data.contractNumber}`
                    : `Date ordre : ${data.orderDateFormatted}`}
                </div>
              </div>
            </div>

            {/* Row 2: Montant de l'Ordre */}
            <div className="border-2 border-neutral-900 bg-neutral-100/80 px-3 py-2 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-600 block">
                    {data.hasDeductions
                      ? "Montant Net de l'Ordre à Transférer"
                      : "Montant de l'Ordre"}
                  </span>
                  <span className="text-lg font-black font-mono text-black leading-tight">
                    {data.formattedNetAmount}
                  </span>
                </div>

                {data.hasDeductions && (
                  <div className="text-[10px] font-mono text-neutral-800 text-right">
                    <div>
                      Brut facture imputé : <strong>{data.formattedGrossAmount}</strong>
                    </div>
                    <div>
                      Déductions / Frais : <strong>−{data.formattedDeductionsTotal}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] italic font-semibold text-neutral-900 border-t border-neutral-300 pt-1 truncate">
                En lettres : « {data.amountInWords} »
              </div>
            </div>

            {/* Row 3: Part de règlement de la facture (brièvement) */}
            <div className="border border-neutral-700 px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">
                  Part de Règlement de la Facture
                </div>
                <div className="text-[11px] font-extrabold text-black truncate">
                  {data.settlementHeadline}
                </div>
                <div className="text-[10px] text-neutral-800 font-mono truncate">
                  {data.settlementSubline}
                </div>
              </div>

              {data.hasLinkedInvoice && !data.isCancelled && (
                <div className="w-28 shrink-0 text-center space-y-1">
                  <div className="w-full h-2.5 border border-neutral-900 bg-white overflow-hidden">
                    <div
                      className="h-full bg-neutral-800"
                      style={{ width: `${data.cumulativePercent}%` }}
                    />
                  </div>
                  <div className="text-[9.5px] font-mono font-bold text-black">
                    Cumul : {data.cumulativePercent} %
                  </div>
                </div>
              )}
            </div>

            {/* Row 4: Motif bref */}
            <div className="text-[10px] text-neutral-800 px-0.5 truncate">
              <strong className="uppercase text-[9px] text-neutral-600 mr-1.5">Objet :</strong>
              <span>{data.purpose || '—'}</span>
            </div>

            {/* Row 5: 4 Visas Compacts */}
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-neutral-900 text-center">
              <div className="border border-neutral-400 p-1.5 min-h-[54px] flex flex-col justify-between">
                <span className="text-[8.5px] font-bold uppercase text-neutral-800">
                  1. Agent Comptable
                </span>
                <span className="text-[8px] font-mono text-neutral-500">Visa &amp; Date</span>
              </div>
              <div className="border border-neutral-400 p-1.5 min-h-[54px] flex flex-col justify-between">
                <span className="text-[8.5px] font-bold uppercase text-neutral-800">
                  2. Contrôle Gestion
                </span>
                <span className="text-[8px] font-mono text-neutral-500">Visa Budgétaire</span>
              </div>
              <div className="border border-neutral-400 p-1.5 min-h-[54px] flex flex-col justify-between">
                <span className="text-[8.5px] font-bold uppercase text-neutral-800">
                  3. Dir. Financier
                </span>
                <span className="text-[8px] font-mono text-neutral-500">Bon à Exécuter</span>
              </div>
              <div className="border border-neutral-400 bg-neutral-50 p-1.5 min-h-[54px] flex flex-col justify-between">
                <span className="text-[8.5px] font-bold uppercase text-neutral-800">
                  4. Banque MTK
                </span>
                <span className="text-[8px] font-mono text-neutral-500">Cachet &amp; SWIFT</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[8.5px] text-neutral-600 text-center pt-0.5">
              MTK International Payments (DFC) · Demi-feuille A4 (210 × 148 mm) · Réf. {data.orderNumber}
            </div>
          </div>

          {/* Subtle Half-A4 Cut Line below sheet */}
          <div className="w-full max-w-[200mm] mt-2 flex items-center gap-2 text-[9px] text-neutral-400 print:mt-1.5">
            <Scissors className="w-3 h-3 shrink-0" />
            <div className="flex-1 border-b border-dashed border-neutral-400" />
            <span className="font-mono uppercase tracking-wider shrink-0">
              Ligne de coupe · Demi-feuille A4
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
