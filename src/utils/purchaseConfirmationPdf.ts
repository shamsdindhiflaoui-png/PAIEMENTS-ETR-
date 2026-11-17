import { jsPDF } from 'jspdf';
import {
  Bank,
  BankConfirmationContact,
  CurrencyConsultation,
  OrderTransferType,
  PaymentOrder,
  PurchaseConfirmationLetter,
  PurchaseConfirmationOrderLine,
} from '../types/payment';
import { formatConsultationAmount, formatConsultationDate } from './consultationPdf';

export const ALL_ORDER_TRANSFER_TYPES: OrderTransferType[] = ['LC', 'VIREMENT', 'REMISE', 'AUTRE'];

export const ORDER_TRANSFER_TYPE_SHORT_LABELS: Record<OrderTransferType, string> = {
  LC: 'LC',
  VIREMENT: 'VIR',
  REMISE: 'REMISE',
  AUTRE: 'AUTRE',
};

export function normalizeOrderTypes(orderTypes?: OrderTransferType[]): OrderTransferType[] | undefined {
  if (!Array.isArray(orderTypes) || orderTypes.length === 0) {
    return undefined;
  }
  const set = new Set<OrderTransferType>();
  for (const t of orderTypes) {
    if (ALL_ORDER_TRANSFER_TYPES.includes(t)) {
      set.add(t);
    }
  }
  if (set.size === 0) return undefined;
  const ordered = ALL_ORDER_TRANSFER_TYPES.filter(t => set.has(t));
  return ordered;
}

export function formatContactOrderTypesTag(orderTypes?: OrderTransferType[]): string {
  const normalized = normalizeOrderTypes(orderTypes);
  if (!normalized || normalized.length === ALL_ORDER_TRANSFER_TYPES.length) {
    return 'LC / VIR / REMISE / AUTRE';
  }
  return normalized.map(t => ORDER_TRANSFER_TYPE_SHORT_LABELS[t]).join(' / ');
}

export function doesContactMatchOrderTypes(
  contact: BankConfirmationContact,
  lineOrderTypes: OrderTransferType[]
): boolean {
  const allowed = normalizeOrderTypes(contact.orderTypes);
  if (!allowed || allowed.length === ALL_ORDER_TRANSFER_TYPES.length) {
    return true;
  }
  if (lineOrderTypes.length === 0) return true;
  return lineOrderTypes.some(t => allowed.includes(t));
}

export interface BankDeskDefaults {
  tradingDeskName: string;
  tradingDeskAddress: string;
  tradingDeskFax: string;
  tradingDeskPhone?: string;
  contactEmails: string[];
  confirmationContacts: BankConfirmationContact[];
  shortDisplayCode: string;
}

function mergeOrderTypes(
  existing?: OrderTransferType[],
  incoming?: OrderTransferType[]
): OrderTransferType[] | undefined {
  const a = normalizeOrderTypes(existing);
  const b = normalizeOrderTypes(incoming);
  if (!a || !b) return undefined;
  if (a.length === ALL_ORDER_TRANSFER_TYPES.length || b.length === ALL_ORDER_TRANSFER_TYPES.length) {
    return [...ALL_ORDER_TRANSFER_TYPES];
  }
  const union = new Set<OrderTransferType>([...a, ...b]);
  return ALL_ORDER_TRANSFER_TYPES.filter(t => union.has(t));
}

export function normalizeBankConfirmationContacts(
  contacts?: BankConfirmationContact[],
  emails?: string[]
): BankConfirmationContact[] {
  const result: BankConfirmationContact[] = [];
  const indexByEmail = new Map<string, number>();

  if (Array.isArray(contacts)) {
    for (const c of contacts) {
      const email = (c?.email || '').trim();
      if (!email) continue;
      const key = email.toLowerCase();
      const normalizedTypes = normalizeOrderTypes(c.orderTypes);
      const existingIdx = indexByEmail.get(key);
      if (existingIdx !== undefined) {
        const prev = result[existingIdx];
        const mergedTypes = mergeOrderTypes(prev.orderTypes, normalizedTypes);
        const updated: BankConfirmationContact = {
          ...prev,
          name: prev.name || (c.name || '').trim(),
          role: prev.role || (c.role ? c.role.trim() : undefined),
        };
        if (mergedTypes) {
          updated.orderTypes = mergedTypes;
        } else {
          delete updated.orderTypes;
        }
        result[existingIdx] = updated;
        continue;
      }
      indexByEmail.set(key, result.length);
      result.push({
        id: c.id,
        name: (c.name || '').trim(),
        role: c.role ? c.role.trim() : undefined,
        email,
        ...(normalizedTypes ? { orderTypes: normalizedTypes } : {}),
      });
    }
  }

  if (Array.isArray(emails)) {
    for (const rawEmail of emails) {
      const email = (rawEmail || '').trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (indexByEmail.has(key)) continue;
      indexByEmail.set(key, result.length);
      result.push({ name: '', email });
    }
  }

  return result;
}

