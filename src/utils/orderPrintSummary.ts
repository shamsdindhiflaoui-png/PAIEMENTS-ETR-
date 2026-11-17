import { jsPDF } from 'jspdf';
import { Invoice, InvoiceDocumentBasis, OrderTransferType, PaymentOrder } from '../types/payment';
import {
  computeInvoicePaymentSummary,
  getOrderDeductionsTotal,
  getOrderInvoiceGrossAmount,
} from './invoiceUtils';
import { formatForeignCurrency } from './workflowRules';

export interface OrderPrintData {
  orderNumber: string;
  orderDateIso: string;
  orderDateFormatted: string;
  supplierName: string;
  supplierCountry: string;
  supplierBank: string;
  supplierIban: string;
  supplierSwift: string;
  paymentType: OrderTransferType;
  paymentTypeLabel: string;
  lcNumber?: string;
  mtkBankName: string;
  mtkBankBranch: string;
  currency: PaymentOrder['currency'];
  netAmount: number;
  grossAmount: number;
  deductionsTotal: number;
  hasDeductions: boolean;
  formattedNetAmount: string;
  formattedGrossAmount: string;
  formattedDeductionsTotal: string;
  amountInWords: string;
  documentBasis: InvoiceDocumentBasis;
  documentRefLabel: string;
  invoiceNumber: string;
  invoiceDateIso: string;
  invoiceDateFormatted: string;
  proformaRecall?: string;
  contractNumber?: string;
  purpose: string;
  hasLinkedInvoice: boolean;
  invoiceTotalAmount?: number;
  formattedInvoiceTotal?: string;
  orderSharePercent: number;
  cumulativePercent: number;
  remainingAmount?: number;
  formattedRemainingAmount?: string;
  trancheIndex?: number;
  totalTranches?: number;
  isFullSettlement: boolean;
  isCancelled: boolean;
  settlementHeadline: string;
  settlementSubline: string;
}

const TRANSFER_TYPE_LABELS: Record<OrderTransferType, string> = {
  VIREMENT: 'Virement Bancaire',
  LC: 'Crédit Documentaire (LC)',
  REMISE: 'Remise Documentaire',
  AUTRE: 'Autre mode de règlement',
};

export function formatPrintDateFr(isoOrDate?: string): string {
  if (!isoOrDate) return '—';
  const datePart = isoOrDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return datePart;
}

function formatPercentLabel(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0 %';
  const rounded1 = Math.round(pct * 10) / 10;
  if (Math.abs(rounded1 - Math.round(rounded1)) < 0.05) {
    return `${Math.round(rounded1)} %`;
  }
  return `${rounded1.toFixed(1).replace('.', ',')} %`;
}

export function pdfSafeText(str: string): string {
  return (str || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2260/g, '!=')
    .replace(/\u2190/g, '<-')
    .replace(/\u2192/g, '->')
    .replace(/\u00b7/g, '|')
    .replace(/\u2212/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\u202f/g, ' ');
}

function formatAmountCompact(amount: number, currency: string): string {
  return formatForeignCurrency(amount, currency);
}

