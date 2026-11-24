import {
  Invoice,
  InvoiceDocumentBasis,
  InvoiceDocumentType,
  InvoicePaymentStatus,
  OrderDeduction,
  OrderDeductionCategory,
  OrderTransferType,
  PaymentOrder,
} from '../types/payment';

export const DEDUCTION_CATEGORY_META: Record<
  OrderDeductionCategory,
  { label: string; shortLabel: string; placeholderRef: string }
> = {
  FRAIS_ENREGISTREMENT: {
    label: "Frais d'enregistrement",
    shortLabel: 'Enregistrement',
    placeholderRef: 'Ex : Quittance Enreg. N° ...',
  },
  RETENUE_SOURCE: {
    label: 'Retenue à la source (RAS)',
    shortLabel: 'Retenue RAS',
    placeholderRef: 'Ex : Certificat RAS N° ...',
  },
  PENALITE_RETARD: {
    label: 'Pénalité de retard / Non-conformité',
    shortLabel: 'Pénalité',
    placeholderRef: 'Ex : PV Pénalité N° ...',
  },
  AVOIR_REMISE: {
    label: 'Avoir / Rabais / Escompte',
    shortLabel: 'Avoir / Remise',
    placeholderRef: 'Ex : Note de crédit / Avoir N° ...',
  },
  FRAIS_BANCAIRES: {
    label: 'Frais bancaires à charge fournisseur',
    shortLabel: 'Frais bancaires',
    placeholderRef: 'Ex : Avis frais N° ...',
  },
  DROITS_TIMBRE: {
    label: 'Droits de timbre / Taxes',
    shortLabel: 'Timbre / Taxes',
    placeholderRef: 'Ex : Bordereau timbre N° ...',
  },
  AUTRE_DEDUCTION: {
    label: 'Autre déduction',
    shortLabel: 'Autre déduction',
    placeholderRef: 'Ex : Référence justificative',
  },
};

export interface InvoicePaymentSummary {
  linkedOrders: PaymentOrder[];
  allocatedAmount: number; // Montant brut imputé sur la facture (net + déductions)
  netOrderedAmount: number; // Somme des montants nets à transférer
  deductionsTotal: number; // Somme des déductions appliquées
  executedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  paymentStatus: InvoicePaymentStatus;
}

export function getInvoiceProformaRef(
  invoice?: Pick<Invoice, 'proformaNumber' | 'proformaDate'> | null
): { number: string; date?: string } | null {
  const num = (invoice?.proformaNumber || '').trim();
  if (!num) return null;
  return {
    number: num,
    date: (invoice?.proformaDate || '').trim() || undefined,
  };
}

export function getInvoiceDefinitiveRef(
  invoice?: Pick<
    Invoice,
    'invoiceNumber' | 'invoiceDate' | 'proformaNumber' | 'definitiveInvoiceNumber' | 'definitiveInvoiceDate'
  > | null
): { number: string; date?: string } | null {
  if (!invoice) return null;
  const defNum = (invoice.definitiveInvoiceNumber || '').trim();
  if (defNum) {
    return {
      number: defNum,
      date: (invoice.definitiveInvoiceDate || invoice.invoiceDate || '').trim() || undefined,
    };
  }
  if (!(invoice.proformaNumber || '').trim()) {
    const num = (invoice.invoiceNumber || '').trim();
    if (!num) return null;
    return {
      number: num,
      date: (invoice.invoiceDate || '').trim() || undefined,
    };
  }
  return null;
}

export function getInvoiceDocumentType(
  invoice?: Pick<
    Invoice,
    'documentType' | 'invoiceNumber' | 'proformaNumber' | 'definitiveInvoiceNumber'
  > | null
): InvoiceDocumentType {
  if (!invoice) return 'FACTURE';
  const profRef = (invoice.proformaNumber || '').trim();
  const defRef = (invoice.definitiveInvoiceNumber || '').trim();
  if (profRef && !defRef) {
    return 'PROFORMA';
  }
  if (defRef) {
    return 'FACTURE';
  }
  return invoice.documentType === 'PROFORMA' ? 'PROFORMA' : 'FACTURE';
}