const DEFAULT_DESK_BY_CODE: Record<string, BankDeskDefaults> = {
  BNA: {
    tradingDeskName: 'BNA SALLE DE CHANGE',
    tradingDeskAddress: 'BNA SALLE DE CHANGE',
    tradingDeskFax: '70.257.362',
    contactEmails: ['WASSIM.ATTIA@bna.tn', 'SANA.CHEFFAI@bna.tn', 'Agence.Kairouan@bna.tn'],
    confirmationContacts: [
      { name: 'Wassim Attia', role: 'Salle de change', email: 'WASSIM.ATTIA@bna.tn' },
      { name: 'Sana Cheffai', role: 'Salle de change', email: 'SANA.CHEFFAI@bna.tn' },
      { name: 'Agence Kairouan', role: 'Domiciliation', email: 'Agence.Kairouan@bna.tn' },
    ],
    shortDisplayCode: 'BNA',
  },
  BIAT: {
    tradingDeskName: 'BIAT (Salle de change)',
    tradingDeskAddress: 'Markets.Sales@biat.com.tn',
    tradingDeskFax: '71.340.958 / 71.344.524',
    tradingDeskPhone: '71.336.472',
    contactEmails: ['Markets.Sales@biat.com.tn', 'Agence.Kairouan@biat.tn'],
    confirmationContacts: [
      { name: 'Markets & Sales', role: 'Salle de change', email: 'Markets.Sales@biat.com.tn' },
      { name: 'Agence Kairouan', role: 'Domiciliation', email: 'Agence.Kairouan@biat.tn' },
    ],
    shortDisplayCode: 'BIAT',
  },
  AMEN: {
    tradingDeskName: 'AB SALLE DE MARCHE',
    tradingDeskAddress: 'AB SALLE DE MARCHE',
    tradingDeskFax: '71.831.122 / 71.835.402',
    contactEmails: ['imen.baklouti@amenbank.com.tn', 'mohamedamine.essid@amenbank.com.tn'],
    confirmationContacts: [
      { name: 'Imen Baklouti', role: 'Salle de marché', email: 'imen.baklouti@amenbank.com.tn' },
      { name: 'Mohamed Amine Essid', role: 'Salle de marché', email: 'mohamedamine.essid@amenbank.com.tn' },
    ],
    shortDisplayCode: 'AB',
  },
  STB: {
    tradingDeskName: 'STB SALLE DE CHANGE',
    tradingDeskAddress: 'STB SALLE DE CHANGE',
    tradingDeskFax: '70.140.415',
    tradingDeskPhone: '70.140.000',
    contactEmails: ['salle.change@stb.com.tn', 'Agence.Kairouan@stb.com.tn'],
    confirmationContacts: [
      { name: 'Salle de Change STB', role: 'Salle des marchés', email: 'salle.change@stb.com.tn' },
      { name: 'Agence Kairouan République', role: 'Domiciliation', email: 'Agence.Kairouan@stb.com.tn' },
    ],
    shortDisplayCode: 'STB',
  },
  BH: {
    tradingDeskName: 'BH BANK SALLE DE MARCHE',
    tradingDeskAddress: 'BH BANK SALLE DE MARCHE',
    tradingDeskFax: '71.790.240',
    contactEmails: ['marches@bhbank.tn', 'Agence.Kairouan@bhbank.tn'],
    confirmationContacts: [
      { name: 'Salle des Marchés BH', role: 'Salle de marché', email: 'marches@bhbank.tn' },
      { name: 'Agence Kairouan Okba', role: 'Domiciliation', email: 'Agence.Kairouan@bhbank.tn' },
    ],
    shortDisplayCode: 'BH',
  },
  ATTIJARI: {
    tradingDeskName: 'ATTIJARI SALLE DES MARCHES',
    tradingDeskAddress: 'ATTIJARI SALLE DES MARCHES',
    tradingDeskFax: '71.111.300',
    contactEmails: ['salle.marches@attijaribank.com.tn', 'Agence.Kairouan@attijaribank.com.tn'],
    confirmationContacts: [
      { name: 'Salle des Marchés Attijari', role: 'Salle des marchés', email: 'salle.marches@attijaribank.com.tn' },
      { name: 'Agence Kairouan Mansoura', role: 'Domiciliation', email: 'Agence.Kairouan@attijaribank.com.tn' },
    ],
    shortDisplayCode: 'ATTIJARI',
  },
  UIB: {
    tradingDeskName: 'UIB SALLE DES MARCHES',
    tradingDeskAddress: 'UIB SALLE DES MARCHES',
    tradingDeskFax: '71.800.912',
    contactEmails: ['salle.marches@uib.com.tn', 'Agence.Kairouan@uib.com.tn'],
    confirmationContacts: [
      { name: 'Salle des Marchés UIB', role: 'Salle des marchés', email: 'salle.marches@uib.com.tn' },
      { name: 'Agence Kairouan Ville', role: 'Domiciliation', email: 'Agence.Kairouan@uib.com.tn' },
    ],
    shortDisplayCode: 'UIB',
  },
};

