import { jsPDF } from 'jspdf';
import { CurrencyConsultation, PaymentOrder } from '../types/payment';

export function formatConsultationDate(dateStr: string): string {
  if (!dateStr) return '';
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  return dateStr;
}

export function formatConsultationAmount(amount: number, currency: string): string {
  const num = Number(amount) || 0;
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formattedInt}.${decPart} ${currency}`;
}

export function formatConsultationTime(timeStr: string): string {
  const trimmed = (timeStr || '').trim();
  if (!trimmed) return '14h20';
  // Convert HH:MM -> HHhMM (ex: 14:20 -> 14h20)
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return `${colonMatch[1].padStart(2, '0')}h${colonMatch[2]}`;
  }
  return trimmed;
}

export function validateConsultationSelection(orders: PaymentOrder[]): {
  valid: boolean;
  currency?: PaymentOrder['currency'];
  totalAmount: number;
  error?: string;
} {
  if (!orders || orders.length === 0) {
    return {
      valid: false,
      totalAmount: 0,
      error: 'Veuillez sélectionner au moins un ordre de paiement déposé avec achat de devise exigé.',
    };
  }

  const invalidOrder = orders.find(o => o.status !== 'EN_ATTENTE_ACHAT_DEVISE');
  if (invalidOrder) {
    return {
      valid: false,
      totalAmount: 0,
      error: `L'ordre ${invalidOrder.orderNumber} n'est pas au statut « En attente d'achat devise ».`,
    };
  }

  const baseCurrency = orders[0].currency;
  const mixedCurrency = orders.find(o => o.currency !== baseCurrency);
  if (mixedCurrency) {
    return {
      valid: false,
      totalAmount: 0,
      error: `Impossible de regrouper des devises différentes (${baseCurrency} et ${mixedCurrency.currency}) dans une même consultation.`,
    };
  }

  const totalAmount = Number(
    orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toFixed(2)
  );

  return {
    valid: true,
    currency: baseCurrency,
    totalAmount,
  };
}

function pdfSafeText(str: string): string {
  return (str || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ');
}

interface TextSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
  color?: [number, number, number];
}

function renderSegmentsParagraph(
  doc: jsPDF,
  segments: TextSegment[],
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  interface WordToken {
    word: string;
    bold: boolean;
    underline: boolean;
    color?: [number, number, number];
    width: number;
  }

  const tokens: WordToken[] = [];
  for (const seg of segments) {
    const style = seg.bold ? 'bolditalic' : 'italic';
    doc.setFont('times', style);
    doc.setFontSize(12);
    const parts = pdfSafeText(seg.text).split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      tokens.push({
        word: part,
        bold: Boolean(seg.bold),
        underline: Boolean(seg.underline),
        color: seg.color,
        width: doc.getTextWidth(part),
      });
    }
  }

  // Group into wrapped lines
  const lines: WordToken[][] = [];
  let currentLine: WordToken[] = [];
  let currentWidth = 0;

  for (const tok of tokens) {
    const isSpace = /^\s+$/.test(tok.word);
    if (currentLine.length === 0 && isSpace) continue;

    if (currentWidth + tok.width > maxWidth && currentLine.length > 0 && !isSpace) {
      // Trim trailing whitespace token
      while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1].word)) {
        currentLine.pop();
      }
      lines.push(currentLine);
      currentLine = [tok];
      currentWidth = tok.width;
    } else {
      currentLine.push(tok);
      currentWidth += tok.width;
    }
  }
  if (currentLine.length > 0) {
    while (currentLine.length > 0 && /^\s+$/.test(currentLine[currentLine.length - 1].word)) {
      currentLine.pop();
    }
    if (currentLine.length > 0) lines.push(currentLine);
  }

  let y = startY;
  for (const line of lines) {
    let x = startX;
    for (const tok of line) {
      doc.setFont('times', tok.bold ? 'bolditalic' : 'italic');
      doc.setFontSize(12);
      if (tok.color) {
        doc.setTextColor(tok.color[0], tok.color[1], tok.color[2]);
      } else {
        doc.setTextColor(15, 15, 15);
      }
      doc.text(tok.word, x, y);
      if (tok.underline && !/^\s+$/.test(tok.word)) {
        doc.setDrawColor(tok.color ? tok.color[0] : 15, tok.color ? tok.color[1] : 15, tok.color ? tok.color[2] : 15);
        doc.setLineWidth(0.35);
        doc.line(x, y + 0.9, x + tok.width, y + 0.9);
      }
      x += tok.width;
    }
    y += lineHeight;
  }

  doc.setTextColor(15, 15, 15);
  return y;
}