export function isProformaConverted(
  invoice?: Pick<Invoice, 'proformaNumber' | 'definitiveInvoiceNumber'> | null
): boolean {
  if (!invoice) return false;
  return Boolean(
    (invoice.proformaNumber || '').trim() &&
      (invoice.definitiveInvoiceNumber || '').trim()
  );
}

export function doesInvoiceRequireConversion(
  invoice?: Pick<
    Invoice,
    'documentType' | 'invoiceNumber' | 'proformaNumber' | 'definitiveInvoiceNumber'
  > | null,
  linkedOrdersCount: number = 0
): boolean {
  return getInvoiceDocumentType(invoice) === 'PROFORMA' && linkedOrdersCount >= 1;
}

export function getInvoiceAllReferenceNumbers(
  invoice?: Pick<Invoice, 'invoiceNumber' | 'proformaNumber' | 'definitiveInvoiceNumber'> | null
): string[] {
  if (!invoice) return [];
  const refs = [
    invoice.invoiceNumber,
    invoice.proformaNumber,
    invoice.definitiveInvoiceNumber,
  ]
    .map(v => (v || '').trim())
    .filter(Boolean);
  return Array.from(new Set(refs));
}

export function findReferenceConflict(
  candidateRefs: string[],
  existingInvoices: Invoice[],
  excludeInvoiceId?: string
): { conflictRef: string; existingInvoice: Invoice } | null {
  const normalizedCandidates = candidateRefs
    .map(r => r.trim())
    .filter(Boolean);
  if (normalizedCandidates.length === 0) return null;

  for (const existing of existingInvoices) {
    if (excludeInvoiceId && existing.id === excludeInvoiceId) continue;
    const existingRefs = getInvoiceAllReferenceNumbers(existing).map(r => r.toLowerCase());
    for (const candidate of normalizedCandidates) {
      if (existingRefs.includes(candidate.toLowerCase())) {
        return { conflictRef: candidate, existingInvoice: existing };
      }
    }
  }
  return null;
}

export function getSuggestedNextTranche(
  invoice: Invoice,
  summary: InvoicePaymentSummary
): {
  documentType: InvoiceDocumentType;
  requiresConversionToInvoice: boolean;
  transferType: OrderTransferType;
  documentBasis: InvoiceDocumentBasis;
  paymentMode: 'FULL' | 'PARTIAL';
  suggestedGrossAmount: number;
  label: string;
} {
  const docType = getInvoiceDocumentType(invoice);
  const requiresConversionToInvoice = doesInvoiceRequireConversion(
    invoice,
    summary.linkedOrders.length
  );

  if (docType === 'PROFORMA') {
    if (summary.linkedOrders.length === 0) {
      return {
        documentType: 'PROFORMA',
        requiresConversionToInvoice: false,
        transferType: 'LC',
        documentBasis: 'PROFORMA',
        paymentMode: 'FULL',
        suggestedGrossAmount: summary.remainingAmount,
        label: 'Dossier Proforma : 1er ordre (LC ou 1re tranche sur Proforma)',
      };
    }

    return {
      documentType: 'PROFORMA',
      requiresConversionToInvoice: true,
      transferType: 'VIREMENT',
      documentBasis: 'FACTURE_DEFINITIVE',
      paymentMode: 'FULL',
      suggestedGrossAmount: summary.remainingAmount,
      label:
        '1er ordre déjà saisi : convertir la Proforma en Facture avec une nouvelle référence',
    };
  }

  return {
    documentType: 'FACTURE',
    requiresConversionToInvoice: false,
    transferType: 'VIREMENT',
    documentBasis: 'FACTURE_DEFINITIVE',
    paymentMode: 'FULL',
    suggestedGrossAmount: summary.remainingAmount,
    label: isProformaConverted(invoice)
      ? 'Facture (convertie depuis Proforma)'
      : 'Règlement sur Facture',
  };
}