export function getBankDeskInfo(bank?: Bank, fallbackCode?: string, fallbackName?: string): BankDeskDefaults {
  const code = (bank?.code || fallbackCode || 'BQ').toUpperCase();
  const preset = DEFAULT_DESK_BY_CODE[code];
  const name = bank?.name || fallbackName || code;

  const customContacts = normalizeBankConfirmationContacts(
    bank?.confirmationContacts,
    bank?.contactEmails
  );
  const confirmationContacts =
    customContacts.length > 0
      ? customContacts
      : preset?.confirmationContacts || [
          { name: `Salle de change ${code}`, email: `salle.change@${code.toLowerCase()}.tn` },
        ];

  return {
    tradingDeskName: bank?.tradingDeskName || preset?.tradingDeskName || `${code} SALLE DE CHANGE`,
    tradingDeskAddress: bank?.tradingDeskAddress || preset?.tradingDeskAddress || `${code} SALLE DE CHANGE`,
    tradingDeskFax: bank?.tradingDeskFax || preset?.tradingDeskFax || '71.000.000',
    tradingDeskPhone: bank?.tradingDeskPhone || preset?.tradingDeskPhone,
    contactEmails: confirmationContacts.map(c => c.email),
    confirmationContacts,
    shortDisplayCode: preset?.shortDisplayCode || code || name,
  };
}

export function formatTndCounterValue(amount: number): string {
  const num = Number(amount) || 0;
  const fixed = num.toFixed(3);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formattedInt}.${decPart}`;
}

export function formatRate4(rate: number): string {
  return (Number(rate) || 0).toFixed(4);
}

export function computeDefaultValueDate(operationDate: string): string {
  const base = operationDate ? new Date(`${operationDate.split('T')[0]}T12:00:00Z`) : new Date();
  if (isNaN(base.getTime())) {
    return new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  }
  let added = 0;
  const d = new Date(base);
  while (added < 2) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return d.toISOString().split('T')[0];
}

export function generateNextConfirmationRef(existingConsultations: CurrencyConsultation[]): string {
  const year2 = String(new Date().getFullYear()).slice(-2);
  let maxSeq = 100;
  for (const c of existingConsultations) {
    if (c.confirmationRef) {
      const m = c.confirmationRef.match(/^(\d+)\//);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  }
  return `${maxSeq + 1}/${year2}`;
}

function formatFrenchArticleBank(code: string): string {
  const upper = code.toUpperCase();
  if (/^[AEIOUY]/i.test(upper)) {
    return `l'${upper}`;
  }
  return `la ${upper}`;
}

function joinFrenchBankList(codes: string[]): string {
  if (codes.length === 0) return '';
  if (codes.length === 1) return formatFrenchArticleBank(codes[0]);
  if (codes.length === 2) {
    return `${formatFrenchArticleBank(codes[0])} et ${formatFrenchArticleBank(codes[1])}`;
  }
  const head = codes.slice(0, -1).map(formatFrenchArticleBank).join(', ');
  return `${head} et ${formatFrenchArticleBank(codes[codes.length - 1])}`;
}