export function buildConsultationPdfDocument(consultation: CurrencyConsultation): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 28;
  const contentWidth = pageWidth - marginX * 2; // 154 mm
  const contactEmail = pdfSafeText(consultation.contactEmail || 'mtk.tn@mtk.tn');
  const contactPhone = pdfSafeText(consultation.contactPhone || '(77) 281 699');
  const faxNumbers = pdfSafeText(consultation.faxNumbers || '(77).287.200   (77).283.130');
  const formattedAmount = pdfSafeText(
    formatConsultationAmount(consultation.totalAmount, consultation.currency)
  );
  const formattedDate = pdfSafeText(formatConsultationDate(consultation.operationDate));
  const purchaseType = pdfSafeText(consultation.purchaseType || 'au comptant');
  const submissionTime = pdfSafeText(formatConsultationTime(consultation.submissionDeadlineTime));
  const validityTime = pdfSafeText(formatConsultationTime(consultation.validityDeadlineTime));

  // --- TOP HEADER BOX (Matches MTK template) ---
  const boxX = marginX;
  const boxY = 16;
  const boxW = contentWidth;
  const topSectionH = 22.5;
  const bottomSectionH = 16;

  doc.setFillColor(232, 232, 232);
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);
  doc.rect(boxX, boxY, boxW, topSectionH + bottomSectionH, 'FD');

  // Horizontal divider inside box
  doc.line(boxX, boxY + topSectionH, boxX + boxW, boxY + topSectionH);

  // Box Top Section
  doc.setTextColor(15, 15, 15);
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.text('MANUFACTURE DES TABACS DE KAIROUAN', pageWidth / 2, boxY + 6.5, { align: 'center' });

  doc.setFontSize(9.5);
  doc.text('B.P. 106 - 3100 KAIROUAN - TUNISIE', pageWidth / 2, boxY + 11.2, { align: 'center' });
  doc.text('R.C. N° : B4141995', pageWidth / 2, boxY + 15.5, { align: 'center' });
  doc.text('TEL : (77) 281.309 - (77) 282.824   *   FAX : (77) 283.130 - (77) 287.200', pageWidth / 2, boxY + 20, { align: 'center' });

  // Box Bottom Section
  const bY = boxY + topSectionH;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(9.5);
  doc.text('Expéditeur : Direction Financière', pageWidth / 2, bY + 4.8, { align: 'center' });
  doc.text(
    `N.B. : En cas d'illisibilité du message, Veuillez nous contacter au ${contactPhone}`,
    pageWidth / 2,
    bY + 9.4,
    { align: 'center' }
  );

  const emailPrefix = 'E-mail : ';
  const fullEmailLine = `${emailPrefix}${contactEmail}`;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(9.5);
  const emailLineW = doc.getTextWidth(fullEmailLine);
  const emailPrefixW = doc.getTextWidth(emailPrefix);
  const emailStartX = pageWidth / 2 - emailLineW / 2;
  doc.setTextColor(15, 15, 15);
  doc.text(emailPrefix, emailStartX, bY + 14);
  doc.setTextColor(29, 78, 216);
  doc.text(contactEmail, emailStartX + emailPrefixW, bY + 14);
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(0.25);
  doc.line(
    emailStartX + emailPrefixW,
    bY + 14.7,
    emailStartX + emailLineW,
    bY + 14.7
  );

  // --- BODY ---
  doc.setTextColor(15, 15, 15);
  let cursorY = boxY + topSectionH + bottomSectionH + 11;

  // Title: TEXTE
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.text('TEXTE', pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 12;

  // Objet : Consultation pour achat de devises.
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  const objetLabel = 'Objet :';
  const objetW = doc.getTextWidth(objetLabel);
  doc.text(objetLabel, marginX, cursorY);
  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(0.3);
  doc.line(marginX, cursorY + 0.9, marginX + objetW, cursorY + 0.9);
  doc.setFont('times', 'italic');
  doc.text(' Consultation pour achat de devises.', marginX + objetW, cursorY);
  cursorY += 13;

  // La M.T.K. envisage d'acheter :
  doc.setFont('times', 'italic');
  doc.text('La ', marginX, cursorY);
  let curX = marginX + doc.getTextWidth('La ');
  doc.setFont('times', 'bolditalic');
  doc.text('M.T.K.', curX, cursorY);
  curX += doc.getTextWidth('M.T.K.');
  doc.setFont('times', 'italic');
  doc.text(" envisage d'acheter :", curX, cursorY);
  cursorY += 9;

  // Bullet 1: Montant en devise
  const bulletX = marginX + 9;
  doc.setFont('times', 'italic');
  const b1Prefix = '-   Montant en devise :  ';
  doc.text(b1Prefix, bulletX, cursorY);
  doc.setFont('times', 'bolditalic');
  doc.text(formattedAmount, bulletX + doc.getTextWidth(b1Prefix), cursorY);
  cursorY += 8;

  // Bullet 2: Date d'opération
  doc.setFont('times', 'italic');
  doc.text(`-   Date d'opération :  ${formattedDate}`, bulletX, cursorY);
  cursorY += 8;

  // Bullet 3: Date valeur
  doc.text(`-   Date valeur :  ${purchaseType}`, bulletX, cursorY);
  cursorY += 10;

  // Paragraph 1 with underlined bold submissionDeadlineTime
  cursorY = renderSegmentsParagraph(
    doc,
    [
      { text: 'A cet effet nous vous prions de nous communiquer par Email (' },
      { text: contactEmail, color: [29, 78, 216], underline: true },
      { text: ') ou par fax, (en remplissant le tableau ci-après) votre meilleure cotation du jour de l\'opération avant ' },
      { text: submissionTime, bold: true, underline: true },
      { text: ' (heure limite) aux numéros suivants :' },
    ],
    marginX,
    cursorY,
    contentWidth,
    6.4
  );

  cursorY += 5.5;

  // Centered Fax numbers
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.text(faxNumbers, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 9.5;

  // Paragraph 2 with underlined bold validityDeadlineTime
  cursorY = renderSegmentsParagraph(
    doc,
    [
      { text: 'Votre cotation demeure valable jusqu\'à ' },
      { text: validityTime, bold: true, underline: true },
      { text: ', heure limite de confirmation de l\'achat par la M.T.K. par téléphone en attendant l\'expédition du fax de confirmation.' },
    ],
    marginX,
    cursorY,
    contentWidth,
    6.4
  );

  cursorY += 8;

  // Salutations right-aligned
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text('Meilleures salutations.', marginX + contentWidth - 10, cursorY, { align: 'right' });
  cursorY += 9;
  doc.setFont('times', 'bolditalic');
  doc.text('La Direction Financière', marginX + contentWidth - 6, cursorY, { align: 'right' });

  // --- BOTTOM SECTION: A REMPLIR PAR LA BANQUE ---
  const footerLineY = 242;
  doc.setFillColor(90, 90, 90);
  doc.rect(marginX, footerLineY, contentWidth, 2, 'F');

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 15);
  doc.text('A REMPLIR PAR LA BANQUE', pageWidth / 2, footerLineY + 7.5, { align: 'center' });

  // Table: Banque | Montant | Cours
  const tableX = marginX;
  const tableY = footerLineY + 11.5;
  const colW = contentWidth / 3;
  const headerH = 6.5;
  const rowH = 6.5;

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  doc.rect(tableX, tableY, contentWidth, headerH + rowH * 2);
  // Column dividers
  doc.line(tableX + colW, tableY, tableX + colW, tableY + headerH + rowH * 2);
  doc.line(tableX + colW * 2, tableY, tableX + colW * 2, tableY + headerH + rowH * 2);
  // Row dividers
  doc.line(tableX, tableY + headerH, tableX + contentWidth, tableY + headerH);
  doc.line(tableX, tableY + headerH + rowH, tableX + contentWidth, tableY + headerH + rowH);

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(11.5);
  doc.text('Banque', tableX + colW / 2, tableY + 4.7, { align: 'center' });
  doc.text('Montant', tableX + colW * 1.5, tableY + 4.7, { align: 'center' });
  doc.text('Cours', tableX + colW * 2.5, tableY + 4.7, { align: 'center' });

  // Subtle audit traceability line at bottom margin
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    pdfSafeText(
      `Réf. Consultation : ${consultation.consultationNumber}  |  Ordres rattachés : ${consultation.orderNumbers.join(', ')}`
    ),
    pageWidth / 2,
    287,
    { align: 'center' }
  );

  return doc;
}

export function downloadConsultationPdf(consultation: CurrencyConsultation): void {
  const doc = buildConsultationPdfDocument(consultation);
  doc.save(`Consultation_Achat_Devise_${consultation.consultationNumber}.pdf`);
}