export function resolveOrderDocumentSnapshot(params: {
  invoice?: Invoice;
  documentBasis?: InvoiceDocumentBasis;
  explicitInvoiceNumber?: string;
  explicitInvoiceDate?: string;
  inlineDefinitiveNumber?: string;
  inlineDefinitiveDate?: string;
  existingInvoices?: Invoice[];
  existingLinkedOrdersCount?: number;
}): {
  valid: boolean;
  error?: string;
  documentBasis: InvoiceDocumentBasis;
  invoiceNumber: string;
  invoiceDate: string;
  proformaNumber?: string;
  proformaDate?: string;
  invoiceDefinitiveAttach?: {
    definitiveInvoiceNumber: string;
    definitiveInvoiceDate: string;
  };
} {
  const {
    invoice,
    documentBasis,
    explicitInvoiceNumber,
    explicitInvoiceDate,
    inlineDefinitiveNumber,
    inlineDefinitiveDate,
    existingInvoices = [],
    existingLinkedOrdersCount = 0,
  } = params;
  const today = new Date().toISOString().split('T')[0];

  if (!invoice) {
    const basis: InvoiceDocumentBasis = documentBasis || 'FACTURE_DEFINITIVE';
    const invNum = (explicitInvoiceNumber || '').trim();
    const invDate = (explicitInvoiceDate || '').trim() || today;
    return {
      valid: true,
      documentBasis: basis,
      invoiceNumber: invNum,
      invoiceDate: invDate,
      proformaNumber: basis === 'PROFORMA' ? invNum || undefined : undefined,
      proformaDate: basis === 'PROFORMA' ? invDate : undefined,
    };
  }

  const profRef = getInvoiceProformaRef(invoice);
  const defRef = getInvoiceDefinitiveRef(invoice);
  const mustConvert = doesInvoiceRequireConversion(invoice, existingLinkedOrdersCount);
  const resolvedBasis: InvoiceDocumentBasis = mustConvert
    ? 'FACTURE_DEFINITIVE'
    : documentBasis ?? (profRef && !defRef ? 'PROFORMA' : 'FACTURE_DEFINITIVE');

  if (resolvedBasis === 'PROFORMA') {
    if (mustConvert) {
      return {
        valid: false,
        error: `Le premier ordre sur la Proforma ${profRef?.number || invoice.invoiceNumber} a déjà été saisi. Veuillez convertir la Proforma en Facture avec une nouvelle référence.`,
        documentBasis: 'FACTURE_DEFINITIVE',
        invoiceNumber: '',
        invoiceDate: today,
        proformaNumber: profRef?.number,
        proformaDate: profRef?.date,
      };
    }

    const profNum = profRef?.number || (explicitInvoiceNumber || '').trim();
    if (!profNum) {
      return {
        valid: false,
        error: 'Ce dossier ne comporte pas de référence Proforma.',
        documentBasis: 'PROFORMA',
        invoiceNumber: '',
        invoiceDate: today,
      };
    }
    const profDate = profRef?.date || (explicitInvoiceDate || '').trim() || invoice.invoiceDate;
    return {
      valid: true,
      documentBasis: 'PROFORMA',
      invoiceNumber: profNum,
      invoiceDate: profDate,
      proformaNumber: profNum,
      proformaDate: profDate,
    };
  }

  // resolvedBasis === 'FACTURE_DEFINITIVE'
  if (defRef?.number) {
    return {
      valid: true,
      documentBasis: 'FACTURE_DEFINITIVE',
      invoiceNumber: defRef.number,
      invoiceDate: defRef.date || invoice.invoiceDate,
      proformaNumber: profRef?.number,
      proformaDate: profRef?.date,
    };
  }

  // Converting Proforma -> Facture inline during order creation
  const trimmedInline = (inlineDefinitiveNumber || '').trim();
  const trimmedExplicit = (explicitInvoiceNumber || '').trim();
  const candidateDefNum =
    trimmedInline ||
    (trimmedExplicit &&
    trimmedExplicit.toLowerCase() !== (profRef?.number || '').toLowerCase()
      ? trimmedExplicit
      : '');

  if (
    profRef?.number &&
    trimmedInline &&
    trimmedInline.toLowerCase() === profRef.number.toLowerCase()
  ) {
    return {
      valid: false,
      error: `La nouvelle référence de Facture doit être différente de la référence Proforma (${profRef.number}).`,
      documentBasis: 'FACTURE_DEFINITIVE',
      invoiceNumber: trimmedInline,
      invoiceDate: today,
      proformaNumber: profRef.number,
      proformaDate: profRef.date,
    };
  }

  if (!candidateDefNum) {
    return {
      valid: false,
      error: mustConvert
        ? `Le 1er ordre sur la Proforma ${profRef?.number || invoice.invoiceNumber} a déjà été saisi : veuillez convertir la Proforma en Facture en saisissant une nouvelle référence.`
        : 'Veuillez saisir la nouvelle référence de Facture pour convertir la Proforma.',
      documentBasis: 'FACTURE_DEFINITIVE',
      invoiceNumber: '',
      invoiceDate: today,
      proformaNumber: profRef?.number,
      proformaDate: profRef?.date,
    };
  }

  const conflict = findReferenceConflict([candidateDefNum], existingInvoices, invoice.id);
  if (conflict) {
    return {
      valid: false,
      error: `Une autre fiche facture porte déjà la référence ${conflict.conflictRef}.`,
      documentBasis: 'FACTURE_DEFINITIVE',
      invoiceNumber: candidateDefNum,
      invoiceDate: today,
      proformaNumber: profRef?.number,
      proformaDate: profRef?.date,
    };
  }

  const candidateDefDate =
    (inlineDefinitiveDate || '').trim() ||
    (explicitInvoiceDate || '').trim() ||
    today;

  return {
    valid: true,
    documentBasis: 'FACTURE_DEFINITIVE',
    invoiceNumber: candidateDefNum,
    invoiceDate: candidateDefDate,
    proformaNumber: profRef?.number,
    proformaDate: profRef?.date,
    invoiceDefinitiveAttach: {
      definitiveInvoiceNumber: candidateDefNum,
      definitiveInvoiceDate: candidateDefDate,
    },
  };
}

