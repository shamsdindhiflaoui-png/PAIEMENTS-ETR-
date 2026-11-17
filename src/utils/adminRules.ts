import {
  CurrencyConsultation,
  Invoice,
  PaymentOrder,
  User,
} from '../types/payment';
import { findReferenceConflict } from './invoiceUtils';

export function isAdministrator(user?: Pick<User, 'role'> | null): boolean {
  return user?.role === 'ADMINISTRATEUR';
}

export function isEntityCreator(
  user?: Pick<User, 'id'> | null,
  entity?: { createdById?: string } | null
): boolean {
  return Boolean(user?.id && entity?.createdById && user.id === entity.createdById);
}

export function assertAdminPermission(user?: Pick<User, 'role'> | null): {
  allowed: boolean;
  reason?: string;
} {
  if (isAdministrator(user)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      'Action refusée : seul l’Administrateur DFC est habilité à modifier ou supprimer ces dossiers.',
  };
}

export function canUserManageOrder(
  user?: Pick<User, 'id' | 'role'> | null,
  order?: Pick<PaymentOrder, 'createdById' | 'status'> | null
): { allowed: boolean; reason?: string } {
  if (!user || !order) {
    return { allowed: false, reason: 'Utilisateur ou ordre introuvable.' };
  }
  if (isAdministrator(user)) {
    return { allowed: true };
  }
  if (isEntityCreator(user, order)) {
    if (order.status === 'EXECUTE') {
      return {
        allowed: false,
        reason:
          'Un ordre déjà exécuté (SWIFT confirmé) ne peut être modifié ou supprimé que par l’Administrateur.',
      };
    }
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      'Action refusée : seul l’Administrateur ou le créateur de cet ordre peut le modifier ou le supprimer.',
  };
}

export function canUserManageInvoice(
  user?: Pick<User, 'id' | 'role'> | null,
  invoice?: Pick<Invoice, 'createdById'> | null
): { allowed: boolean; reason?: string } {
  if (!user || !invoice) {
    return { allowed: false, reason: 'Utilisateur ou facture introuvable.' };
  }
  if (isAdministrator(user) || isEntityCreator(user, invoice)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      'Action refusée : seul l’Administrateur ou le créateur de cette facture peut la modifier ou la supprimer.',
  };
}

export function canUserManageConsultation(
  user?: Pick<User, 'id' | 'role'> | null,
  consultation?: Pick<CurrencyConsultation, 'createdById'> | null
): { allowed: boolean; reason?: string } {
  if (!user || !consultation) {
    return { allowed: false, reason: 'Utilisateur ou consultation introuvable.' };
  }
  if (isAdministrator(user) || isEntityCreator(user, consultation)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      'Action refusée : seul l’Administrateur ou le créateur de cette consultation peut la modifier ou la supprimer.',
  };
}

export function validateAdminInvoiceUpdate(params: {
  current: Invoice;
  payload: Partial<Invoice>;
  existingInvoices: Invoice[];
}): { valid: boolean; error?: string; normalizedNumber?: string; totalAmount?: number } {
  const { current, payload, existingInvoices } = params;

  const nextProforma =
    payload.proformaNumber !== undefined
      ? payload.proformaNumber.trim() || undefined
      : current.proformaNumber?.trim() || undefined;
  const nextDefinitive =
    payload.definitiveInvoiceNumber !== undefined
      ? payload.definitiveInvoiceNumber.trim() || undefined
      : current.definitiveInvoiceNumber?.trim() || undefined;
  const explicitInvoice =
    payload.invoiceNumber !== undefined
      ? payload.invoiceNumber.trim()
      : current.invoiceNumber.trim();

  const nextNumber = nextDefinitive || explicitInvoice || nextProforma || '';

  if (!nextNumber) {
    return { valid: false, error: 'Le numéro de facture ou de Proforma est obligatoire.' };
  }

  const candidateRefs = Array.from(
    new Set([nextNumber, nextProforma, nextDefinitive].filter((v): v is string => Boolean(v)))
  );
  const conflict = findReferenceConflict(candidateRefs, existingInvoices, current.id);
  if (conflict) {
    return {
      valid: false,
      error: `Une autre fiche facture porte déjà la référence ${conflict.conflictRef}.`,
    };
  }

  const nextSupplier =
    payload.supplierName !== undefined
      ? payload.supplierName.trim()
      : current.supplierName.trim();
  if (!nextSupplier) {
    return { valid: false, error: 'Le nom du fournisseur est obligatoire.' };
  }

  const nextPurpose =
    payload.purpose !== undefined ? payload.purpose.trim() : current.purpose.trim();
  if (!nextPurpose) {
    return { valid: false, error: 'L’objet / désignation de la facture est obligatoire.' };
  }

  const rawAmount =
    payload.totalAmount !== undefined ? Number(payload.totalAmount) : current.totalAmount;
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {
      valid: false,
      error: 'Le montant total de la facture doit être strictement supérieur à 0.',
    };
  }

  return {
    valid: true,
    normalizedNumber: nextNumber,
    totalAmount: Number(rawAmount.toFixed(2)),
  };
}