/**
 * Construit les lettres de confirmation d'achat de devises selon la règle métier MTK :
 * - Si toutes les banques de domiciliation des ordres = banque d'achat retenue : 1 seule confirmation (type 102-26).
 * - Sinon : 1 confirmation par banque de domiciliation != banque d'achat (instructions BCT)
 *   + 1 confirmation pour la banque d'achat (type 101-26).
 */
export function buildPurchaseConfirmations(
  consultation: CurrencyConsultation,
  orders: PaymentOrder[],
  banks: Bank[],
  overrides?: {
    selectedBankId?: string;
    selectedBankName?: string;
    negotiatedRate?: number;
    confirmationRef?: string;
    confirmationDate?: string;
    valueDate?: string;
  }
): PurchaseConfirmationLetter[] {
  const purchaseBankId = overrides?.selectedBankId || consultation.selectedBankId || '';
  const rate = Number(overrides?.negotiatedRate ?? consultation.negotiatedRate ?? 0);
  if (!purchaseBankId || rate <= 0) {
    return [];
  }

  const purchaseBank = banks.find(b => b.id === purchaseBankId);
  const purchaseDesk = getBankDeskInfo(
    purchaseBank,
    purchaseBank?.code || purchaseBankId,
    overrides?.selectedBankName || consultation.selectedBankName
  );
  const purchaseBankCode = purchaseDesk.shortDisplayCode;
  const purchaseBankName =
    purchaseBank?.name || overrides?.selectedBankName || consultation.selectedBankName || purchaseBankCode;

  const confirmationDate =
    overrides?.confirmationDate || consultation.confirmationDate || consultation.operationDate;
  const valueDate =
    overrides?.valueDate || consultation.valueDate || computeDefaultValueDate(confirmationDate);
  const confirmationRef = overrides?.confirmationRef || consultation.confirmationRef || '101/26';

  const consultationOrders = consultation.orderIds
    .map(oid => orders.find(o => o.id === oid))
    .filter((o): o is PaymentOrder => Boolean(o));

  if (consultationOrders.length === 0) {
    return [];
  }

  const orderLines: PurchaseConfirmationOrderLine[] = consultationOrders.map(order => {
    const domBank = banks.find(b => b.id === order.bankId);
    const domDesk = getBankDeskInfo(domBank, domBank?.code || order.bankId, order.bankName);
    const domBranch = order.bankBranch ? ` ${order.bankBranch}` : '';
    const domLabel = `${domDesk.shortDisplayCode}${domBranch}`.trim();
    const counterValueTnd = Number((order.amount * rate).toFixed(3));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.amount,
      currency: order.currency,
      rate,
      counterValueTnd,
      valueDate,
      transferType: order.transferType,
      lcNumber: order.lcNumber,
      domiciliaryBankId: order.bankId,
      domiciliaryBankCode: domDesk.shortDisplayCode,
      domiciliaryBankLabel: domLabel,
      beneficiaryName: order.beneficiaryName,
    };
  });

  // Grouper les ordres dont la banque de domiciliation != banque d'achat
  const otherDomMap = new Map<
    string,
    {
      bankId: string;
      bank?: Bank;
      desk: BankDeskDefaults;
      lines: PurchaseConfirmationOrderLine[];
      totalTnd: number;
    }
  >();

  for (const line of orderLines) {
    if (line.domiciliaryBankId !== purchaseBankId) {
      const existing = otherDomMap.get(line.domiciliaryBankId);
      if (existing) {
        existing.lines.push(line);
        existing.totalTnd = Number((existing.totalTnd + line.counterValueTnd).toFixed(3));
      } else {
        const domBank = banks.find(b => b.id === line.domiciliaryBankId);
        const desk = getBankDeskInfo(domBank, line.domiciliaryBankCode, line.domiciliaryBankLabel);
        otherDomMap.set(line.domiciliaryBankId, {
          bankId: line.domiciliaryBankId,
          bank: domBank,
          desk,
          lines: [line],
          totalTnd: line.counterValueTnd,
        });
      }
    }
  }

  const totalAllTnd = Number(
    orderLines.reduce((sum, l) => sum + l.counterValueTnd, 0).toFixed(3)
  );

  const allLineTypes: OrderTransferType[] = orderLines.map(l => l.transferType || 'VIREMENT');

  // CAS 1 : Banque de domiciliation == Banque d'achat pour tous les ordres (ex: 102-26.pdf)
  if (otherDomMap.size === 0) {
    const matchingContacts = purchaseDesk.confirmationContacts.filter(c =>
      doesContactMatchOrderTypes(c, allLineTypes)
    );
    return [
      {
        id: `${consultation.id}_same_${purchaseBankId}`,
        role: 'SAME_BANK_PURCHASE',
        title: `Confirmation unique · ${purchaseBankCode} (Domiciliation = Achat)`,
        recipientBankId: purchaseBankId,
        recipientBankCode: purchaseBankCode,
        recipientBankName: purchaseBankName,
        destLabel: purchaseDesk.tradingDeskName,
        addressLabel: purchaseDesk.tradingDeskAddress,
        faxLabel: purchaseDesk.tradingDeskFax,
        telLabel: purchaseDesk.tradingDeskPhone,
        confirmationDate,
        confirmationRef,
        valueDate,
        purchaseBankCode,
        purchaseBankName,
        lines: orderLines,
        totalCounterValueTnd: totalAllTnd,
        footerEmails: matchingContacts.map(c => c.email),
        footerContacts: matchingContacts,
      },
    ];
  }

  // CAS 2 : Banque(s) de domiciliation != Banque d'achat (ex: 101-26.pdf)
  const letters: PurchaseConfirmationLetter[] = [];
  const otherDomCodes: string[] = [];
  const allOtherDomContacts: BankConfirmationContact[] = [];
  let otherDomTotalTnd = 0;

  for (const group of otherDomMap.values()) {
    otherDomCodes.push(group.desk.shortDisplayCode);
    otherDomTotalTnd = Number((otherDomTotalTnd + group.totalTnd).toFixed(3));
    const groupLineTypes: OrderTransferType[] = group.lines.map(l => l.transferType || 'VIREMENT');
    const matchingGroupContacts = group.desk.confirmationContacts.filter(c =>
      doesContactMatchOrderTypes(c, groupLineTypes)
    );
    matchingGroupContacts.forEach(c => {
      allOtherDomContacts.push(c);
    });

    letters.push({
      id: `${consultation.id}_dom_${group.bankId}`,
      role: 'DOMICILIARY_BANK',
      title: `Banque de domiciliation · ${group.desk.shortDisplayCode}`,
      recipientBankId: group.bankId,
      recipientBankCode: group.desk.shortDisplayCode,
      recipientBankName: group.bank?.name || group.desk.shortDisplayCode,
      destLabel: group.desk.tradingDeskName,
      addressLabel: group.desk.tradingDeskAddress,
      faxLabel: group.desk.tradingDeskFax,
      telLabel: group.desk.tradingDeskPhone,
      confirmationDate,
      confirmationRef,
      valueDate,
      purchaseBankCode,
      purchaseBankName,
      lines: group.lines,
      totalCounterValueTnd: group.totalTnd,
      footerEmails: matchingGroupContacts.map(c => c.email),
      footerContacts: matchingGroupContacts,
    });
  }

  // Lettre à la banque d'achat (récapitulant tous les ordres + instruction BCT sur les autres banques)
  const matchingPurchaseContacts = purchaseDesk.confirmationContacts.filter(c =>
    doesContactMatchOrderTypes(c, allLineTypes)
  );
  const purchaseFooterContacts = normalizeBankConfirmationContacts([
    ...matchingPurchaseContacts,
    ...allOtherDomContacts,
  ]);
  const purchaseFooterEmails = purchaseFooterContacts.map(c => c.email);

  letters.push({
    id: `${consultation.id}_purchase_${purchaseBankId}`,
    role: 'PURCHASE_BANK',
    title: `Banque d’achat retenue · ${purchaseBankCode}`,
    recipientBankId: purchaseBankId,
    recipientBankCode: purchaseBankCode,
    recipientBankName: purchaseBankName,
    destLabel: purchaseDesk.tradingDeskName,
    addressLabel: purchaseDesk.tradingDeskAddress,
    faxLabel: purchaseDesk.tradingDeskFax,
    telLabel: purchaseDesk.tradingDeskPhone,
    confirmationDate,
    confirmationRef,
    valueDate,
    purchaseBankCode,
    purchaseBankName,
    lines: orderLines,
    totalCounterValueTnd: totalAllTnd,
    otherDomiciliaryBankLabels: otherDomCodes,
    bctTransferCounterValueTnd: otherDomTotalTnd,
    footerEmails: purchaseFooterEmails,
    footerContacts: purchaseFooterContacts,
  });

  return letters;
}