export function normalizeOrderDeductions(
  deductions?: Array<Partial<OrderDeduction>>
): { items: OrderDeduction[]; total: number; error?: string } {
  if (!Array.isArray(deductions) || deductions.length === 0) {
    return { items: [], total: 0 };
  }

  const items: OrderDeduction[] = [];
  for (let i = 0; i < deductions.length; i += 1) {
    const raw = deductions[i];
    if (!raw) continue;
    const amt = Number(raw.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return {
        items: [],
        total: 0,
        error: 'Le montant de chaque déduction ou frais doit être un nombre positif.',
      };
    }
    const rounded = Number(amt.toFixed(2));
    if (rounded <= 0) {
      continue;
    }
    const category: OrderDeductionCategory =
      raw.category && raw.category in DEDUCTION_CATEGORY_META
        ? raw.category
        : 'AUTRE_DEDUCTION';
    const label = (raw.label || '').trim() || DEDUCTION_CATEGORY_META[category].label;
    const reference = (raw.reference || '').trim() || undefined;
    items.push({
      id: raw.id || `ded_${Date.now()}_${i}`,
      category,
      label,
      amount: rounded,
      reference,
    });
  }

  const total = Number(items.reduce((sum, d) => sum + d.amount, 0).toFixed(2));
  return { items, total };
}

export function getOrderDeductionsTotal(
  order: Pick<PaymentOrder, 'deductions' | 'deductionsTotal'>
): number {
  if (Array.isArray(order.deductions) && order.deductions.length > 0) {
    return Number(
      order.deductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0).toFixed(2)
    );
  }
  return Number((Number(order.deductionsTotal) || 0).toFixed(2));
}

