import { jsPDF } from 'jspdf';
import {
  ConsultationPdfTextOverrides,
  CurrencyConsultation,
  Invoice,
  PaymentOrder,
} from '../types/payment';
import { buildConsultationQrPayload, renderQrCodeToJsPdf } from './consultationQr';

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

export interface ResolvedConsultationPdfContent {
  headerCompany: string;
  headerAddress: string;
  headerRc: string;
  headerTelFax: string;
  senderLabel: string;
  nbPrefix: string;
  contactPhone: string;
  contactEmail: string;
  sectionTitle: string;
  subjectLabel: string;
  subjectText: string;
  introLine: string;
  amountBulletLabel: string;
  amountBulletValue: string;
  operationDateBulletLabel: string;
  operationDateBulletValue: string;
  valueDateBulletLabel: string;
  valueDateBulletValue: string;
  quoteRequestParagraph: string;
  isQuoteRequestCustom: boolean;
  faxNumbers: string;
  validityParagraph: string;
  isValidityCustom: boolean;
  closingSalutation: string;
  signatureLabel: string;
  bankTableTitle: string;
  footerTraceability: string;
  submissionTime: string;
  validityTime: string;
}

export function getDefaultConsultationPdfContent(
  consultation: CurrencyConsultation
): ResolvedConsultationPdfContent {
  const contactEmail = consultation.contactEmail || 'mtk.tn@mtk.tn';
  const contactPhone = consultation.contactPhone || '(77) 281 699';
  const faxNumbers = consultation.faxNumbers || '(77).287.200   (77).283.130';
  const formattedAmount = formatConsultationAmount(consultation.totalAmount, consultation.currency);
  const formattedDate = formatConsultationDate(consultation.operationDate);
  const purchaseType = consultation.purchaseType || 'au comptant';
  const submissionTime = formatConsultationTime(consultation.submissionDeadlineTime);
  const validityTime = formatConsultationTime(consultation.validityDeadlineTime);

  return {
    headerCompany: 'MANUFACTURE DES TABACS DE KAIROUAN',
    headerAddress: 'B.P. 106 - 3100 KAIROUAN - TUNISIE',
    headerRc: 'R.C. N° : B4141995',
    headerTelFax: 'TEL : (77) 281.309 - (77) 282.824   *   FAX : (77) 283.130 - (77) 287.200',
    senderLabel: 'Expéditeur : Direction Financière',
    nbPrefix: "N.B. : En cas d'illisibilité du message, Veuillez nous contacter au",
    contactPhone,
    contactEmail,
    sectionTitle: 'TEXTE',
    subjectLabel: 'Objet :',
    subjectText: 'Consultation pour achat de devises.',
    introLine: "La M.T.K. envisage d'acheter :",
    amountBulletLabel: 'Montant en devise :',
    amountBulletValue: formattedAmount,
    operationDateBulletLabel: "Date d'opération :",
    operationDateBulletValue: formattedDate,
    valueDateBulletLabel: 'Date valeur :',
    valueDateBulletValue: purchaseType,
    quoteRequestParagraph: `A cet effet nous vous prions de nous communiquer par Email (${contactEmail}) ou par fax, (en remplissant le tableau ci-après) votre meilleure cotation du jour de l'opération avant ${submissionTime} (heure limite) aux numéros suivants :`,
    isQuoteRequestCustom: false,
    faxNumbers,
    validityParagraph: `Votre cotation demeure valable jusqu'à ${validityTime}, heure limite de confirmation de l'achat par la M.T.K. par téléphone en attendant l'expédition du fax de confirmation.`,
    isValidityCustom: false,
    closingSalutation: 'Meilleures salutations.',
    signatureLabel: 'La Direction Financière',
    bankTableTitle: 'A REMPLIR PAR LA BANQUE',
    footerTraceability: `Réf. Consultation : ${consultation.consultationNumber}  |  Ordres rattachés : ${consultation.orderNumbers.join(', ')}`,
    submissionTime,
    validityTime,
  };
}