export interface RichSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
  color?: [number, number, number];
}

export function buildOrderBulletSegments(line: PurchaseConfirmationOrderLine): RichSegment[] {
  const formattedAmt = formatConsultationAmount(line.amount, line.currency);
  const formattedRate = formatRate4(line.rate);
  const formattedTnd = formatTndCounterValue(line.counterValueTnd);
  const formattedValDate = formatConsultationDate(line.valueDate);

  const refSegments: RichSegment[] =
    line.transferType === 'LC' && line.lcNumber
      ? [
          { text: 'et ce pour le paiement de la lettre de crédit N° : ' },
          { text: line.lcNumber, bold: true, underline: true },
        ]
      : line.transferType === 'REMISE' && line.lcNumber
      ? [
          { text: 'et ce pour le paiement de la remise N° : ' },
          { text: line.lcNumber, bold: true, underline: true },
        ]
      : [
          { text: `et ce pour le paiement de l'ordre de règlement ` },
          { text: line.orderNumber, bold: true, underline: true },
        ];

  const cleanBeneficiary = (line.beneficiaryName || '').trim();
  const beneficiaryWithPeriod = cleanBeneficiary.endsWith('.')
    ? cleanBeneficiary
    : `${cleanBeneficiary}.`;

  return [
    { text: formattedAmt, bold: true, underline: true },
    { text: ' au cours de ' },
    { text: formattedRate, bold: true, underline: true },
    { text: ' soit la contrevaleur ' },
    { text: `TND ${formattedTnd} `, bold: true, underline: true },
    { text: 'valeur ' },
    { text: formattedValDate, bold: true, underline: true },
    { text: ' ' },
    ...refSegments,
    { text: ' domicilié auprès de ' },
    { text: line.domiciliaryBankLabel, bold: true, underline: true },
    { text: ' en faveur de ' },
    { text: beneficiaryWithPeriod, bold: true, underline: true },
  ];
}

