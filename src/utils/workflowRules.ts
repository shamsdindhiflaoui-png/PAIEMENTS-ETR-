import {
  ExchangeQuote,
  PaymentOrder,
  PaymentStatus,
  PaymentWorkflow,
  User,
  UserRole,
} from '../types/payment';

export interface StatusMeta {
  status: PaymentStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  stepNumber: number;
  description: string;
}

export const STATUS_META: Record<PaymentStatus, StatusMeta> = {
  SAISI: {
    status: 'SAISI',
    label: 'Saisi (Brouillon)',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    stepNumber: 1,
    description: "Ordre en cours de saisie / brouillon enregistré",
  },
  TRANSMIS_SIGNATURE: {
    status: 'TRANSMIS_SIGNATURE',
    label: 'Transmis pour signature',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    stepNumber: 2,
    description: "Ordre soumis à la signature officielle de la direction",
  },
  SIGNE: {
    status: 'SIGNE',
    label: 'Signé',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    stepNumber: 3,
    description: "Ordre signé et autorisé pour le dépôt bancaire",
  },
  DEPOSE_BANQUE: {
    status: 'DEPOSE_BANQUE',
    label: 'Déposé à la banque',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-200',
    stepNumber: 4,
    description: "Dossier déposé à la banque (négociation de cours non exigée)",
  },
  EN_ATTENTE_ACHAT_DEVISE: {
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    label: "En attente d'achat devise",
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    stepNumber: 4,
    description: "Déposé à la banque : en attente de négociation du cours et d'achat de devise",
  },
  EXECUTE: {
    status: 'EXECUTE',
    label: 'Exécuté',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    stepNumber: 5,
    description: "Transfert SWIFT exécuté avec succès et compte débité",
  },
  ANNULE: {
    status: 'ANNULE',
    label: 'Annulé',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    stepNumber: 0,
    description: "Ordre annulé administrativement par la DFC",
  },
};

export const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  SAISI: ['TRANSMIS_SIGNATURE', 'ANNULE'],
  TRANSMIS_SIGNATURE: ['SIGNE', 'SAISI', 'ANNULE'],
  SIGNE: ['DEPOSE_BANQUE', 'EN_ATTENTE_ACHAT_DEVISE', 'SAISI', 'ANNULE'],
  DEPOSE_BANQUE: ['EXECUTE', 'ANNULE'],
  EN_ATTENTE_ACHAT_DEVISE: ['DEPOSE_BANQUE', 'EXECUTE', 'ANNULE'],
  EXECUTE: [],
  ANNULE: [],
};

/**
 * Détermine automatiquement le statut de l'étape 4 (Dépôt bancaire)
 * selon la case à cocher "Négociation du cours exigée".
 */
export function getDepositTargetStatus(requiresRateNegotiation?: boolean): PaymentStatus {
  return requiresRateNegotiation ? 'EN_ATTENTE_ACHAT_DEVISE' : 'DEPOSE_BANQUE';
}

export interface ConsultationUpdateForOrder {
  consultationId: string;
  consultationNumber: string;
  confirmationRef?: string;
  confirmationDate?: string;
  valueDate?: string;
  selectedBankId?: string;
  selectedBankName?: string;
  negotiatedRate?: number;
  quotes: ExchangeQuote[];
  closed: boolean;
  notes?: string;
  timestamp: string;
  user: Pick<User, 'id' | 'name' | 'role'>;
}

/**
 * Répercute les cotations ou la clôture d'une consultation de change sur un ordre de paiement :
 * - Met à jour exchangeTransaction et finalExchangeRate
 * - Lors de la clôture (closed = true), fait évoluer l'ordre de EN_ATTENTE_ACHAT_DEVISE
 *   vers DEPOSE_BANQUE (devise achetée et confirmée, prêt pour exécution SWIFT) et journalise l'historique.
 */