export function getOrderInvoiceGrossAmount(
  order: Pick<PaymentOrder, 'amount' | 'grossAmount' | 'deductions' | 'deductionsTotal'>
): number {
  const deductionsTotal = getOrderDeductionsTotal(order);
  if (
    order.grossAmount !== undefined &&
    order.grossAmount !== null &&
    Number.isFinite(Number(order.grossAmount))
  ) {
    return Number(Number(order.grossAmount).toFixed(2));
  }
  return Number(((Number(order.amount) || 0) + deductionsTotal).toFixed(2));
}

export function doesOrderBelongToInvoice(order: PaymentOrder, invoice: Invoice): boolean {
  if (order.invoiceId) {
    return order.invoiceId === invoice.id;
  }
  const orderInv = (order.invoiceNumber || '').trim().toLowerCase();
  if (!orderInv) return false;
  const refs = getInvoiceAllReferenceNumbers(invoice).map(r => r.toLowerCase());
  return refs.includes(orderInv);
}

export function computeInvoicePaymentSummary(
  invoice: Invoice,
  orders: PaymentOrder[]
): InvoicePaymentSummary {
  const linkedOrders = orders.filter(
    o => o.status !== 'ANNULE' && doesOrderBelongToInvoice(o, invoice)
  );

  const allocatedAmount = Number(
    linkedOrders.reduce((sum, o) => sum + getOrderInvoiceGrossAmount(o), 0).toFixed(2)
  );
  const netOrderedAmount = Number(
    linkedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toFixed(2)
  );
  const deductionsTotal = Number(
    linkedOrders.reduce((sum, o) => sum + getOrderDeductionsTotal(o), 0).toFixed(2)
  );
  const executedAmount = Number(
    linkedOrders
      .filter(o => o.status === 'EXECUTE')
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
      .toFixed(2)
  );

  const totalAmount = Number(invoice.totalAmount) || 0;
  const remainingAmount = Math.max(0, Number((totalAmount - allocatedAmount).toFixed(2)));
  const progressPercent =
    totalAmount > 0 ? Math.min(100, Math.round((allocatedAmount / totalAmount) * 100)) : 0;

  let paymentStatus: InvoicePaymentStatus = 'NON_PAYEE';
  if (allocatedAmount > 0.005) {
    paymentStatus = remainingAmount <= 0.005 ? 'PAYEE' : 'PARTIELLEMENT_PAYEE';
  }

  return {
    linkedOrders,
    allocatedAmount,
    netOrderedAmount,
    deductionsTotal,
    executedAmount,
    remainingAmount,
    progressPercent,
    paymentStatus,
  };
}

