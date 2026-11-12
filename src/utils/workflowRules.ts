import { PaymentStatus, UserRole } from '../types/payment';

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
  BROUILLON: {
    status: 'BROUILLON',
    label: 'Brouillon',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    stepNumber: 1,
    description: "Ordre de paiement en cours d'élaboration",
  },
  SAISI: {
    status: 'SAISI',
    label: 'Saisi définitivement',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    stepNumber: 2,
    description: "Ordre complété et prêt pour transmission au contrôle",
  },
  TRANSMIS_CG: {
    status: 'TRANSMIS_CG',
    label: 'Transmis au Contrôle',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    stepNumber: 3,
    description: "Dossier soumis pour vérification au Contrôle de Gestion",
  },
  VALIDE_CG: {
    status: 'VALIDE_CG',
    label: 'Validé par Contrôle de Gestion',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    stepNumber: 4,
    description: "Conformité budgétaire et pièces justificatives validées",
  },
  RETOURNE_CORRECTION: {
    status: 'RETOURNE_CORRECTION',
    label: 'Retourné pour correction',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    badgeBorder: 'border-orange-200',
    stepNumber: 3,
    description: "Anomalie ou pièce manquante signalée par le Contrôle de Gestion",
  },
  DEPOSE_BANQUE: {
    status: 'DEPOSE_BANQUE',
    label: 'Déposé à la Banque',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    stepNumber: 5,
    description: "Dossier remis physiquement à la banque tunisienne avec bordereau",
  },
  ATTENTE_NEGOCIATION: {
    status: 'ATTENTE_NEGOCIATION',
    label: 'Attente Négociation Change',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    stepNumber: 6,
    description: "En attente de consultation des cotations (Module 02)",
  },
  TAUX_VALIDE: {
    status: 'TAUX_VALIDE',
    label: 'Taux de Change Validé',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200',
    stepNumber: 7,
    description: "Cotation bancaire fixée et validée par la DFC",
  },
  EN_COURS_EXECUTION: {
    status: 'EN_COURS_EXECUTION',
    label: 'En Cours d’Exécution',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-700',
    badgeBorder: 'border-cyan-200',
    stepNumber: 8,
    description: "Ordre de transfert en traitement au niveau de la salle des marchés et back-office",
  },
  EXECUTE: {
    status: 'EXECUTE',
    label: 'Exécuté',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    stepNumber: 9,
    description: "Transfert SWIFT émis avec succès et compte bancaire débité",
  },
  REJETE: {
    status: 'REJETE',
    label: 'Rejeté',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    stepNumber: 0,
    description: "Ordre rejeté définitivement avec motif documenté",
  },
  ANNULE: {
    status: 'ANNULE',
    label: 'Annulé',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    stepNumber: 0,
    description: "Ordre annulé administrativement par la DFC",
  },
};

export const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  BROUILLON: ['SAISI', 'TRANSMIS_CG', 'ANNULE'],
  SAISI: ['TRANSMIS_CG', 'BROUILLON', 'ANNULE'],
  TRANSMIS_CG: ['VALIDE_CG', 'RETOURNE_CORRECTION', 'REJETE', 'ANNULE'],
  RETOURNE_CORRECTION: ['SAISI', 'TRANSMIS_CG', 'ANNULE'],
  VALIDE_CG: ['DEPOSE_BANQUE', 'ANNULE'],
  DEPOSE_BANQUE: ['ATTENTE_NEGOCIATION', 'TAUX_VALIDE', 'EN_COURS_EXECUTION', 'ANNULE'],
  ATTENTE_NEGOCIATION: ['TAUX_VALIDE', 'EN_COURS_EXECUTION', 'ANNULE'],
  TAUX_VALIDE: ['EN_COURS_EXECUTION', 'EXECUTE', 'ANNULE'],
  EN_COURS_EXECUTION: ['EXECUTE', 'REJETE', 'ANNULE'],
  EXECUTE: [], // Statut final
  REJETE: [],  // Statut final
  ANNULE: [],  // Statut final
};

export function canUserPerformTransition(
  fromStatus: PaymentStatus,
  toStatus: PaymentStatus,
  role: UserRole
): { allowed: boolean; reason?: string } {
  // L'administrateur a tous les droits
  if (role === 'ADMINISTRATEUR') {
    if (ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
      return { allowed: true };
    }
    return { allowed: false, reason: `Transition non autorisée du statut ${fromStatus} vers ${toStatus}` };
  }

  // Contrôler la validité du graphe de transition
  if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Transition invalide selon le circuit de validation MTK : ${STATUS_META[fromStatus].label} -> ${STATUS_META[toStatus].label}`,
    };
  }

  // Contrôle de Gestion spécifique
  if (toStatus === 'VALIDE_CG' || toStatus === 'RETOURNE_CORRECTION' || (fromStatus === 'TRANSMIS_CG' && toStatus === 'REJETE')) {
    if (role !== 'CONTROLE_GESTION') {
      return {
        allowed: false,
        reason: 'Seul le Contrôle de Gestion est habilité à valider, rejeter ou retourner un ordre pour correction.',
      };
    }
    return { allowed: true };
  }

  // Saisie et transmission
  if (toStatus === 'TRANSMIS_CG' || toStatus === 'SAISI' || toStatus === 'BROUILLON') {
    if (role !== 'AGENT_FINANCIER' && role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'Rôle insuffisant pour modifier ou transmettre la saisie de l’ordre.',
      };
    }
    return { allowed: true };
  }

  // Dépôt bancaire
  if (toStatus === 'DEPOSE_BANQUE') {
    if (fromStatus !== 'VALIDE_CG') {
      return {
        allowed: false,
        reason: 'Un ordre doit impérativement être validé par le Contrôle de Gestion avant d’être déposé à la banque.',
      };
    }
    if (role !== 'AGENT_FINANCIER' && role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'Seuls les agents financiers et responsables peuvent attester du dépôt bancaire.',
      };
    }
    return { allowed: true };
  }

  // Exécution et clôture
  if (toStatus === 'EXECUTE') {
    if (role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'Seul le Responsable Financier peut valider la clôture et la bonne exécution du transfert.',
      };
    }
    return { allowed: true };
  }

  // Annulation
  if (toStatus === 'ANNULE') {
    if (role !== 'RESPONSABLE_FINANCIER') {
      return {
        allowed: false,
        reason: 'L’annulation administrative d’un ordre de paiement requiert l’autorisation du Responsable Financier.',
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