export function buildLetterIntroSegments(letter: PurchaseConfirmationLetter): RichSegment[] {
  if (letter.role === 'DOMICILIARY_BANK') {
    return [
      { text: 'Nous avons instruit ' },
      { text: formatFrenchArticleBank(letter.purchaseBankCode).split(' ')[0] + ' ' },
      { text: letter.purchaseBankCode, bold: true, underline: true },
      { text: ' pour vous virer chez la ' },
      { text: 'BCT', bold: true, underline: true },
      { text: ' la somme de :' },
    ];
  }
  return [{ text: "Suite à notre consultation de ce jour, nous vous confirmons l'achat de :" }];
}

export function buildLetterClosingSegments(letter: PurchaseConfirmationLetter): RichSegment[] | null {
  if (letter.role === 'SAME_BANK_PURCHASE') {
    return null;
  }

  if (letter.role === 'DOMICILIARY_BANK') {
    const formattedTnd = formatTndCounterValue(letter.totalCounterValueTnd);
    return [
      { text: 'En retour, veuillez créditer le compte de ' },
      { text: `${formatFrenchArticleBank(letter.purchaseBankCode).split(' ')[0]} ` },
      { text: letter.purchaseBankCode, bold: true, underline: true },
      { text: ' pour vous virer la contrevaleur de cet achat soit ' },
      { text: `TND ${formattedTnd}`, bold: true, underline: true },
      { text: ' chez la ' },
      { text: 'BCT.', bold: true, underline: true },
    ];
  }

  if (
    letter.role === 'PURCHASE_BANK' &&
    letter.otherDomiciliaryBankLabels &&
    letter.otherDomiciliaryBankLabels.length > 0
  ) {
    const banksListStr = joinFrenchBankList(letter.otherDomiciliaryBankLabels);
    const formattedTnd = formatTndCounterValue(
      letter.bctTransferCounterValueTnd ?? letter.totalCounterValueTnd
    );
    return [
      { text: 'En retour, nous avons instruit ' },
      { text: banksListStr, bold: true, underline: true },
      { text: ' pour vous virer la contrevaleur de cet achat soit ' },
      { text: `TND ${formattedTnd}`, bold: true, underline: true },
      { text: ' chez la ' },
      { text: 'BCT.', bold: true, underline: true },
    ];
  }

  return null;
}