export function computeOrderPrintData(
  order: PaymentOrder,
  linkedInvoice?: Invoice,
  allOrders: PaymentOrder[] = []
): OrderPrintData {
  const paymentType: OrderTransferType = order.transferType || 'VIREMENT';
  const paymentTypeLabel = TRANSFER_TYPE_LABELS[paymentType] || 'Virement Bancaire';
  const orderDateIso = (order.createdAt || '').split('T')[0];
  const invoiceDateIso = order.invoiceDate || linkedInvoice?.invoiceDate || '';
  const netAmount = Number((Number(order.amount) || 0).toFixed(2));
  const deductionsTotal = getOrderDeductionsTotal(order);
  const grossAmount = getOrderInvoiceGrossAmount(order);
  const hasDeductions =
    deductionsTotal > 0 || (Array.isArray(order.deductions) && order.deductions.length > 0);
  const isCancelled = order.status === 'ANNULE';

  const formattedNetAmount = formatAmountCompact(netAmount, order.currency);
  const formattedGrossAmount = formatAmountCompact(grossAmount, order.currency);
  const formattedDeductionsTotal = formatAmountCompact(deductionsTotal, order.currency);

  const invoiceNumber =
    (order.invoiceNumber || linkedInvoice?.invoiceNumber || '').trim() || '—';
  const contractNumber =
    (order.contractNumber || linkedInvoice?.contractNumber || '').trim() || undefined;

  const rawProformaNum = (
    order.proformaNumber ||
    linkedInvoice?.proformaNumber ||
    ''
  ).trim();
  const rawProformaDate = (
    order.proformaDate ||
    linkedInvoice?.proformaDate ||
    ''
  ).trim();

  const inferredBasis: InvoiceDocumentBasis = order.documentBasis
    ? order.documentBasis
    : linkedInvoice?.proformaNumber &&
      invoiceNumber.toLowerCase() === linkedInvoice.proformaNumber.trim().toLowerCase() &&
      invoiceNumber.toLowerCase() !==
        (linkedInvoice.definitiveInvoiceNumber || '').trim().toLowerCase()
    ? 'PROFORMA'
    : 'FACTURE_DEFINITIVE';

  const documentRefLabel =
    inferredBasis === 'PROFORMA' ? 'Réf. Proforma' : 'Réf. Facture';

  const proformaRecall =
    inferredBasis === 'FACTURE_DEFINITIVE' &&
    rawProformaNum &&
    rawProformaNum.toLowerCase() !== invoiceNumber.toLowerCase()
      ? `sur Proforma ${rawProformaNum}${
          rawProformaDate ? ` (${formatPrintDateFr(rawProformaDate)})` : ''
        }`
      : undefined;

  if (linkedInvoice && linkedInvoice.totalAmount > 0) {
    const summary = computeInvoicePaymentSummary(
      linkedInvoice,
      allOrders.length > 0 ? allOrders : [order]
    );
    const invoiceTotal = Number(linkedInvoice.totalAmount);
    const formattedInvoiceTotal = formatAmountCompact(invoiceTotal, linkedInvoice.currency);
    const formattedRemainingAmount = formatAmountCompact(
      summary.remainingAmount,
      linkedInvoice.currency
    );

    if (isCancelled) {
      return {
        orderNumber: order.orderNumber,
        orderDateIso,
        orderDateFormatted: formatPrintDateFr(orderDateIso),
        supplierName: order.beneficiaryName,
        supplierCountry: order.beneficiaryCountry || '—',
        supplierBank: order.beneficiaryBank || '—',
        supplierIban: order.beneficiaryIban || '—',
        supplierSwift: order.beneficiarySwift || '—',
        paymentType,
        paymentTypeLabel,
        lcNumber: order.lcNumber,
        mtkBankName: order.bankName,
        mtkBankBranch: order.bankBranch || 'Agence Kairouan',
        currency: order.currency,
        netAmount,
        grossAmount,
        deductionsTotal,
        hasDeductions,
        formattedNetAmount,
        formattedGrossAmount,
        formattedDeductionsTotal,
        amountInWords: order.amountInWords,
        documentBasis: inferredBasis,
        documentRefLabel,
        invoiceNumber,
        invoiceDateIso,
        invoiceDateFormatted: formatPrintDateFr(invoiceDateIso),
        proformaRecall,
        contractNumber,
        purpose: order.transferPurpose || order.purpose,
        hasLinkedInvoice: true,
        invoiceTotalAmount: invoiceTotal,
        formattedInvoiceTotal,
        orderSharePercent: 0,
        cumulativePercent: summary.progressPercent,
        remainingAmount: summary.remainingAmount,
        formattedRemainingAmount,
        totalTranches: summary.linkedOrders.length,
        isFullSettlement: false,
        isCancelled: true,
        settlementHeadline: 'Ordre annulé — non imputé sur la facture',
        settlementSubline: `Facture ${invoiceNumber} (${formattedInvoiceTotal}) · Solde ouvert : ${formattedRemainingAmount}`,
      };
    }

    const rawShare = Math.min(100, (grossAmount / invoiceTotal) * 100);
    const orderSharePercent = Math.round(rawShare * 10) / 10;
    const shareStr = formatPercentLabel(orderSharePercent);

    const sortedTranches = [...summary.linkedOrders].sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      if (tA !== tB) return tA - tB;
      return a.id.localeCompare(b.id);
    });
    const idx = sortedTranches.findIndex(o => o.id === order.id);
    const trancheIndex = idx >= 0 ? idx + 1 : 1;
    const totalTranches = Math.max(sortedTranches.length, 1);

    const isFullSingleSettlement = orderSharePercent >= 99.95 && totalTranches === 1;
    const isInvoiceFullyCovered = summary.remainingAmount <= 0.005;

    let settlementHeadline: string;
    let settlementSubline: string;

    if (isFullSingleSettlement) {
      settlementHeadline = `100 % — Règlement intégral de la facture`;
      settlementSubline = hasDeductions
        ? `Total facture : ${formattedInvoiceTotal} (Net viré : ${formattedNetAmount} · Déductions : -${formattedDeductionsTotal})`
        : `Total facture : ${formattedInvoiceTotal} · Soldée par cet ordre`;
    } else if (isInvoiceFullyCovered) {
      settlementHeadline = `${shareStr} de la facture (Tranche ${trancheIndex}/${totalTranches} · Solde final)`;
      settlementSubline = `Imputé : ${formattedGrossAmount} / ${formattedInvoiceTotal} · Facture soldée à 100 %`;
    } else {
      settlementHeadline = `${shareStr} de la facture (Règlement partiel · Tranche ${trancheIndex}/${totalTranches})`;
      settlementSubline = `Imputé : ${formattedGrossAmount} / ${formattedInvoiceTotal} · Cumul réglé : ${summary.progressPercent} % · Reste : ${formattedRemainingAmount}`;
    }

    return {
      orderNumber: order.orderNumber,
      orderDateIso,
      orderDateFormatted: formatPrintDateFr(orderDateIso),
      supplierName: order.beneficiaryName,
      supplierCountry: order.beneficiaryCountry || '—',
      supplierBank: order.beneficiaryBank || '—',
      supplierIban: order.beneficiaryIban || '—',
      supplierSwift: order.beneficiarySwift || '—',
      paymentType,
      paymentTypeLabel,
      lcNumber: order.lcNumber,
      mtkBankName: order.bankName,
      mtkBankBranch: order.bankBranch || 'Agence Kairouan',
      currency: order.currency,
      netAmount,
      grossAmount,
      deductionsTotal,
      hasDeductions,
      formattedNetAmount,
      formattedGrossAmount,
      formattedDeductionsTotal,
      amountInWords: order.amountInWords,
      documentBasis: inferredBasis,
      documentRefLabel,
      invoiceNumber,
      invoiceDateIso,
      invoiceDateFormatted: formatPrintDateFr(invoiceDateIso),
      proformaRecall,
      contractNumber,
      purpose: order.transferPurpose || order.purpose,
      hasLinkedInvoice: true,
      invoiceTotalAmount: invoiceTotal,
      formattedInvoiceTotal,
      orderSharePercent,
      cumulativePercent: summary.progressPercent,
      remainingAmount: summary.remainingAmount,
      formattedRemainingAmount,
      trancheIndex,
      totalTranches,
      isFullSettlement: isFullSingleSettlement || isInvoiceFullyCovered,
      isCancelled: false,
      settlementHeadline,
      settlementSubline,
    };
  }

  // Fallback when order is not linked to a registered Invoice entity
  const settlementHeadline = isCancelled
    ? 'Ordre annulé'
    : invoiceNumber !== '—'
    ? `Règlement direct sur ${
        inferredBasis === 'PROFORMA' ? 'Proforma' : 'réf. facture'
      } ${invoiceNumber}`
    : 'Ordre sans facture enregistrée dans le module Factures';

  const settlementSubline = hasDeductions
    ? `Montant brut : ${formattedGrossAmount} (Net viré : ${formattedNetAmount} · Déductions : -${formattedDeductionsTotal})`
    : `Montant de l'ordre : ${formattedNetAmount}`;

  return {
    orderNumber: order.orderNumber,
    orderDateIso,
    orderDateFormatted: formatPrintDateFr(orderDateIso),
    supplierName: order.beneficiaryName,
    supplierCountry: order.beneficiaryCountry || '—',
    supplierBank: order.beneficiaryBank || '—',
    supplierIban: order.beneficiaryIban || '—',
    supplierSwift: order.beneficiarySwift || '—',
    paymentType,
    paymentTypeLabel,
    lcNumber: order.lcNumber,
    mtkBankName: order.bankName,
    mtkBankBranch: order.bankBranch || 'Agence Kairouan',
    currency: order.currency,
    netAmount,
    grossAmount,
    deductionsTotal,
    hasDeductions,
    formattedNetAmount,
    formattedGrossAmount,
    formattedDeductionsTotal,
    amountInWords: order.amountInWords,
    documentBasis: inferredBasis,
    documentRefLabel,
    invoiceNumber,
    invoiceDateIso,
    invoiceDateFormatted: formatPrintDateFr(invoiceDateIso),
    proformaRecall,
    contractNumber,
    purpose: order.transferPurpose || order.purpose,
    hasLinkedInvoice: false,
    orderSharePercent: isCancelled ? 0 : 100,
    cumulativePercent: isCancelled ? 0 : 100,
    isFullSettlement: !isCancelled,
    isCancelled,
    settlementHeadline,
    settlementSubline,
  };
}

