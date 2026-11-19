import QRCode from 'qrcode';
import type { jsPDF } from 'jspdf';
import {
  CurrencyConsultation,
  Invoice,
  PaymentOrder,
  PurchaseConfirmationLetter,
} from '../types/payment';
import { doesOrderBelongToInvoice } from './invoiceUtils';
import { computeOrderPrintData } from './orderPrintSummary';

function cleanQrText(str?: string): string {
  return (str || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatQrDate(isoOrDate?: string): string {
  if (!isoOrDate) return '—';
  const datePart = isoOrDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return datePart;
}

export function formatQrAmount(amount: number, currency: string): string {
  const num = Number(amount) || 0;
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formattedInt}.${decPart} ${currency}`;
}

export function formatQrTnd(amount: number): string {
  const num = Number(amount) || 0;
  const fixed = num.toFixed(3);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formattedInt}.${decPart} TND`;
}

function findLinkedInvoice(order: PaymentOrder, invoices?: Invoice[]): Invoice | undefined {
  if (!invoices || invoices.length === 0) return undefined;
  return invoices.find(
    inv =>
      (order.invoiceId && inv.id === order.invoiceId) ||
      doesOrderBelongToInvoice(order, inv)
  );
}

function formatPaymentTypeShort(order: PaymentOrder, linkedInvoice?: Invoice): string {
  const t = order.transferType || 'VIREMENT';
  let base = 'Virement bancaire';
  if (t === 'LC') {
    base = order.lcNumber ? `LC (${cleanQrText(order.lcNumber)})` : 'Credit Documentaire (LC)';
  } else if (t === 'REMISE') {
    base = order.lcNumber
      ? `Remise Doc. (${cleanQrText(order.lcNumber)})`
      : 'Remise Documentaire';
  } else if (t === 'AUTRE') {
    base = order.lcNumber ? `Autre (${cleanQrText(order.lcNumber)})` : 'Autre paiement';
  }
  if (linkedInvoice?.paymentScheme === '50_LC_50_VIREMENT') {
    base += ' [50% LC / 50% Virement]';
  }
  return base;
}

function formatPct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  const rounded = Math.round(pct * 10) / 10;
  return Math.abs(rounded - Math.round(rounded)) < 0.05
    ? `${Math.round(rounded)}%`
    : `${rounded.toFixed(1)}%`;
}