export function resolveConsultationPdfContent(
  consultation: CurrencyConsultation,
  overrides?: ConsultationPdfTextOverrides
): ResolvedConsultationPdfContent {
  const defaults = getDefaultConsultationPdfContent(consultation);
  const effective = overrides !== undefined ? overrides : consultation.customPdfText;

  const pick = (customVal: string | undefined, defaultVal: string): string =>
    customVal !== undefined ? customVal : defaultVal;

  const contactEmail = pick(effective?.contactEmail, defaults.contactEmail);
  const defaultQuoteParagraphWithEmail = `A cet effet nous vous prions de nous communiquer par Email (${contactEmail}) ou par fax, (en remplissant le tableau ci-après) votre meilleure cotation du jour de l'opération avant ${defaults.submissionTime} (heure limite) aux numéros suivants :`;

  const quoteRequestParagraph = pick(
    effective?.quoteRequestParagraph,
    defaultQuoteParagraphWithEmail
  );
  const validityParagraph = pick(effective?.validityParagraph, defaults.validityParagraph);

  return {
    headerCompany: pick(effective?.headerCompany, defaults.headerCompany),
    headerAddress: pick(effective?.headerAddress, defaults.headerAddress),
    headerRc: pick(effective?.headerRc, defaults.headerRc),
    headerTelFax: pick(effective?.headerTelFax, defaults.headerTelFax),
    senderLabel: pick(effective?.senderLabel, defaults.senderLabel),
    nbPrefix: pick(effective?.nbPrefix, defaults.nbPrefix),
    contactPhone: pick(effective?.contactPhone, defaults.contactPhone),
    contactEmail,
    sectionTitle: pick(effective?.sectionTitle, defaults.sectionTitle),
    subjectLabel: pick(effective?.subjectLabel, defaults.subjectLabel),
    subjectText: pick(effective?.subjectText, defaults.subjectText),
    introLine: pick(effective?.introLine, defaults.introLine),
    amountBulletLabel: pick(effective?.amountBulletLabel, defaults.amountBulletLabel),
    amountBulletValue: pick(effective?.amountBulletValue, defaults.amountBulletValue),
    operationDateBulletLabel: pick(
      effective?.operationDateBulletLabel,
      defaults.operationDateBulletLabel
    ),
    operationDateBulletValue: pick(
      effective?.operationDateBulletValue,
      defaults.operationDateBulletValue
    ),
    valueDateBulletLabel: pick(effective?.valueDateBulletLabel, defaults.valueDateBulletLabel),
    valueDateBulletValue: pick(effective?.valueDateBulletValue, defaults.valueDateBulletValue),
    quoteRequestParagraph,
    isQuoteRequestCustom:
      effective?.quoteRequestParagraph !== undefined &&
      effective.quoteRequestParagraph !== defaultQuoteParagraphWithEmail,
    faxNumbers: pick(effective?.faxNumbers, defaults.faxNumbers),
    validityParagraph,
    isValidityCustom:
      effective?.validityParagraph !== undefined &&
      effective.validityParagraph !== defaults.validityParagraph,
    closingSalutation: pick(effective?.closingSalutation, defaults.closingSalutation),
    signatureLabel: pick(effective?.signatureLabel, defaults.signatureLabel),
    bankTableTitle: pick(effective?.bankTableTitle, defaults.bankTableTitle),
    footerTraceability: pick(effective?.footerTraceability, defaults.footerTraceability),
    submissionTime: defaults.submissionTime,
    validityTime: defaults.validityTime,
  };
}