/**
 * Génère le document PDF au format exact Demi-Feuille A4 (210 x 148 mm)
 * en Noir & Blanc haute lisibilité, contenant brièvement les mentions essentielles.
 */
export function buildHalfA4OrderPdf(
  order: PaymentOrder,
  linkedInvoice?: Invoice,
  allOrders: PaymentOrder[] = []
): jsPDF {
  const data = computeOrderPrintData(order, linkedInvoice, allOrders);
  // Half A4 = A5 landscape = 210mm x 148mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [210, 148],
  });

  const pageWidth = 210;
  const marginX = 9;
  const contentWidth = pageWidth - marginX * 2; // 192 mm

  // Outer neat border (monochrome B&W)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.45);
  doc.rect(marginX, 7, contentWidth, 134);

  // Header band (y: 7 -> 23)
  doc.setFillColor(0, 0, 0);
  doc.rect(marginX, 7, 2.2, 16, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    pdfSafeText('MANUFACTURE DES TABACS DE KAIROUAN (MTK)'),
    marginX + 5,
    12.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    pdfSafeText('Direction Financiere & Comptable (DFC) - Reglements Internationaux'),
    marginX + 5,
    16.8
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(pdfSafeText('ORDRE DE PAIEMENT INTERNATIONAL'), marginX + 5, 21);

  // Order N° + Date box on top right
  const boxW = 62;
  const boxX = marginX + contentWidth - boxW - 2.5;
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(boxX, 9, boxW, 12.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(pdfSafeText(`ORDRE N° : ${data.orderNumber}`), boxX + 2.5, 13.3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(pdfSafeText(`Date : ${data.orderDateFormatted}`), boxX + 2.5, 17.5);
  doc.setFontSize(6.6);
  doc.text(
    pdfSafeText(`Banque : ${data.mtkBankName}`),
    boxX + 2.5,
    20.4,
    { maxWidth: boxW - 5 }
  );

  // Divider line under header
  doc.setLineWidth(0.35);
  doc.line(marginX, 23, marginX + contentWidth, 23);

  // Row 1 (y: 25 -> 49): Fournisseur (left 62%) | Type paiement & Réf Facture (right 38%)
  const r1Y = 25;
  const r1H = 24;
  const leftW = 114;
  const rightW = contentWidth - leftW - 6;
  const leftX = marginX + 2.5;
  const rightX = leftX + leftW + 2;

  doc.setDrawColor(90, 90, 90);
  doc.setLineWidth(0.25);
  doc.rect(leftX, r1Y, leftW, r1H);
  doc.rect(rightX, r1Y, rightW, r1H);

  // Fournisseur cell
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(70, 70, 70);
  doc.text('FOURNISSEUR / BENEFICIAIRE', leftX + 2.5, r1Y + 4);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9.5);
  const supplierLines = doc.splitTextToSize(
    pdfSafeText(data.supplierName),
    leftW - 5
  );
  doc.text(supplierLines.slice(0, 1), leftX + 2.5, r1Y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    pdfSafeText(`Pays : ${data.supplierCountry}  |  SWIFT : ${data.supplierSwift}`),
    leftX + 2.5,
    r1Y + 13.8
  );
  doc.text(
    pdfSafeText(`Banque : ${data.supplierBank}`),
    leftX + 2.5,
    r1Y + 18,
    { maxWidth: leftW - 5 }
  );
  doc.text(
    pdfSafeText(`IBAN / Cpt : ${data.supplierIban}`),
    leftX + 2.5,
    r1Y + 22,
    { maxWidth: leftW - 5 }
  );

  // Type paiement + Date + Réf Facture / Proforma cell
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(70, 70, 70);
  doc.text('TYPE DE PAIEMENT & REF. DOCUMENT', rightX + 2.5, r1Y + 3.8);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8.0);
  const paymentDisplay = data.lcNumber
    ? `${data.paymentTypeLabel} (N° ${data.lcNumber})`
    : data.paymentTypeLabel;
  doc.text(pdfSafeText(paymentDisplay), rightX + 2.5, r1Y + 8.1, {
    maxWidth: rightW - 5,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.1);
  doc.text(
    pdfSafeText(`Banque MTK : ${data.mtkBankName}`),
    rightX + 2.5,
    r1Y + 12.1,
    { maxWidth: rightW - 5 }
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text(
    pdfSafeText(
      `${data.documentRefLabel} : ${data.invoiceNumber}${
        data.invoiceDateFormatted !== '—' ? ` (${data.invoiceDateFormatted})` : ''
      }`
    ),
    rightX + 2.5,
    r1Y + 16.1,
    { maxWidth: rightW - 5 }
  );

  if (data.proformaRecall) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.4);
    doc.setTextColor(55, 55, 55);
    doc.text(pdfSafeText(data.proformaRecall), rightX + 2.5, r1Y + 19.6, {
      maxWidth: rightW - 5,
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(
      pdfSafeText(
        data.contractNumber
          ? `Contrat : ${data.contractNumber}`
          : `Date ordre : ${data.orderDateFormatted}`
      ),
      rightX + 2.5,
      r1Y + 22.9,
      { maxWidth: rightW - 5 }
    );
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      pdfSafeText(
        data.contractNumber
          ? `Contrat : ${data.contractNumber}`
          : `Date ordre : ${data.orderDateFormatted}`
      ),
      rightX + 2.5,
      r1Y + 21.2,
      { maxWidth: rightW - 5 }
    );
  }

  // Row 2 (y: 51.5 -> 79.5): Montant de l'ordre
  const r2Y = 51.5;
  const r2H = 26;
  doc.setFillColor(246, 246, 246);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.45);
  doc.rect(leftX, r2Y, contentWidth - 5, r2H, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text(
    pdfSafeText(
      data.hasDeductions
        ? "MONTANT NET DE L'ORDRE A TRANSFERER"
        : "MONTANT DE L'ORDRE"
    ),
    leftX + 3,
    r2Y + 4.8
  );

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(pdfSafeText(data.formattedNetAmount), leftX + 3, r2Y + 11.5);

  if (data.hasDeductions) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(
      pdfSafeText(
        `Brut facture impute : ${data.formattedGrossAmount}   |   Deductions / Frais : -${data.formattedDeductionsTotal}`
      ),
      leftX + 75,
      r2Y + 11
    );
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  const wordsLines = doc.splitTextToSize(
    pdfSafeText(`En lettres : "${data.amountInWords}"`),
    contentWidth - 11
  );
  doc.text(wordsLines.slice(0, 2), leftX + 3, r2Y + 17.5);

  // Row 3 (y: 80 -> 99.5): Part de règlement de la facture
  const r3Y = 80;
  const r3H = 19.5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(leftX, r3Y, contentWidth - 5, r3H);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(60, 60, 60);
  doc.text('PART DE REGLEMENT DE LA FACTURE', leftX + 3, r3Y + 4.3);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8.5);
  doc.text(pdfSafeText(data.settlementHeadline), leftX + 3, r3Y + 9.2, {
    maxWidth: contentWidth - 46,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(pdfSafeText(data.settlementSubline), leftX + 3, r3Y + 13.8, {
    maxWidth: contentWidth - 46,
  });

  // Compact monochrome progress bar on right of Row 3
  if (data.hasLinkedInvoice && !data.isCancelled) {
    const barW = 34;
    const barX = leftX + contentWidth - 5 - barW - 3;
    const barY = r3Y + 7.5;
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);
    doc.rect(barX, barY, barW, 3.2, 'FD');
    const fillW = Math.max(0, Math.min(barW, (barW * data.cumulativePercent) / 100));
    if (fillW > 0) {
      doc.setFillColor(35, 35, 35);
      doc.rect(barX, barY, fillW, 3.2, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.text(
      pdfSafeText(`Cumul : ${data.cumulativePercent} %`),
      barX + barW / 2,
      barY + 6.5,
      { align: 'center' }
    );
  }

  // Row 4 (y: 101 -> 109): Objet / Motif (1 compact line)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Objet :', leftX, 105.5);
  doc.setFont('helvetica', 'normal');
  doc.text(pdfSafeText(data.purpose || '—'), leftX + 11, 105.5, {
    maxWidth: contentWidth - 16,
  });

  // Row 5 (y: 109 -> 133): 4 compact visa boxes
  const visaY = 109;
  const visaH = 23.5;
  const visaGap = 2.5;
  const visaBoxW = (contentWidth - 5 - visaGap * 3) / 4;
  const visas = [
    { title: '1. Agent Comptable', sub: 'Visa & Date' },
    { title: '2. Controle de Gestion', sub: 'Visa Budgetaire' },
    { title: '3. Directeur Financier', sub: 'Bon a Executer' },
    { title: '4. Banque MTK', sub: 'Cachet & Ref. SWIFT' },
  ];

  visas.forEach((v, idx) => {
    const vx = leftX + idx * (visaBoxW + visaGap);
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.25);
    doc.rect(vx, visaY, visaBoxW, visaH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    doc.text(pdfSafeText(v.title), vx + visaBoxW / 2, visaY + 4.3, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(90, 90, 90);
    doc.text(pdfSafeText(v.sub), vx + visaBoxW / 2, visaY + visaH - 2.5, { align: 'center' });
  });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(80, 80, 80);
  doc.text(
    pdfSafeText(
      `MTK International Payments (DFC) - Format Demi-Feuille A4 (210 x 148 mm) - Ref. ${data.orderNumber}`
    ),
    pageWidth / 2,
    138.2,
    { align: 'center' }
  );

  return doc;
}

export function downloadHalfA4OrderPdf(
  order: PaymentOrder,
  linkedInvoice?: Invoice,
  allOrders: PaymentOrder[] = []
): void {
  const doc = buildHalfA4OrderPdf(order, linkedInvoice, allOrders);
  doc.save(`Ordre_${order.orderNumber}_DemiA4.pdf`);
}