function buildSingleOrderQrLines(
  order: PaymentOrder,
  linkedInvoice: Invoice | undefined,
  allOrders: PaymentOrder[],
  negotiatedRate?: number,
  compact = false
): string[] {
  const printData = computeOrderPrintData(order, linkedInvoice, allOrders);
  const lines: string[] = [];

  lines.push(`Ordre: ${order.orderNumber}`);
  lines.push(
    `Fournisseur: ${cleanQrText(order.beneficiaryName)}${
      order.beneficiaryCountry ? ` (${cleanQrText(order.beneficiaryCountry)})` : ''
    }`
  );

  // Invoice / Proforma / Contract
  const invParts = [
    `${printData.documentRefLabel === 'Réf. Proforma' ? 'Proforma' : 'Facture'}: ${cleanQrText(
      printData.invoiceNumber
    )} (${printData.invoiceDateFormatted})`,
  ];
  if (printData.proformaRecall) {
    invParts.push(`Rappel ${cleanQrText(printData.proformaRecall)}`);
  }
  if (
    linkedInvoice?.definitiveInvoiceNumber &&
    order.documentBasis === 'PROFORMA' &&
    linkedInvoice.definitiveInvoiceNumber.trim() !== printData.invoiceNumber
  ) {
    invParts.push(`Fact. def.: ${cleanQrText(linkedInvoice.definitiveInvoiceNumber)}`);
  }
  if (printData.contractNumber) {
    invParts.push(`Contrat: ${cleanQrText(printData.contractNumber)}`);
  }
  lines.push(invParts.join(' | '));

  // Payment type & domiciliary bank
  const paymentTypeText = formatPaymentTypeShort(order, linkedInvoice);
  lines.push(
    `Type paiement: ${paymentTypeText} | Banque: ${cleanQrText(order.bankName)}${
      order.bankBranch ? ` (${cleanQrText(order.bankBranch)})` : ''
    }`
  );

  // Complete amount details
  const amountParts = [`Montant net: ${formatQrAmount(printData.netAmount, order.currency)}`];
  if (printData.hasDeductions) {
    amountParts.push(`Brut impute: ${formatQrAmount(printData.grossAmount, order.currency)}`);
    const dedDetail =
      Array.isArray(order.deductions) && order.deductions.length > 0 && !compact
        ? ` (${order.deductions
            .map(d => `${cleanQrText(d.label)}: ${Number(d.amount || 0).toFixed(2)}`)
            .join(', ')})`
        : '';
    amountParts.push(
      `Deductions: ${formatQrAmount(printData.deductionsTotal, order.currency)}${dedDetail}`
    );
  }
  lines.push(amountParts.join(' | '));

  // Linked invoice total, share %, cumulative, remaining balance
  if (printData.hasLinkedInvoice && printData.invoiceTotalAmount !== undefined) {
    const shareParts = [
      `Total facture: ${formatQrAmount(printData.invoiceTotalAmount, order.currency)}`,
      `Part ordre: ${formatPct(printData.orderSharePercent)}`,
      `Cumul regle: ${formatPct(printData.cumulativePercent)}`,
    ];
    if (printData.remainingAmount !== undefined) {
      shareParts.push(`Reste: ${formatQrAmount(printData.remainingAmount, order.currency)}`);
    }
    lines.push(shareParts.join(' | '));
  }

  // Amount in words & TND counter-value / bank fees
  if (!compact && order.amountInWords) {
    lines.push(`En lettres: ${cleanQrText(order.amountInWords)}`);
  }

  const tndParts: string[] = [];
  if (negotiatedRate && negotiatedRate > 0) {
    tndParts.push(
      `CV TND (cours ${negotiatedRate.toFixed(4)}): ${formatQrTnd(order.amount * negotiatedRate)}`
    );
  } else if (order.debitAmountTnd && order.debitAmountTnd > 0) {
    tndParts.push(`Montant debite: ${formatQrTnd(order.debitAmountTnd)}`);
  }
  if (order.bankFees && order.bankFees > 0) {
    tndParts.push(`Frais bq: ${formatQrTnd(order.bankFees)}`);
  }
  if (tndParts.length > 0) {
    lines.push(tndParts.join(' | '));
  }

  if (!compact && printData.invoicePurpose) {
    lines.push(`Objet: ${cleanQrText(printData.invoicePurpose)}`);
  }

  return lines;
}

const MAX_QR_PAYLOAD_LENGTH = 1350;

export function buildConsultationQrPayload(
  consultation: CurrencyConsultation,
  orders: PaymentOrder[] = [],
  invoices: Invoice[] = []
): string {
  const buildText = (compact: boolean): string => {
    const header: string[] = [
      `MTK DFC | Consultation: ${consultation.consultationNumber}`,
      `Montant consultation: ${formatQrAmount(consultation.totalAmount, consultation.currency)} (${consultation.orderIds.length} ordre(s))`,
      `Type achat: ${cleanQrText(consultation.purchaseType || 'au comptant')} | Date op.: ${formatQrDate(consultation.operationDate)}`,
    ];

    if (consultation.negotiatedRate && consultation.negotiatedRate > 0) {
      header.push(
        `Banque retenue: ${cleanQrText(
          consultation.selectedBankName || consultation.selectedBankId || '—'
        )} | Cours: ${consultation.negotiatedRate.toFixed(4)} TND | CV Totale: ${formatQrTnd(
          consultation.totalAmount * consultation.negotiatedRate
        )}`
      );
    }
    if (consultation.confirmationRef) {
      header.push(`Ref. confirmation: ${consultation.confirmationRef}`);
    }

    const matchedOrders = consultation.orderIds
      .map(oid => orders.find(o => o.id === oid))
      .filter((o): o is PaymentOrder => Boolean(o));

    if (matchedOrders.length === 0) {
      header.push(
        `Ordres: ${
          consultation.orderNumbers.length > 0 ? consultation.orderNumbers.join(', ') : '—'
        }`
      );
      return header.join('\n');
    }

    const sections: string[] = [header.join('\n')];
    for (const order of matchedOrders) {
      const linkedInvoice = findLinkedInvoice(order, invoices);
      sections.push(
        buildSingleOrderQrLines(
          order,
          linkedInvoice,
          orders,
          consultation.negotiatedRate,
          compact
        ).join('\n')
      );
    }
    return sections.join('\n---\n');
  };

  const full = buildText(false);
  if (full.length <= MAX_QR_PAYLOAD_LENGTH) {
    return full;
  }

  const compact = buildText(true);
  if (compact.length <= MAX_QR_PAYLOAD_LENGTH) {
    return compact;
  }

  return `${compact.slice(0, MAX_QR_PAYLOAD_LENGTH - 3)}...`;
}

