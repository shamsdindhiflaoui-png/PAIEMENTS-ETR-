import { jsPDF } from 'jspdf';
import {
  Bank,
  CurrencyConsultation,
  PaymentOrder,
  PurchaseConfirmationLetter,
} from '../types/payment';
import { formatConsultationAmount, formatConsultationDate } from './consultationPdf';
import {
  computeOfferRankingSummary,
  rankBankOffers,
  RankedBankOffer,
} from './consultationQuotes';
import {
  buildPurchaseConfirmations,
  computeDefaultValueDate,
  formatRate4,
  formatTndCounterValue,
  getBankDeskInfo,
} from './purchaseConfirmationPdf';

export interface RecapOrderRow {
  orderId: string;
  orderNumber: string;
  beneficiaryName: string;
  instrumentLabel: string;
  domiciliaryBankCode: string;
  domiciliaryBankLabel: string;
  amount: number;
  currency: string;
  rate: number;
  counterValueTnd: number;
  isSameAsPurchaseBank: boolean;
  bctInstruction: string;
}

export interface RecapQuoteRow {
  rank: number;
  bankId: string;
  bankCode: string;
  bankName: string;
  proposedAmount: number;
  isFullAmount: boolean;
  rate: number;
  counterValueTnd: number;
  spreadVsLowestRate: number;
  isRetained: boolean;
}

export interface RecapLetterRow {
  pageNumber: number;
  role: PurchaseConfirmationLetter['role'];
  roleLabel: string;
  recipientBankCode: string;
  recipientBankName: string;
  destLabel: string;
  faxLabel: string;
  ordersCount: number;
  totalCounterValueTnd: number;
  instructionSummary: string;
}

export interface PurchaseConfirmationRecapData {
  consultationId: string;
  consultationNumber: string;
  confirmationRef: string;
  operationDate: string;
  confirmationDate: string;
  valueDate: string;
  purchaseType: string;
  currency: string;
  totalAmount: number;
  purchaseBankId: string;
  purchaseBankCode: string;
  purchaseBankName: string;
  negotiatedRate: number;
  totalCounterValueTnd: number;
  routingMode: 'SAME_BANK' | 'BCT_INTERBANK';
  routingLabel: string;
  bctTotalTransferTnd: number;
  potentialSavingsTnd: number;
  createdBy: string;
  notes?: string;
  orderRows: RecapOrderRow[];
  quoteRows: RecapQuoteRow[];
  letterRows: RecapLetterRow[];
}

function pdfSafeText(str: string): string {
  return (str || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2260/g, '!=')
    .replace(/\u2190/g, '<-')
    .replace(/\u2192/g, '->')
    .replace(/\u00a0/g, ' ');
}