function pdfSafeText(str: string): string {
  return (str || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ');
}

function renderRichParagraph(
  doc: jsPDF,
  segments: RichSegment[],
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  fontSize = 11.5
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
    doc.setFont('times', seg.bold ? 'bolditalic' : 'italic');
    doc.setFontSize(fontSize);
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
      doc.setFontSize(fontSize);
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
        doc.setLineWidth(0.32);
        doc.line(x, y + 0.85, x + tok.width, y + 0.85);
      }
      x += tok.width;
    }
    y += lineHeight;
  }

  doc.setTextColor(15, 15, 15);
  return y;
}

function renderSingleConfirmationPage(doc: jsPDF, letter: PurchaseConfirmationLetter): void {
  const pageWidth = 210;
  const marginX = 28;
  const contentWidth = pageWidth - marginX * 2; // 154 mm

  // 1. Top Pale-Yellow MTK Letterhead Box (Matches 102-26.pdf & 101-26.pdf)
  const headerX = marginX + 4;
  const headerW = contentWidth - 8;
  const headerY = 14;
  const headerH = 31;

  doc.setFillColor(246, 246, 246);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(headerX, headerY, headerW, headerH, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(11.5);
  doc.text('MANUFACTURE DES TABACS DE KAIROUAN', pageWidth / 2, headerY + 5.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text('B.P. 106 - 3100 KAIROUAN - TUNISIE', pageWidth / 2, headerY + 10.2, { align: 'center' });
  doc.text('R.C. N° : B4141995', pageWidth / 2, headerY + 14.8, { align: 'center' });
  doc.text('TEL : (77) 281.309 - (77) 282.824  - FAX : (77) 283.130', pageWidth / 2, headerY + 19.4, {
    align: 'center',
  });

  // Email centered & underlined
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(10.5);
  const emailLabel = 'Email : mtk.tn@mtk.tn';
  const emailW = doc.getTextWidth(emailLabel);
  const emailX = pageWidth / 2 - emailW / 2;
  doc.text(emailLabel, emailX, headerY + 26.5);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(emailX + doc.getTextWidth('Email : '), headerY + 27.2, emailX + emailW, headerY + 27.2);

  // 2. 4-Column Metadata Grid Table (DEST, ADRESSE, DATE | FAX, TEL, Réf)
  const tableY = headerY + headerH + 4.5;
  const rowH = 6.8;
  const c1W = 28;
  const c2W = 68;
  const c3W = 16;
  const c4W = contentWidth - c1W - c2W - c3W;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginX, tableY, contentWidth, rowH * 3);
  doc.line(marginX, tableY + rowH, marginX + contentWidth, tableY + rowH);
  doc.line(marginX, tableY + rowH * 2, marginX + contentWidth, tableY + rowH * 2);
  doc.line(marginX + c1W, tableY, marginX + c1W, tableY + rowH * 3);
  doc.line(marginX + c1W + c2W, tableY, marginX + c1W + c2W, tableY + rowH * 3);
  doc.line(marginX + c1W + c2W + c3W, tableY, marginX + c1W + c2W + c3W, tableY + rowH * 3);

  doc.setFontSize(10.5);
  doc.setFont('times', 'bolditalic');
  doc.setTextColor(0, 0, 0);
  doc.text('DEST :', marginX + 2, tableY + 4.8);
  doc.text('ADRESSE :', marginX + 2, tableY + rowH + 4.8);
  doc.text('DATE :', marginX + 2, tableY + rowH * 2 + 4.8);

  doc.text(pdfSafeText(letter.destLabel), marginX + c1W + 2, tableY + 4.8);
  doc.text(pdfSafeText(letter.addressLabel), marginX + c1W + 2, tableY + rowH + 4.8);
  doc.text(pdfSafeText(formatConsultationDate(letter.confirmationDate)), marginX + c1W + 2, tableY + rowH * 2 + 4.8);

  doc.text('FAX :', marginX + c1W + c2W + 2, tableY + 4.8);
  doc.text(letter.telLabel ? 'TEL :' : '', marginX + c1W + c2W + 2, tableY + rowH + 4.8);
  doc.text('Réf :', marginX + c1W + c2W + 2, tableY + rowH * 2 + 4.8);

  doc.text(pdfSafeText(letter.faxLabel), marginX + c1W + c2W + c3W + 2, tableY + 4.8);
  if (letter.telLabel) {
    doc.text(pdfSafeText(letter.telLabel), marginX + c1W + c2W + c3W + 2, tableY + rowH + 4.8);
  }
  doc.text(pdfSafeText(letter.confirmationRef), marginX + c1W + c2W + c3W + 2, tableY + rowH * 2 + 4.8);

  // 3. Second Expediteur Box
  const expY = tableY + rowH * 3 + 4;
  const expH = 10.5;
  doc.setFillColor(246, 246, 246);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(marginX + 4, expY, contentWidth - 8, expH, 'FD');

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('EXPEDITEUR : DIRECTION FINANCIERE', pageWidth / 2, expY + 4.2, { align: 'center' });
  doc.text(
    "N.B. : En cas d'illisibilité du message, Veuillez nous contacter au (77) 281.309",
    pageWidth / 2,
    expY + 8.4,
    { align: 'center' }
  );

  // 4. TEXTE heading
  let cursorY = expY + expH + 10;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.text('TEXTE', pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 9;

  // 5. Intro sentence
  cursorY = renderRichParagraph(
    doc,
    buildLetterIntroSegments(letter),
    marginX,
    cursorY,
    contentWidth,
    6,
    11.5
  );
  cursorY += 4;

  // 6. Order bullets
  for (const line of letter.lines) {
    doc.setFont('times', 'italic');
    doc.setFontSize(11.5);
    doc.text('-', marginX + 4, cursorY);
    cursorY = renderRichParagraph(
      doc,
      buildOrderBulletSegments(line),
      marginX + 10,
      cursorY,
      contentWidth - 10,
      5.8,
      11.5
    );
    cursorY += 3;
  }

  // 7. Closing BCT instruction (when applicable)
  const closingSegments = buildLetterClosingSegments(letter);
  if (closingSegments) {
    cursorY += 1;
    cursorY = renderRichParagraph(
      doc,
      closingSegments,
      marginX,
      cursorY,
      contentWidth,
      6,
      11.5
    );
  }

  // 8. Signature right-aligned
  cursorY += 10;
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.text('LA DIRECTION FINANCIERE', marginX + contentWidth, cursorY, { align: 'right' });

  // 9. Footer concerned persons & contact emails bottom-left (blue underlined)
  const footerContacts: BankConfirmationContact[] =
    letter.footerContacts && letter.footerContacts.length > 0
      ? letter.footerContacts
      : letter.footerEmails.map(email => ({ name: '', email }));
  const lineStep = footerContacts.length > 5 ? 5.2 : 6.0;
  let emailY = Math.max(cursorY + 20, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  for (const contact of footerContacts.slice(0, 7)) {
    if (emailY > 284) break;
    const cleanEm = pdfSafeText(contact.email);
    const typeTag = `[${formatContactOrderTypesTag(contact.orderTypes)}] `;
    let personPrefix = '';
    if (contact.name) {
      personPrefix = contact.role
        ? `${pdfSafeText(contact.name)} (${pdfSafeText(contact.role)}) : `
        : `${pdfSafeText(contact.name)} : `;
    }
    let cursorX = marginX;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(typeTag, cursorX, emailY);
    cursorX += doc.getTextWidth(typeTag);

    if (personPrefix) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(35, 35, 35);
      doc.text(personPrefix, cursorX, emailY);
      cursorX += doc.getTextWidth(personPrefix);
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(cleanEm, cursorX, emailY);
    const w = doc.getTextWidth(cleanEm);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.line(cursorX, emailY + 0.7, cursorX + w, emailY + 0.7);
    emailY += lineStep;
  }
  doc.setTextColor(0, 0, 0);
}

export function buildPurchaseConfirmationPdfDocument(letters: PurchaseConfirmationLetter[]): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  letters.forEach((letter, idx) => {
    if (idx > 0) {
      doc.addPage();
    }
    renderSingleConfirmationPage(doc, letter);
  });

  return doc;
}

export function downloadPurchaseConfirmationPdf(
  letters: PurchaseConfirmationLetter[],
  fileTag?: string
): void {
  if (letters.length === 0) return;
  const doc = buildPurchaseConfirmationPdfDocument(letters);
  const safeRef = (fileTag || letters[0].confirmationRef || 'Confirmation')
    .replace(/[/\\:*?"<>|]/g, '-');
  doc.save(`Confirmation_Achat_${safeRef}.pdf`);
}