export function validateAdminOrderUpdate(params: {
  current: PaymentOrder;
  payload: Partial<PaymentOrder>;
  existingOrders: PaymentOrder[];
}): { valid: boolean; error?: string; normalizedOrderNumber?: string; amount?: number } {
  const { current, payload, existingOrders } = params;

  const nextOrderNumber =
    payload.orderNumber !== undefined
      ? payload.orderNumber.trim()
      : current.orderNumber.trim();

  if (!nextOrderNumber) {
    return { valid: false, error: 'Le numéro d’ordre est obligatoire.' };
  }

  const duplicate = existingOrders.find(
    o =>
      o.id !== current.id &&
      o.orderNumber.trim().toLowerCase() === nextOrderNumber.toLowerCase()
  );
  if (duplicate) {
    return {
      valid: false,
      error: `Un autre ordre portant le numéro ${nextOrderNumber} existe déjà.`,
    };
  }

  const nextBeneficiary =
    payload.beneficiaryName !== undefined
      ? payload.beneficiaryName.trim()
      : current.beneficiaryName.trim();
  if (!nextBeneficiary) {
    return { valid: false, error: 'Le nom du bénéficiaire / fournisseur est obligatoire.' };
  }

  const rawAmount =
    payload.amount !== undefined ? Number(payload.amount) : current.amount;
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return {
      valid: false,
      error: 'Le montant net de l’ordre doit être strictement supérieur à 0.',
    };
  }

  return {
    valid: true,
    normalizedOrderNumber: nextOrderNumber,
    amount: Number(rawAmount.toFixed(2)),
  };
}

export function validateAdminConsultationUpdate(params: {
  current: CurrencyConsultation;
  payload: Partial<CurrencyConsultation>;
  existingConsultations: CurrencyConsultation[];
}): { valid: boolean; error?: string; normalizedNumber?: string } {
  const { current, payload, existingConsultations } = params;

  const nextNumber =
    payload.consultationNumber !== undefined
      ? payload.consultationNumber.trim()
      : current.consultationNumber.trim();

  if (!nextNumber) {
    return { valid: false, error: 'Le numéro de consultation est obligatoire.' };
  }

  const duplicate = existingConsultations.find(
    c =>
      c.id !== current.id &&
      c.consultationNumber.trim().toLowerCase() === nextNumber.toLowerCase()
  );
  if (duplicate) {
    return {
      valid: false,
      error: `Une autre consultation portant le numéro ${nextNumber} existe déjà.`,
    };
  }

  const nextPurchaseType =
    payload.purchaseType !== undefined
      ? payload.purchaseType.trim()
      : current.purchaseType.trim();
  if (!nextPurchaseType) {
    return { valid: false, error: 'Le type d’achat (date valeur) est obligatoire.' };
  }

  const nextDate =
    payload.operationDate !== undefined
      ? payload.operationDate.trim()
      : current.operationDate.trim();
  if (!nextDate) {
    return { valid: false, error: 'La date d’opération est obligatoire.' };
  }

  return {
    valid: true,
    normalizedOrderNumber: undefined,
    normalizedNumber: nextNumber,
  } as any;
}

export function detachOrderFromConsultations(
  consultations: CurrencyConsultation[],
  deletedOrderId: string,
  remainingOrders: PaymentOrder[]
): CurrencyConsultation[] {
  const orderById = new Map<string, PaymentOrder>(remainingOrders.map(o => [o.id, o]));
  const affected: CurrencyConsultation[] = [];

  for (const consultation of consultations) {
    if (!consultation.orderIds.includes(deletedOrderId)) {
      continue;
    }

    const nextOrderIds: string[] = [];
    const nextOrderNumbers: string[] = [];

    consultation.orderIds.forEach((oid, idx) => {
      if (oid === deletedOrderId) return;
      nextOrderIds.push(oid);
      const liveOrder = orderById.get(oid);
      nextOrderNumbers.push(liveOrder?.orderNumber || consultation.orderNumbers[idx] || oid);
    });

    const nextTotalAmount = Number(
      nextOrderIds
        .reduce((sum, oid) => sum + (orderById.get(oid)?.amount || 0), 0)
        .toFixed(2)
    );

    affected.push({
      ...consultation,
      orderIds: nextOrderIds,
      orderNumbers: nextOrderNumbers,
      totalAmount: nextTotalAmount,
    });
  }

  return affected;
}

export function syncOrderNumberInConsultations(
  consultations: CurrencyConsultation[],
  updatedOrder: PaymentOrder
): CurrencyConsultation[] {
  const affected: CurrencyConsultation[] = [];

  for (const consultation of consultations) {
    const idx = consultation.orderIds.indexOf(updatedOrder.id);
    if (idx === -1) continue;

    const currentOrderNum = consultation.orderNumbers[idx];
    if (currentOrderNum === updatedOrder.orderNumber) continue;

    const nextOrderNumbers = [...consultation.orderNumbers];
    nextOrderNumbers[idx] = updatedOrder.orderNumber;

    affected.push({
      ...consultation,
      orderNumbers: nextOrderNumbers,
    });
  }

  return affected;
}

export function findOrdersToDetachFromInvoice(
  orders: PaymentOrder[],
  deletedInvoiceId: string
): PaymentOrder[] {
  return orders
    .filter(o => o.invoiceId === deletedInvoiceId)
    .map(o => ({
      ...o,
      invoiceId: undefined,
    }));
}

export function findOrdersToResetFromConsultation(
  orders: PaymentOrder[],
  deletedConsultationId: string
): PaymentOrder[] {
  return orders
    .filter(o => o.exchangeTransaction?.consultationId === deletedConsultationId)
    .map(o => ({
      ...o,
      exchangeTransaction: {
        id: 'ex_' + o.id,
        orderId: o.id,
        status: 'NON_DEMARRE',
      },
    }));
}