function truncateText(text: string, maxLen: number): string {
  const clean = (text || '').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 3))}...`;
}

function getInstrumentLabel(order: PaymentOrder): string {
  if (order.transferType === 'LC') {
    return order.lcNumber ? `LC ${order.lcNumber}` : 'LC';
  }
  if (order.transferType === 'REMISE') {
    return order.lcNumber ? `Remise ${order.lcNumber}` : 'Remise doc.';
  }
  if (order.transferType === 'AUTRE') {
    return order.lcNumber ? `Autre (${order.lcNumber})` : 'Autre';
  }
  return 'Virement';
}

export function buildPurchaseConfirmationRecapData(
  consultation: CurrencyConsultation,
  orders: PaymentOrder[],
  banks: Bank[]
): PurchaseConfirmationRecapData | null {
  const purchaseBankId = consultation.selectedBankId || '';
  const negotiatedRate = Number(consultation.negotiatedRate || 0);
  if (!purchaseBankId || negotiatedRate <= 0) {
    return null;
  }

  const purchaseBank = banks.find(b => b.id === purchaseBankId);
  const purchaseDesk = getBankDeskInfo(
    purchaseBank,
    purchaseBank?.code || purchaseBankId,
    consultation.selectedBankName
  );
  const purchaseBankCode = purchaseDesk.shortDisplayCode;
  const purchaseBankName =
    purchaseBank?.name || consultation.selectedBankName || purchaseBankCode;

  const confirmationDate = consultation.confirmationDate || consultation.operationDate;
  const valueDate = consultation.valueDate || computeDefaultValueDate(confirmationDate);
  const confirmationRef = consultation.confirmationRef || '101/26';

  const letters = buildPurchaseConfirmations(consultation, orders, banks, {
    selectedBankId: purchaseBankId,
    selectedBankName: purchaseBankName,
    negotiatedRate,
    confirmationRef,
    confirmationDate,
    valueDate,
  });

  if (letters.length === 0) {
    return null;
  }

  const consultationOrders = consultation.orderIds
    .map(oid => orders.find(o => o.id === oid))
    .filter((o): o is PaymentOrder => Boolean(o));

  const orderRows: RecapOrderRow[] = consultationOrders.map(order => {
    const domBank = banks.find(b => b.id === order.bankId);
    const domDesk = getBankDeskInfo(domBank, domBank?.code || order.bankId, order.bankName);
    const domLabel = order.bankBranch
      ? `${domDesk.shortDisplayCode} ${order.bankBranch}`.trim()
      : domDesk.shortDisplayCode;
    const counterValueTnd = Number((order.amount * negotiatedRate).toFixed(3));
    const isSame = order.bankId === purchaseBankId;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      beneficiaryName: order.beneficiaryName,
      instrumentLabel: getInstrumentLabel(order),
      domiciliaryBankCode: domDesk.shortDisplayCode,
      domiciliaryBankLabel: domLabel,
      amount: order.amount,
      currency: order.currency,
      rate: negotiatedRate,
      counterValueTnd,
      isSameAsPurchaseBank: isSame,
      bctInstruction: isSame
        ? `Exécution directe (${purchaseBankCode})`
        : `Virement BCT : ${purchaseBankCode} <-> ${domDesk.shortDisplayCode}`,
    };
  });

  const totalAmount = Number(
    orderRows.reduce((sum, r) => sum + r.amount, 0).toFixed(2)
  );
  const totalCounterValueTnd = Number(
    orderRows.reduce((sum, r) => sum + r.counterValueTnd, 0).toFixed(3)
  );

  const isSameBankMode =
    letters.length === 1 && letters[0].role === 'SAME_BANK_PURCHASE';
  const routingMode = isSameBankMode ? 'SAME_BANK' : 'BCT_INTERBANK';
  const routingLabel = isSameBankMode
    ? 'Banque de domiciliation = Banque d’achat (1 confirmation)'
    : `Banque(s) de domiciliation ≠ Banque d’achat · Circuit BCT (${letters.length} confirmations)`;

  const purchaseLetter = letters.find(l => l.role === 'PURCHASE_BANK');
  const bctTotalTransferTnd = isSameBankMode
    ? 0
    : Number(
        (
          purchaseLetter?.bctTransferCounterValueTnd ??
          orderRows
            .filter(r => !r.isSameAsPurchaseBank)
            .reduce((sum, r) => sum + r.counterValueTnd, 0)
        ).toFixed(3)
      );

  // Quotes comparison
  const sourceQuotes =
    consultation.quotes && consultation.quotes.length > 0
      ? consultation.quotes
      : [
          {
            bankId: purchaseBankId,
            bankName: purchaseBankName,
            bankCode: purchaseBankCode,
            proposedAmount: totalAmount,
            isFullAmount: true,
            rate: negotiatedRate,
            feesTnd: 0,
            validityMinutes: 10,
            receivedAt: consultation.createdAt,
          },
        ];

  const ranked: RankedBankOffer[] = rankBankOffers(sourceQuotes, consultation.totalAmount);
  const summary = computeOfferRankingSummary(ranked, consultation.totalAmount);

  const quoteRows: RecapQuoteRow[] = ranked.map(offer => {
    const b = banks.find(bk => bk.id === offer.bankId);
    const desk = getBankDeskInfo(b, offer.bankCode || b?.code, offer.bankName);
    return {
      rank: offer.rank,
      bankId: offer.bankId,
      bankCode: desk.shortDisplayCode,
      bankName: offer.bankName,
      proposedAmount: offer.proposedAmount,
      isFullAmount: offer.isFullAmount,
      rate: offer.rate,
      counterValueTnd: offer.counterValueTnd,
      spreadVsLowestRate: offer.spreadVsBestRate,
      isRetained: offer.bankId === purchaseBankId,
    };
  });

  const letterRows: RecapLetterRow[] = letters.map((letter, idx) => {
    const roleLabel =
      letter.role === 'SAME_BANK_PURCHASE'
        ? 'Confirmation unique (Domiciliation = Achat)'
        : letter.role === 'DOMICILIARY_BANK'
        ? 'Banque de domiciliation (Virement BCT)'
        : 'Banque d’achat retenue';

    const instructionSummary =
      letter.role === 'SAME_BANK_PURCHASE'
        ? `Confirmation d'achat directe sans mouvement BCT`
        : letter.role === 'DOMICILIARY_BANK'
        ? `Créditer ${letter.purchaseBankCode} pour virement BCT de TND ${formatTndCounterValue(
            letter.totalCounterValueTnd
          )}`
        : `Réception BCT de ${(letter.otherDomiciliaryBankLabels || []).join(', ')} : TND ${formatTndCounterValue(
            letter.bctTransferCounterValueTnd ?? letter.totalCounterValueTnd
          )}`;

    return {
      pageNumber: idx + 1,
      role: letter.role,
      roleLabel,
      recipientBankCode: letter.recipientBankCode,
      recipientBankName: letter.recipientBankName,
      destLabel: letter.destLabel,
      faxLabel: letter.faxLabel,
      ordersCount: letter.lines.length,
      totalCounterValueTnd: letter.totalCounterValueTnd,
      instructionSummary,
    };
  });

  return {
    consultationId: consultation.id,
    consultationNumber: consultation.consultationNumber,
    confirmationRef,
    operationDate: consultation.operationDate,
    confirmationDate,
    valueDate,
    purchaseType: consultation.purchaseType,
    currency: consultation.currency,
    totalAmount,
    purchaseBankId,
    purchaseBankCode,
    purchaseBankName,
    negotiatedRate,
    totalCounterValueTnd,
    routingMode,
    routingLabel,
    bctTotalTransferTnd,
    potentialSavingsTnd: summary.potentialSavingsTnd,
    createdBy: consultation.createdBy,
    notes: consultation.notes,
    orderRows,
    quoteRows,
    letterRows,
  };
}