export function validateOrderAgainstInvoice(
  invoice: Invoice,
  orders: PaymentOrder[],
  requestedNetAmount: number,
  requestedCurrency: string,
  deductions?: Array<Partial<OrderDeduction>>,
  explicitGrossAmount?: number
): {
  valid: boolean;
  error?: string;
  summary: InvoicePaymentSummary;
  grossAmount: number;
  deductionsTotal: number;
  normalizedDeductions: OrderDeduction[];
} {
  const summary = computeInvoicePaymentSummary(invoice, orders);
  const dedCheck = normalizeOrderDeductions(deductions);

  if (dedCheck.error) {
    return {
      valid: false,
      error: dedCheck.error,
      summary,
      grossAmount: Number(requestedNetAmount) || 0,
      deductionsTotal: 0,
      normalizedDeductions: [],
    };
  }

  const netRounded = Number((Number(requestedNetAmount) || 0).toFixed(2));
  const computedGross = Number((netRounded + dedCheck.total).toFixed(2));
  const grossAmount =
    explicitGrossAmount !== undefined && Number.isFinite(Number(explicitGrossAmount))
      ? Number(Number(explicitGrossAmount).toFixed(2))
      : computedGross;

  if (requestedCurrency !== invoice.currency) {
    return {
      valid: false,
      error: `La devise de l’ordre (${requestedCurrency}) doit correspondre à la devise de la facture (${invoice.currency}).`,
      summary,
      grossAmount,
      deductionsTotal: dedCheck.total,
      normalizedDeductions: dedCheck.items,
    };
  }

  if (
    explicitGrossAmount !== undefined &&
    Number.isFinite(Number(explicitGrossAmount)) &&
    Math.abs(grossAmount - computedGross) > 0.02
  ) {
    return {
      valid: false,
      error: `Incohérence entre le montant brut (${grossAmount.toFixed(2)}), les déductions (${dedCheck.total.toFixed(2)}) et le montant net (${netRounded.toFixed(2)}).`,
      summary,
      grossAmount,
      deductionsTotal: dedCheck.total,
      normalizedDeductions: dedCheck.items,
    };
  }

  if (!Number.isFinite(requestedNetAmount) || requestedNetAmount <= 0) {
    return {
      valid: false,
      error:
        dedCheck.total > 0
          ? `Le montant net à transférer après déductions (${dedCheck.total.toFixed(2)} ${invoice.currency}) doit être strictement supérieur à 0.`
          : 'Le montant à payer sur la facture doit être strictement supérieur à 0.',
      summary,
      grossAmount,
      deductionsTotal: dedCheck.total,
      normalizedDeductions: dedCheck.items,
    };
  }

  if (summary.remainingAmount <= 0.005) {
    return {
      valid: false,
      error: `La facture ${invoice.invoiceNumber} est déjà intégralement ordonnancée (${invoice.totalAmount} ${invoice.currency}).`,
      summary,
      grossAmount,
      deductionsTotal: dedCheck.total,
      normalizedDeductions: dedCheck.items,
    };
  }

  if (grossAmount > summary.remainingAmount + 0.005) {
    return {
      valid: false,
      error:
        dedCheck.total > 0
          ? `Le montant brut imputé (${grossAmount.toFixed(2)} ${invoice.currency} = net ${netRounded.toFixed(2)} + déductions ${dedCheck.total.toFixed(2)}) dépasse le solde restant de la facture (${summary.remainingAmount.toFixed(2)} ${invoice.currency}).`
          : `Le montant saisi (${requestedNetAmount.toFixed(2)} ${invoice.currency}) dépasse le solde restant de la facture (${summary.remainingAmount.toFixed(2)} ${invoice.currency}).`,
      summary,
      grossAmount,
      deductionsTotal: dedCheck.total,
      normalizedDeductions: dedCheck.items,
    };
  }

  return {
    valid: true,
    summary,
    grossAmount,
    deductionsTotal: dedCheck.total,
    normalizedDeductions: dedCheck.items,
  };
}

export function getAvailableInvoicesForOrder(
  invoices: Invoice[],
  orders: PaymentOrder[]
): Array<{ invoice: Invoice; summary: InvoicePaymentSummary }> {
  return invoices
    .map(invoice => ({
      invoice,
      summary: computeInvoicePaymentSummary(invoice, orders),
    }))
    .filter(item => item.summary.remainingAmount > 0.005);
}