export function extractConsultationOverridesForSave(
  content: ResolvedConsultationPdfContent,
  consultation: CurrencyConsultation
): ConsultationPdfTextOverrides | undefined {
  const defaults = getDefaultConsultationPdfContent(consultation);
  const result: ConsultationPdfTextOverrides = {};

  const editableKeys: Array<keyof ConsultationPdfTextOverrides> = [
    'headerCompany',
    'headerAddress',
    'headerRc',
    'headerTelFax',
    'senderLabel',
    'nbPrefix',
    'contactPhone',
    'contactEmail',
    'sectionTitle',
    'subjectLabel',
    'subjectText',
    'introLine',
    'amountBulletLabel',
    'amountBulletValue',
    'operationDateBulletLabel',
    'operationDateBulletValue',
    'valueDateBulletLabel',
    'valueDateBulletValue',
    'faxNumbers',
    'validityParagraph',
    'closingSalutation',
    'signatureLabel',
    'bankTableTitle',
    'footerTraceability',
  ];

  for (const key of editableKeys) {
    if (content[key] !== defaults[key]) {
      result[key] = content[key];
    }
  }

  const defaultQuoteWithEmail = `A cet effet nous vous prions de nous communiquer par Email (${content.contactEmail}) ou par fax, (en remplissant le tableau ci-après) votre meilleure cotation du jour de l'opération avant ${defaults.submissionTime} (heure limite) aux numéros suivants :`;
  if (content.quoteRequestParagraph !== defaultQuoteWithEmail) {
    result.quoteRequestParagraph = content.quoteRequestParagraph;
  }

  return Object.keys(result).length > 0 ? result : undefined;
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
        doc.setDrawColor(
          tok.color ? tok.color[0] : 15,
          tok.color ? tok.color[1] : 15,
          tok.color ? tok.color[2] : 15
        );
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

function renderMultilineItalicParagraph(
  doc: jsPDF,
  text: string,
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(15, 15, 15);
  const paragraphs = pdfSafeText(text).split(/\r?\n/);
  let y = startY;
  for (const para of paragraphs) {
    if (!para.trim()) {
      y += lineHeight * 0.7;
      continue;
    }
    const wrapped = doc.splitTextToSize(para, maxWidth) as string[];
    for (const line of wrapped) {
      doc.text(line, startX, y);
      y += lineHeight;
    }
  }
  return y;
}

export function buildConsultationPdfDocument(
  consultation: CurrencyConsultation,
  overrides?: ConsultationPdfTextOverrides,
  orders: PaymentOrder[] = [],
  invoices: Invoice[] = []
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const content = resolveConsultationPdfContent(consultation, overrides);
  const pageWidth = 210;
  const marginX = 28;
  const contentWidth = pageWidth - marginX * 2; // 154 mm
  const contactEmail = pdfSafeText(content.contactEmail);
  const contactPhone = pdfSafeText(content.contactPhone);
  const faxNumbers = pdfSafeText(content.faxNumbers);

  // --- TOP HEADER BOX (Matches MTK template) ---
  const boxX = marginX;
  const boxY = 16;
  const boxW = contentWidth;
  const topSectionH = 22.5;
  const bottomSectionH = 16;

  doc.setFillColor(246, 246, 246);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(boxX, boxY, boxW, topSectionH + bottomSectionH, 'FD');

  // Horizontal divider inside box
  doc.line(boxX, boxY + topSectionH, boxX + boxW, boxY + topSectionH);

  // Box Top Section
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.text(pdfSafeText(content.headerCompany), pageWidth / 2, boxY + 6.5, { align: 'center' });

  doc.setFontSize(9.5);
  doc.text(pdfSafeText(content.headerAddress), pageWidth / 2, boxY + 11.2, { align: 'center' });
  doc.text(pdfSafeText(content.headerRc), pageWidth / 2, boxY + 15.5, { align: 'center' });
  doc.text(pdfSafeText(content.headerTelFax), pageWidth / 2, boxY + 20, { align: 'center' });

  // Box Bottom Section
  const bY = boxY + topSectionH;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(9.5);
  doc.text(pdfSafeText(content.senderLabel), pageWidth / 2, bY + 4.8, { align: 'center' });
  doc.text(
    pdfSafeText(`${content.nbPrefix} ${contactPhone}`.trim()),
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
  doc.setTextColor(0, 0, 0);
  doc.text(emailPrefix, emailStartX, bY + 14);
  doc.text(contactEmail, emailStartX + emailPrefixW, bY + 14);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(emailStartX + emailPrefixW, bY + 14.7, emailStartX + emailLineW, bY + 14.7);

  // --- BODY ---
  doc.setTextColor(15, 15, 15);
  let cursorY = boxY + topSectionH + bottomSectionH + 11;

  // Title: TEXTE
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.text(pdfSafeText(content.sectionTitle), pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 12;

  // Objet : Consultation pour achat de devises.
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  const objetLabel = pdfSafeText(content.subjectLabel);
  const objetW = doc.getTextWidth(objetLabel);
  doc.text(objetLabel, marginX, cursorY);
  doc.setDrawColor(15, 15, 15);
  doc.setLineWidth(0.3);
  doc.line(marginX, cursorY + 0.9, marginX + objetW, cursorY + 0.9);
  doc.setFont('times', 'italic');
  doc.text(` ${pdfSafeText(content.subjectText)}`, marginX + objetW, cursorY);
  cursorY += 13;

  // Intro line: La M.T.K. envisage d'acheter :
  const introSafe = pdfSafeText(content.introLine);
  if (introSafe.includes('M.T.K.')) {
    const idx = introSafe.indexOf('M.T.K.');
    const before = introSafe.slice(0, idx);
    const after = introSafe.slice(idx + 'M.T.K.'.length);
    doc.setFont('times', 'italic');
    doc.text(before, marginX, cursorY);
    let curX = marginX + doc.getTextWidth(before);
    doc.setFont('times', 'bolditalic');
    doc.text('M.T.K.', curX, cursorY);
    curX += doc.getTextWidth('M.T.K.');
    doc.setFont('times', 'italic');
    doc.text(after, curX, cursorY);
  } else {
    doc.setFont('times', 'italic');
    doc.text(introSafe, marginX, cursorY);
  }
  cursorY += 9;

  // Bullet 1: Montant en devise
  const bulletX = marginX + 9;
  doc.setFont('times', 'italic');
  const b1Prefix = `-   ${pdfSafeText(content.amountBulletLabel)}  `;
  doc.text(b1Prefix, bulletX, cursorY);
  doc.setFont('times', 'bolditalic');
  doc.text(pdfSafeText(content.amountBulletValue), bulletX + doc.getTextWidth(b1Prefix), cursorY);
  cursorY += 8;

  // Bullet 2: Date d'opération
  doc.setFont('times', 'italic');
  doc.text(
    `-   ${pdfSafeText(content.operationDateBulletLabel)}  ${pdfSafeText(
      content.operationDateBulletValue
    )}`,
    bulletX,
    cursorY
  );
  cursorY += 8;

  // Bullet 3: Date valeur
  doc.text(
    `-   ${pdfSafeText(content.valueDateBulletLabel)}  ${pdfSafeText(content.valueDateBulletValue)}`,
    bulletX,
    cursorY
  );
  cursorY += 10;

  // Paragraph 1
  if (content.isQuoteRequestCustom) {
    cursorY = renderMultilineItalicParagraph(
      doc,
      content.quoteRequestParagraph,
      marginX,
      cursorY,
      contentWidth,
      6.4
    );
  } else {
    cursorY = renderSegmentsParagraph(
      doc,
      [
        { text: 'A cet effet nous vous prions de nous communiquer par Email (' },
        { text: contactEmail, bold: true, underline: true },
        {
          text:
            ") ou par fax, (en remplissant le tableau ci-après) votre meilleure cotation du jour de l'opération avant ",
        },
        { text: content.submissionTime, bold: true, underline: true },
        { text: ' (heure limite) aux numéros suivants :' },
      ],
      marginX,
      cursorY,
      contentWidth,
      6.4
    );
  }

  cursorY += 5.5;

  // Centered Fax numbers
  if (faxNumbers.trim()) {
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(12);
    doc.text(faxNumbers, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 9.5;
  }

  // Paragraph 2
  if (content.isValidityCustom) {
    cursorY = renderMultilineItalicParagraph(
      doc,
      content.validityParagraph,
      marginX,
      cursorY,
      contentWidth,
      6.4
    );
  } else {
    cursorY = renderSegmentsParagraph(
      doc,
      [
        { text: "Votre cotation demeure valable jusqu'à " },
        { text: content.validityTime, bold: true, underline: true },
        {
          text:
            ", heure limite de confirmation de l'achat par la M.T.K. par téléphone en attendant l'expédition du fax de confirmation.",
        },
      ],
      marginX,
      cursorY,
      contentWidth,
      6.4
    );
  }

  cursorY += 8;

  // Salutations right-aligned
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text(pdfSafeText(content.closingSalutation), marginX + contentWidth - 10, cursorY, {
    align: 'right',
  });
  cursorY += 9;
  doc.setFont('times', 'bolditalic');
  doc.text(pdfSafeText(content.signatureLabel), marginX + contentWidth - 6, cursorY, {
    align: 'right',
  });

  // --- BOTTOM SECTION: A REMPLIR PAR LA BANQUE ---
  const footerLineY = Math.max(230, cursorY + 8);
  doc.setFillColor(0, 0, 0);
  doc.rect(marginX, footerLineY, contentWidth, 1.2, 'F');

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(pdfSafeText(content.bankTableTitle), pageWidth / 2, footerLineY + 7.2, {
    align: 'center',
  });

  // Table: Banque | Montant | Cours
  const tableX = marginX;
  const tableY = footerLineY + 11;
  const colW = contentWidth / 3;
  const headerH = 6.5;
  const rowH = 6.5;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
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

  // Bottom footer row: left traceability info + bottom-right QR Code
  const qrSize = 23;
  let qrY = Math.max(tableY + headerH + rowH * 2 + 2.5, 263);
  if (qrY + qrSize + 4 > 294) {
    doc.addPage();
    qrY = 20;
  }
  const qrX = marginX + contentWidth - qrSize;
  const leftTextMaxW = contentWidth - qrSize - 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 55, 55);
  const traceLines = doc.splitTextToSize(
    pdfSafeText(content.footerTraceability),
    leftTextMaxW
  ) as string[];
  let traceY = qrY + 5;
  for (const line of traceLines.slice(0, 3)) {
    doc.text(line, marginX, traceY);
    traceY += 3.6;
  }
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'QR : Ref. ordre, facture, type de paiement & detail montant',
    marginX,
    traceY + 1.5
  );

  const qrPayload = buildConsultationQrPayload(consultation, orders, invoices);
  renderQrCodeToJsPdf(doc, qrPayload, qrX, qrY, qrSize, 'Verification QR');

  return doc;
}

export function downloadConsultationPdf(
  consultation: CurrencyConsultation,
  overrides?: ConsultationPdfTextOverrides,
  orders: PaymentOrder[] = [],
  invoices: Invoice[] = []
): void {
  const doc = buildConsultationPdfDocument(consultation, overrides, orders, invoices);
  doc.save(`Consultation_Achat_Devise_${consultation.consultationNumber}.pdf`);
}