function drawSectionHeading(doc: jsPDF, title: string, x: number, y: number, width: number): number {
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(x, y, width, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(pdfSafeText(title), x + 2.5, y + 4.4);
  doc.setTextColor(15, 23, 42);
  return y + 6.5;
}

function drawPageHeader(doc: jsPDF, recap: PurchaseConfirmationRecapData, x: number, width: number): number {
  // Top Banner
  doc.setFillColor(244, 246, 200); // MTK Pale Yellow
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.rect(x, 12, width, 21, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MANUFACTURE DES TABACS DE KAIROUAN (MTK)', x + 4, 18.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Direction Financiere & Comptable (DFC) - Reglements Internationaux', x + 4, 22.8);
  doc.text('B.P. 106 - 3100 Kairouan | Tel : (77) 281.309 | Email : mtk.tn@mtk.tn', x + 4, 27.2);

  // Right Reference Box inside banner
  doc.setFillColor(15, 23, 42);
  doc.rect(x + width - 54, 14, 50, 17, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(pdfSafeText(`RECAP CONFIRMATION ${recap.confirmationRef}`), x + width - 29, 19.5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(pdfSafeText(recap.consultationNumber), x + width - 29, 24.2, { align: 'center' });
  doc.text(pdfSafeText(`Date : ${formatConsultationDate(recap.confirmationDate)}`), x + width - 29, 28.6, {
    align: 'center',
  });

  // Document Main Title
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("RECAPITULATIF DE CONFIRMATION D'ACHAT DE DEVISES", x + width / 2, 40, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(pdfSafeText(recap.routingLabel), x + width / 2, 44.8, { align: 'center' });
  doc.setTextColor(15, 23, 42);

  return 49;
}

export function buildPurchaseConfirmationRecapPdfDocument(
  recap: PurchaseConfirmationRecapData
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182 mm

  const ensureSpace = (currentY: number, neededHeight: number): number => {
    if (currentY + neededHeight <= pageHeight - 18) {
      return currentY;
    }
    doc.addPage();
    return drawPageHeader(doc, recap, marginX, contentWidth);
  };

  let y = drawPageHeader(doc, recap, marginX, contentWidth);

  // 1. SYNTHESE DE L'OPERATION (4 KPI boxes + meta strip)
  const boxW = (contentWidth - 6) / 4;
  const boxH = 16;
  const kpis = [
    {
      label: 'MONTANT ACHETE',
      value: formatConsultationAmount(recap.totalAmount, recap.currency),
      sub: `${recap.orderRows.length} ordre(s) · ${recap.purchaseType}`,
    },
    {
      label: "BANQUE D'ACHAT RETENUE",
      value: recap.purchaseBankCode,
      sub: truncateText(recap.purchaseBankName, 26),
    },
    {
      label: 'COURS NEGOCIE RETENU',
      value: `${formatRate4(recap.negotiatedRate)} TND`,
      sub: `Valeur : ${formatConsultationDate(recap.valueDate)}`,
    },
    {
      label: 'CONTRE-VALEUR TOTALE',
      value: `TND ${formatTndCounterValue(recap.totalCounterValueTnd)}`,
      sub:
        recap.potentialSavingsTnd > 0
          ? `Economie : ${formatTndCounterValue(recap.potentialSavingsTnd)} DT`
          : 'Meilleure offre retenue',
    },
  ];

  kpis.forEach((kpi, i) => {
    const bx = marginX + i * (boxW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.rect(bx, y, boxW, boxH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafeText(kpi.label), bx + 2.5, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(kpi.value), bx + 2.5, y + 9.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafeText(kpi.sub), bx + 2.5, y + 14.0);
  });

  y += boxH + 5;

  // 2. DETAIL DES ORDRES DE PAIEMENT COUVERTS
  y = ensureSpace(y, 35);
  y = drawSectionHeading(
    doc,
    `1. DETAIL DES ORDRES DE PAIEMENT COUVERTS (${recap.orderRows.length})`,
    marginX,
    y,
    contentWidth
  );

  // Table header
  const ordCols = [26, 36, 28, 24, 24, 14, 30]; // sums to 182
  const ordHeaders = [
    'N° Ordre',
    'Bénéficiaire',
    'Instrument',
    'Domiciliation',
    `Montant (${recap.currency})`,
    'Cours',
    'Contre-valeur TND',
  ];

  const drawOrderTableHeader = (startY: number): number => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.rect(marginX, startY, contentWidth, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);
    let cx = marginX;
    ordHeaders.forEach((h, idx) => {
      const isRight = idx >= 4;
      doc.text(
        pdfSafeText(h),
        isRight ? cx + ordCols[idx] - 1.5 : cx + 1.5,
        startY + 4.4,
        isRight ? { align: 'right' } : undefined
      );
      cx += ordCols[idx];
    });
    return startY + 6.5;
  };

  y = drawOrderTableHeader(y);

  for (let i = 0; i < recap.orderRows.length; i++) {
    const row = recap.orderRows[i];
    if (y + 7 > pageHeight - 18) {
      doc.addPage();
      y = drawPageHeader(doc, recap, marginX, contentWidth);
      y = drawOrderTableHeader(y);
    }
    doc.setFillColor(i % 2 === 1 ? 248 : 255, i % 2 === 1 ? 250 : 255, i % 2 === 1 ? 252 : 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, contentWidth, 6.5, 'FD');

    let cx = marginX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 58, 138);
    doc.text(pdfSafeText(row.orderNumber), cx + 1.5, y + 4.3);
    cx += ordCols[0];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(truncateText(row.beneficiaryName, 22)), cx + 1.5, y + 4.3);
    cx += ordCols[1];

    doc.text(pdfSafeText(truncateText(row.instrumentLabel, 17)), cx + 1.5, y + 4.3);
    cx += ordCols[2];

    doc.setFont('helvetica', 'bold');
    doc.text(pdfSafeText(row.domiciliaryBankCode), cx + 1.5, y + 4.3);
    cx += ordCols[3];

    doc.setFont('helvetica', 'normal');
    doc.text(
      pdfSafeText(formatConsultationAmount(row.amount, '')),
      cx + ordCols[4] - 1.5,
      y + 4.3,
      { align: 'right' }
    );
    cx += ordCols[4];

    doc.text(pdfSafeText(formatRate4(row.rate)), cx + ordCols[5] - 1.5, y + 4.3, {
      align: 'right',
    });
    cx += ordCols[5];

    doc.setFont('helvetica', 'bold');
    doc.text(
      pdfSafeText(formatTndCounterValue(row.counterValueTnd)),
      cx + ordCols[6] - 1.5,
      y + 4.3,
      { align: 'right' }
    );

    y += 6.5;
  }

  // Orders total row
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(100, 116, 139);
  doc.rect(marginX, y, contentWidth, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL GENERAL DE LA CONFIRMATION', marginX + 2, y + 4.7);
  const amtRightX = marginX + ordCols[0] + ordCols[1] + ordCols[2] + ordCols[3] + ordCols[4] - 1.5;
  doc.text(
    pdfSafeText(formatConsultationAmount(recap.totalAmount, recap.currency)),
    amtRightX,
    y + 4.7,
    { align: 'right' }
  );
  doc.text(
    pdfSafeText(`TND ${formatTndCounterValue(recap.totalCounterValueTnd)}`),
    marginX + contentWidth - 1.5,
    y + 4.7,
    { align: 'right' }
  );
  y += 11;

  // 3. COMPARATIF DES COTATIONS BANCAIRES (MOINS-DISANT -> PLUS-DISANT)
  if (recap.quoteRows.length > 0) {
    y = ensureSpace(y, 28 + recap.quoteRows.length * 6.5);
    y = drawSectionHeading(
      doc,
      `2. CLASSEMENT DES OFFRES BANCAIRES RECUES (${recap.quoteRows.length})`,
      marginX,
      y,
      contentWidth
    );

    const qCols = [16, 56, 30, 22, 32, 26]; // sums to 182
    const qHeaders = [
      'Rang',
      'Banque',
      `Montant (${recap.currency})`,
      'Cours (TND)',
      'Contre-valeur TND',
      'Décision',
    ];

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.rect(marginX, y, contentWidth, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    let qx = marginX;
    qHeaders.forEach((h, idx) => {
      const isRight = idx >= 2 && idx <= 4;
      doc.text(
        pdfSafeText(h),
        isRight ? qx + qCols[idx] - 1.5 : qx + 1.5,
        y + 4.4,
        isRight ? { align: 'right' } : undefined
      );
      qx += qCols[idx];
    });
    y += 6.5;

    for (let i = 0; i < recap.quoteRows.length; i++) {
      const q = recap.quoteRows[i];
      if (y + 6.5 > pageHeight - 18) {
        doc.addPage();
        y = drawPageHeader(doc, recap, marginX, contentWidth);
      }

      if (q.isRetained) {
        doc.setFillColor(236, 253, 245); // emerald-50
      } else {
        doc.setFillColor(i % 2 === 1 ? 248 : 255, i % 2 === 1 ? 250 : 255, i % 2 === 1 ? 252 : 255);
      }
      doc.setDrawColor(203, 213, 225);
      doc.rect(marginX, y, contentWidth, 6.5, 'FD');

      let cx = marginX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`#${q.rank}`, cx + 1.5, y + 4.3);
      cx += qCols[0];

      doc.setFont('helvetica', q.isRetained ? 'bold' : 'normal');
      doc.text(pdfSafeText(truncateText(`${q.bankCode} - ${q.bankName}`, 34)), cx + 1.5, y + 4.3);
      cx += qCols[1];

      doc.setFont('helvetica', 'normal');
      doc.text(
        pdfSafeText(
          `${formatConsultationAmount(q.proposedAmount, '')}${q.isFullAmount ? ' (100%)' : ''}`
        ),
        cx + qCols[2] - 1.5,
        y + 4.3,
        { align: 'right' }
      );
      cx += qCols[2];

      doc.setFont('helvetica', 'bold');
      doc.text(pdfSafeText(formatRate4(q.rate)), cx + qCols[3] - 1.5, y + 4.3, {
        align: 'right',
      });
      cx += qCols[3];

      doc.setFont('helvetica', 'normal');
      doc.text(
        pdfSafeText(formatTndCounterValue(q.counterValueTnd)),
        cx + qCols[4] - 1.5,
        y + 4.3,
        { align: 'right' }
      );
      cx += qCols[4];

      doc.setFont('helvetica', 'bold');
      if (q.isRetained) {
        doc.setTextColor(4, 120, 87);
        doc.text('RETENUE', cx + 2, y + 4.3);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(pdfSafeText(`+${q.spreadVsLowestRate.toFixed(4)}`), cx + 2, y + 4.3);
      }
      doc.setTextColor(15, 23, 42);
      y += 6.5;
    }
    y += 5;
  }

  // 4. SYNTHESE DES CONFIRMATIONS ADRESSEES & REGLEMENTS BCT
  y = ensureSpace(y, 30 + recap.letterRows.length * 7.5);
  y = drawSectionHeading(
    doc,
    `3. SYNTHESE DES LETTRES DE CONFIRMATION & INSTRUCTIONS BCT (${recap.letterRows.length})`,
    marginX,
    y,
    contentWidth
  );

  const lCols = [14, 44, 24, 28, 72]; // sums to 182
  const lHeaders = ['Page', 'Destinataire & Rôle', 'Fax', 'Montant TND', 'Instruction BCT / Règlement'];

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.rect(marginX, y, contentWidth, 6.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  let lx = marginX;
  lHeaders.forEach((h, idx) => {
    const isRight = idx === 3;
    doc.text(
      pdfSafeText(h),
      isRight ? lx + lCols[idx] - 1.5 : lx + 1.5,
      y + 4.4,
      isRight ? { align: 'right' } : undefined
    );
    lx += lCols[idx];
  });
  y += 6.5;

  for (let i = 0; i < recap.letterRows.length; i++) {
    const lr = recap.letterRows[i];
    if (y + 7.5 > pageHeight - 18) {
      doc.addPage();
      y = drawPageHeader(doc, recap, marginX, contentWidth);
    }
    doc.setFillColor(i % 2 === 1 ? 248 : 255, i % 2 === 1 ? 250 : 255, i % 2 === 1 ? 252 : 255);
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginX, y, contentWidth, 7.5, 'FD');

    let cx = marginX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`${lr.pageNumber}/${recap.letterRows.length}`, cx + 1.5, y + 4.8);
    cx += lCols[0];

    doc.text(
      pdfSafeText(
        `${lr.recipientBankCode} (${lr.role === 'DOMICILIARY_BANK' ? 'Domiciliation' : 'Achat'})`
      ),
      cx + 1.5,
      y + 4.8
    );
    cx += lCols[1];

    doc.setFont('helvetica', 'normal');
    doc.text(pdfSafeText(truncateText(lr.faxLabel, 16)), cx + 1.5, y + 4.8);
    cx += lCols[2];

    doc.setFont('helvetica', 'bold');
    doc.text(
      pdfSafeText(formatTndCounterValue(lr.totalCounterValueTnd)),
      cx + lCols[3] - 1.5,
      y + 4.8,
      { align: 'right' }
    );
    cx += lCols[3];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.9);
    doc.text(pdfSafeText(truncateText(lr.instructionSummary, 52)), cx + 1.5, y + 4.8);

    y += 7.5;
  }

  if (recap.notes && recap.notes.trim()) {
    y = ensureSpace(y, 14);
    y += 4;
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(234, 179, 8);
    doc.rect(marginX, y, contentWidth, 10, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('Observations de la séance :', marginX + 2.5, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(pdfSafeText(truncateText(recap.notes, 115)), marginX + 2.5, y + 8);
    y += 10;
  }

  // 5. VISAS DFC
  y = ensureSpace(y, 32);
  y += 6;
  const sigW = (contentWidth - 8) / 3;
  const sigTitles = [
    'Service Trésorerie & Changes',
    'Contrôle de Gestion',
    'La Direction Financière',
  ];
  sigTitles.forEach((title, idx) => {
    const sx = marginX + idx * (sigW + 4);
    doc.setDrawColor(148, 163, 184);
    doc.setFillColor(255, 255, 255);
    doc.rect(sx, y, sigW, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pdfSafeText(title), sx + sigW / 2, y + 5, { align: 'center' });
    doc.setDrawColor(226, 232, 240);
    doc.line(sx + 6, y + 17, sx + sigW - 6, y + 17);
  });

  // Footer pagination on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafeText(
        `MTK International Payments (DFC) · Récapitulatif Confirmation ${recap.confirmationRef} · Édité par ${recap.createdBy}`
      ),
      marginX,
      pageHeight - 8
    );
    doc.text(`Page ${p} / ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadPurchaseConfirmationRecapPdf(
  consultation: CurrencyConsultation,
  orders: PaymentOrder[],
  banks: Bank[]
): void {
  const recap = buildPurchaseConfirmationRecapData(consultation, orders, banks);
  if (!recap) return;
  const doc = buildPurchaseConfirmationRecapPdfDocument(recap);
  const safeRef = (recap.confirmationRef || recap.consultationNumber).replace(
    /[/\\:*?"<>|]/g,
    '-'
  );
  doc.save(`Recap_Confirmation_${safeRef}.pdf`);
}