export function applyConsultationUpdateToOrder(
  order: PaymentOrder,
  update: ConsultationUpdateForOrder
): {
  order: PaymentOrder;
  statusChanged: boolean;
  workflowEntry?: PaymentWorkflow;
} {
  const quotes = Array.isArray(update.quotes) ? update.quotes : [];
  const negotiatedRate =
    update.negotiatedRate && update.negotiatedRate > 0
      ? Number(update.negotiatedRate)
      : undefined;

  let computedSavingsTnd: number | undefined = order.exchangeTransaction?.savingsTnd;
  if (update.closed && negotiatedRate && quotes.length > 1) {
    const highestQuotedRate = Math.max(...quotes.map(q => Number(q.rate) || 0));
    if (highestQuotedRate > negotiatedRate) {
      computedSavingsTnd = Number(((highestQuotedRate - negotiatedRate) * order.amount).toFixed(3));
    }
  }

  const exchangeNoteParts: string[] = [];
  if (update.closed && update.confirmationRef) {
    exchangeNoteParts.push(`Confirmation d'achat ${update.confirmationRef}`);
  }
  if (update.closed && update.valueDate) {
    exchangeNoteParts.push(`Date valeur ${update.valueDate}`);
  }
  if (update.notes && update.notes.trim()) {
    exchangeNoteParts.push(update.notes.trim());
  }

  const shouldTransitionStatus =
    update.closed && order.status === 'EN_ATTENTE_ACHAT_DEVISE';

  let workflowEntry: PaymentWorkflow | undefined;
  if (shouldTransitionStatus) {
    const rateLabel = negotiatedRate ? `${negotiatedRate.toFixed(4)} TND` : '—';
    const bankLabel = update.selectedBankName || 'la banque retenue';
    const refLabel = update.confirmationRef ? ` (Confirmation ${update.confirmationRef})` : '';
    workflowEntry = {
      id: `wf_cons_${Date.now()}_${order.id}`,
      orderId: order.id,
      fromStatus: 'EN_ATTENTE_ACHAT_DEVISE',
      toStatus: 'DEPOSE_BANQUE',
      timestamp: update.timestamp,
      userId: update.user.id,
      userName: update.user.name,
      userRole: update.user.role,
      comment: `Achat de devise confirmé via consultation ${update.consultationNumber}${refLabel} : ${bankLabel} au cours de ${rateLabel}. Prêt pour exécution SWIFT.`,
    };
  }

  const updatedOrder: PaymentOrder = {
    ...order,
    status: shouldTransitionStatus ? 'DEPOSE_BANQUE' : order.status,
    updatedAt: update.timestamp,
    finalExchangeRate: negotiatedRate || order.finalExchangeRate,
    history: workflowEntry ? [...(order.history || []), workflowEntry] : order.history,
    exchangeTransaction: {
      ...(order.exchangeTransaction || { id: 'ex_' + order.id, orderId: order.id }),
      consultationId: update.consultationId,
      consultationNumber: update.consultationNumber,
      consultationDate:
        update.confirmationDate || order.exchangeTransaction?.consultationDate,
      status: update.closed
        ? 'VALIDE'
        : quotes.length > 0
        ? 'NEGOCIE'
        : 'CONSULTATION_EN_COURS',
      quotes,
      selectedBankId: update.selectedBankId ?? order.exchangeTransaction?.selectedBankId,
      selectedBankName:
        update.selectedBankName ?? order.exchangeTransaction?.selectedBankName,
      finalNegotiatedRate:
        negotiatedRate ?? order.exchangeTransaction?.finalNegotiatedRate,
      savingsTnd: computedSavingsTnd,
      validatedAt: update.closed
        ? update.timestamp
        : order.exchangeTransaction?.validatedAt,
      validatedBy: update.closed
        ? update.user.name
        : order.exchangeTransaction?.validatedBy,
      notes:
        exchangeNoteParts.length > 0
          ? exchangeNoteParts.join(' · ')
          : order.exchangeTransaction?.notes,
    },
  };

  return {
    order: updatedOrder,
    statusChanged: shouldTransitionStatus,
    workflowEntry,
  };
}

/**
 * Convertit d'éventuels anciens statuts stockés sur disque vers le nouveau circuit à 5 statuts.
 */
export function normalizeLegacyStatus(
  status: string,
  requiresRateNegotiation?: boolean,
  isExchangeValidated?: boolean
): PaymentStatus {
  switch (status) {
    case 'SAISI':
    case 'BROUILLON':
    case 'RETOURNE_CORRECTION':
      return 'SAISI';
    case 'TRANSMIS_SIGNATURE':
    case 'TRANSMIS_CG':
      return 'TRANSMIS_SIGNATURE';
    case 'SIGNE':
    case 'VALIDE_CG':
      return 'SIGNE';
    case 'DEPOSE_BANQUE':
      return requiresRateNegotiation && !isExchangeValidated
        ? 'EN_ATTENTE_ACHAT_DEVISE'
        : 'DEPOSE_BANQUE';
    case 'EN_ATTENTE_ACHAT_DEVISE':
    case 'ATTENTE_NEGOCIATION':
    case 'TAUX_VALIDE':
    case 'EN_COURS_EXECUTION':
      return 'EN_ATTENTE_ACHAT_DEVISE';
    case 'EXECUTE':
      return 'EXECUTE';
    case 'ANNULE':
    case 'REJETE':
      return 'ANNULE';
    default:
      return 'SAISI';
  }
}