export function canEditOrderDeductions(
  order: Pick<PaymentOrder, 'status' | 'deposit' | 'exchangeTransaction'>
): { allowed: boolean; reason?: string } {
  if (order.status === 'ANNULE') {
    return {
      allowed: false,
      reason: "Modification des déductions impossible : l'ordre a été annulé.",
    };
  }
  if (order.status === 'EXECUTE') {
    return {
      allowed: false,
      reason: "Modification des déductions impossible : le virement a déjà été exécuté.",
    };
  }
  if (
    order.status === 'DEPOSE_BANQUE' ||
    order.status === 'EN_ATTENTE_ACHAT_DEVISE' ||
    Boolean(order.deposit)
  ) {
    return {
      allowed: false,
      reason:
        "Modification des déductions impossible : l'ordre a déjà été déposé à la banque.",
    };
  }
  const exStatus = order.exchangeTransaction?.status;
  if (
    order.exchangeTransaction?.consultationId &&
    (exStatus === 'CONSULTATION_EN_COURS' || exStatus === 'NEGOCIE' || exStatus === 'VALIDE')
  ) {
    return {
      allowed: false,
      reason:
        "Modification des déductions impossible : l'ordre est déjà engagé dans une consultation de change.",
    };
  }
  if (
    order.status === 'SAISI' ||
    order.status === 'TRANSMIS_SIGNATURE' ||
    order.status === 'SIGNE'
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Modification des déductions impossible pour le statut ${order.status}.`,
  };
}

export function validateExistingOrderDeductionsUpdate(params: {
  order: PaymentOrder;
  invoice?: Invoice;
  allOrders: PaymentOrder[];
  deductions?: Array<Partial<OrderDeduction>>;
  grossAmount?: number;
}): {
  valid: boolean;
  error?: string;
  grossAmount: number;
  deductionsTotal: number;
  netAmount: number;
  normalizedDeductions: OrderDeduction[];
  maxAllowedGross?: number;
} {
  const { order, invoice, allOrders, deductions, grossAmount } = params;
  const currentGross = getOrderInvoiceGrossAmount(order);

  const editCheck = canEditOrderDeductions(order);
  if (!editCheck.allowed) {
    return {
      valid: false,
      error: editCheck.reason,
      grossAmount: currentGross,
      deductionsTotal: getOrderDeductionsTotal(order),
      netAmount: Number(order.amount) || 0,
      normalizedDeductions: Array.isArray(order.deductions) ? order.deductions : [],
    };
  }

  const dedCheck = normalizeOrderDeductions(deductions);
  if (dedCheck.error) {
    return {
      valid: false,
      error: dedCheck.error,
      grossAmount: currentGross,
      deductionsTotal: 0,
      netAmount: currentGross,
      normalizedDeductions: [],
    };
  }

  let targetGross = currentGross;
  if (grossAmount !== undefined && grossAmount !== null) {
    const parsedGross = Number(grossAmount);
    if (!Number.isFinite(parsedGross) || parsedGross <= 0) {
      return {
        valid: false,
        error: "Le montant brut de l'ordre doit être strictement supérieur à 0.",
        grossAmount: currentGross,
        deductionsTotal: dedCheck.total,
        netAmount: 0,
        normalizedDeductions: dedCheck.items,
      };
    }
    targetGross = Number(parsedGross.toFixed(2));
  }

  const netAmount = Number((targetGross - dedCheck.total).toFixed(2));
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    return {
      valid: false,
      error: `Le total des déductions (${dedCheck.total.toFixed(2)} ${order.currency}) doit être inférieur au montant brut (${targetGross.toFixed(2)} ${order.currency}) pour conserver un net à transférer positif.`,
      grossAmount: targetGross,
      deductionsTotal: dedCheck.total,
      netAmount,
      normalizedDeductions: dedCheck.items,
    };
  }

  let maxAllowedGross: number | undefined;
  if (invoice) {
    if (order.currency !== invoice.currency) {
      return {
        valid: false,
        error: `La devise de l’ordre (${order.currency}) doit correspondre à celle de la facture (${invoice.currency}).`,
        grossAmount: targetGross,
        deductionsTotal: dedCheck.total,
        netAmount,
        normalizedDeductions: dedCheck.items,
      };
    }
    const otherOrders = allOrders.filter(o => o.id !== order.id);
    const summaryWithoutCurrent = computeInvoicePaymentSummary(invoice, otherOrders);
    maxAllowedGross = summaryWithoutCurrent.remainingAmount;
    if (targetGross > maxAllowedGross + 0.005) {
      return {
        valid: false,
        error: `Le montant brut imputé (${targetGross.toFixed(2)} ${invoice.currency}) dépasse le solde disponible de la facture ${invoice.invoiceNumber} (${maxAllowedGross.toFixed(2)} ${invoice.currency}).`,
        grossAmount: targetGross,
        deductionsTotal: dedCheck.total,
        netAmount,
        normalizedDeductions: dedCheck.items,
        maxAllowedGross,
      };
    }
  }

  return {
    valid: true,
    grossAmount: targetGross,
    deductionsTotal: dedCheck.total,
    netAmount,
    normalizedDeductions: dedCheck.items,
    maxAllowedGross,
  };
}