export function buildPurchaseConfirmationQrPayload(
  letter: PurchaseConfirmationLetter,
  consultation: CurrencyConsultation,
  orders: PaymentOrder[] = [],
  invoices: Invoice[] = []
): string {
  const buildText = (compact: boolean): string => {
    const rate = letter.lines[0]?.rate || consultation.negotiatedRate || 0;
    const totalForeign = letter.lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const currency = letter.lines[0]?.currency || consultation.currency;

    const header: string[] = [
      `MTK DFC | Confirmation ${letter.confirmationRef} (${consultation.consultationNumber})`,
      `Dest.: ${letter.recipientBankCode} | Banque achat: ${letter.purchaseBankCode}`,
      `Montant lettre: ${formatQrAmount(totalForeign, currency)} | Cours: ${
        rate > 0 ? `${rate.toFixed(4)} TND` : '—'
      } | CV TND: ${formatQrTnd(letter.totalCounterValueTnd)}`,
      `Date conf.: ${formatQrDate(letter.confirmationDate)} | Date valeur: ${formatQrDate(
        letter.valueDate
      )} (${cleanQrText(consultation.purchaseType || 'au comptant')})`,
    ];

    if (letter.bctTransferCounterValueTnd && letter.bctTransferCounterValueTnd > 0) {
      header.push(`Transfert BCT: ${formatQrTnd(letter.bctTransferCounterValueTnd)}`);
    }

    const sections: string[] = [header.join('\n')];
    for (const line of letter.lines) {
      const matchedOrder = orders.find(o => o.id === line.orderId);
      if (matchedOrder) {
        const linkedInvoice = findLinkedInvoice(matchedOrder, invoices);
        sections.push(
          buildSingleOrderQrLines(matchedOrder, linkedInvoice, orders, line.rate, compact).join(
            '\n'
          )
        );
      } else {
        const typeText =
          line.transferType === 'LC'
            ? `LC${line.lcNumber ? ` (${line.lcNumber})` : ''}`
            : line.transferType || 'VIREMENT';
        sections.push(
          [
            `Ordre: ${line.orderNumber} | Beneficiaire: ${cleanQrText(line.beneficiaryName)}`,
            `Type paiement: ${typeText} | Domiciliation: ${line.domiciliaryBankLabel}`,
            `Montant: ${formatQrAmount(line.amount, line.currency)} | CV TND: ${formatQrTnd(
              line.counterValueTnd
            )}`,
          ].join('\n')
        );
      }
    }

    return sections.join('\n---\n');
  };

  const full = buildText(false);
  if (full.length <= MAX_QR_PAYLOAD_LENGTH) {
    return full;
  }
  const compact = buildText(true);
  if (compact.length <= MAX_QR_PAYLOAD_LENGTH) {
    return compact;
  }
  return `${compact.slice(0, MAX_QR_PAYLOAD_LENGTH - 3)}...`;
}

export interface QrMatrixData {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

export function getQrCodeMatrix(payload: string): QrMatrixData {
  const safePayload = payload && payload.trim() ? payload : 'MTK-CONSULTATION';
  const errorCorrectionLevel = safePayload.length > 750 ? 'L' : 'M';
  const qr = QRCode.create(safePayload, { errorCorrectionLevel });
  const size = qr.modules.size;
  return {
    size,
    isDark: (row: number, col: number) => Boolean(qr.modules.get(row, col)),
  };
}

export function renderQrCodeToJsPdf(
  doc: jsPDF,
  payload: string,
  x: number,
  y: number,
  boxSizeMm: number,
  caption?: string
): void {
  const matrix = getQrCodeMatrix(payload);
  const quietZoneMm = 1.2;
  const innerSizeMm = Math.max(4, boxSizeMm - quietZoneMm * 2);
  const cellSize = innerSizeMm / matrix.size;

  // White background + subtle border frame
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(x, y, boxSizeMm, boxSizeMm, 'FD');

  // Crisp vector QR modules
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.isDark(r, c)) {
        doc.rect(
          x + quietZoneMm + c * cellSize,
          y + quietZoneMm + r * cellSize,
          cellSize + 0.02,
          cellSize + 0.02,
          'F'
        );
      }
    }
  }

  if (caption) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(80, 80, 80);
    doc.text(caption, x + boxSizeMm / 2, y + boxSizeMm + 2.6, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }
}