export function canUserPerformTransition(
  fromStatus: PaymentStatus,
  toStatus: PaymentStatus,
  role: UserRole
): { allowed: boolean; reason?: string } {
  if (role === 'ADMINISTRATEUR') {
    if (ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
      return { allowed: true };
    }
    return { allowed: false, reason: `Transition non autorisée du statut ${fromStatus} vers ${toStatus}` };
  }

  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Transition invalide selon le circuit MTK : ${STATUS_META[fromStatus]?.label || fromStatus} -> ${STATUS_META[toStatus]?.label || toStatus}`,
    };
  }

  // Transmission pour signature ou retour en Saisi (Brouillon)
  if (toStatus === 'TRANSMIS_SIGNATURE') {
    if (role !== 'AGENT_FINANCIER' && role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'Rôle insuffisant pour transmettre l’ordre pour signature.',
      };
    }
    return { allowed: true };
  }

  if (toStatus === 'SAISI') {
    if (role !== 'CONTROLE_GESTION' && role !== 'RESPONSABLE_FINANCIER' && role !== 'AGENT_FINANCIER') {
      return {
        allowed: false,
        reason: 'Rôle insuffisant pour retourner l’ordre en brouillon (Saisi).',
      };
    }
    return { allowed: true };
  }

  // Signature de l'ordre (Statut 3 : Signé)
  if (toStatus === 'SIGNE') {
    if (role !== 'RESPONSABLE_FINANCIER' && role !== 'CONTROLE_GESTION') {
      return {
        allowed: false,
        reason: 'Seul le Responsable Financier ou le Contrôle de Gestion est habilité à signer l’ordre.',
      };
    }
    return { allowed: true };
  }

  // Dépôt bancaire / En attente d'achat devise (Statut 4)
  if (toStatus === 'DEPOSE_BANQUE' || toStatus === 'EN_ATTENTE_ACHAT_DEVISE') {
    if (fromStatus !== 'SIGNE') {
      return {
        allowed: false,
        reason: 'Un ordre doit impérativement être au statut « Signé » avant d’être déposé à la banque.',
      };
    }
    if (role !== 'AGENT_FINANCIER' && role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'Seuls les agents financiers et responsables peuvent enregistrer le dépôt bancaire.',
      };
    }
    return { allowed: true };
  }

  // Exécution et clôture (Statut 5 : Exécuté)
  if (toStatus === 'EXECUTE') {
    if (role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'Seul le Responsable Financier peut valider la clôture et l’exécution du transfert.',
      };
    }
    return { allowed: true };
  }

  // Annulation
  if (toStatus === 'ANNULE') {
    if (role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'L’annulation administrative d’un ordre requiert l’autorisation du Responsable Financier.',
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

export function formatTndCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export function formatForeignCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Génération du numéro d'ordre selon la structure officielle MTK :
 * 000 UTILISATEUR 000 ANNEE 0000 ORDRE
 * Exemple pour l'utilisateur 001, année 2026 (026), ordre 1 : "001-026-0001"
 */
export function generateStructuredOrderNumber(
  userCode: string | number = '001',
  year: number = new Date().getFullYear(),
  existingCount: number = 0,
  separator: string = '-'
): {
  orderNumber: string;
  userPart: string;
  yearPart: string;
  seqPart: string;
} {
  const uDigits = String(userCode).replace(/\D/g, '') || '1';
  const userPart = uDigits.padStart(3, '0').slice(-3);

  const yStr = String(year);
  const yearPart = yStr.length >= 3 ? yStr.slice(-3) : yStr.padStart(3, '0');

  const seqPart = String(existingCount + 1).padStart(4, '0');

  const orderNumber = separator ? `${userPart}${separator}${yearPart}${separator}${seqPart}` : `${userPart}${yearPart}${seqPart}`;

  return {
    orderNumber,
    userPart,
    yearPart,
    seqPart,
  };
}

export function generateOrderNumber(existingCount: number, year: number = new Date().getFullYear(), userCode: string = '001'): string {
  return generateStructuredOrderNumber(userCode, year, existingCount).orderNumber;
}

