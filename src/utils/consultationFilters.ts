import {
  ConsultationStatus,
  CurrencyConsultation,
  PaymentOrder,
} from '../types/payment';

export interface ConsultationFilterParams {
  searchQuery?: string;
  status?: 'ALL' | ConsultationStatus;
  currency?: string;
  bank?: string;
  fiscalYear?: string;
}

export type ConsultationSortField =
  | 'operationDate'
  | 'consultationNumber'
  | 'totalAmount'
  | 'status'
  | 'createdAt';

export type ConsultationSortOrder = 'asc' | 'desc';

export const CONSULTATION_STATUS_META: Record<
  ConsultationStatus,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  OUVERTE: {
    label: 'Ouverte',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  CLOTUREE: {
    label: 'Clôturée',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
  },
  ANNULEE: {
    label: 'Annulée',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
  },
};

export function getConsultationLinkedOrders(
  consultation: CurrencyConsultation,
  orders: PaymentOrder[]
): PaymentOrder[] {
  if (!consultation.orderIds || consultation.orderIds.length === 0) return [];
  const orderMap = new Map(orders.map(o => [o.id, o]));
  return consultation.orderIds
    .map(id => orderMap.get(id))
    .filter((o): o is PaymentOrder => Boolean(o));
}

export interface ConsultationBeneficiarySummary {
  primaryLabel: string;
  beneficiaries: string[];
  orderNumbers: string[];
  purposes: string[];
}

export function getConsultationBeneficiarySummary(
  consultation: CurrencyConsultation,
  orders: PaymentOrder[]
): ConsultationBeneficiarySummary {
  const linkedOrders = getConsultationLinkedOrders(consultation, orders);
  const beneficiaries = Array.from(
    new Set(
      linkedOrders
        .map(o => (o.beneficiaryName || '').trim())
        .filter(Boolean)
    )
  );
  const purposes = Array.from(
    new Set(
      linkedOrders
        .map(o => (o.purpose || '').trim())
        .filter(Boolean)
    )
  );
  const orderNumbers =
    consultation.orderNumbers && consultation.orderNumbers.length > 0
      ? consultation.orderNumbers
      : linkedOrders.map(o => o.orderNumber);

  let primaryLabel: string;
  if (beneficiaries.length === 1) {
    primaryLabel = beneficiaries[0];
  } else if (beneficiaries.length > 1) {
    primaryLabel = `${beneficiaries[0]} + ${beneficiaries.length - 1} autre${
      beneficiaries.length - 1 > 1 ? 's' : ''
    }`;
  } else if (orderNumbers.length > 0) {
    primaryLabel = `${orderNumbers.length} ordre${orderNumbers.length > 1 ? 's' : ''} regroupé${
      orderNumbers.length > 1 ? 's' : ''
    }`;
  } else {
    primaryLabel = 'Aucun ordre rattaché';
  }

  return {
    primaryLabel,
    beneficiaries,
    orderNumbers,
    purposes,
  };
}

export function filterConsultations(
  consultations: CurrencyConsultation[],
  orders: PaymentOrder[],
  filters: ConsultationFilterParams
): CurrencyConsultation[] {
  const query = (filters.searchQuery || '').trim().toLowerCase();

  return consultations.filter(consultation => {
    if (filters.status && filters.status !== 'ALL' && consultation.status !== filters.status) {
      return false;
    }

    if (
      filters.currency &&
      filters.currency !== 'ALL' &&
      consultation.currency !== filters.currency
    ) {
      return false;
    }

    if (filters.fiscalYear && filters.fiscalYear !== 'ALL') {
      const opYear = (consultation.operationDate || consultation.createdAt || '').slice(0, 4);
      if (opYear !== filters.fiscalYear) {
        return false;
      }
    }

    const linkedOrders = getConsultationLinkedOrders(consultation, orders);

    if (filters.bank && filters.bank !== 'ALL') {
      const matchesSelectedBank = consultation.selectedBankId === filters.bank;
      const matchesConsultedBank = (consultation.consultedBankIds || []).includes(filters.bank);
      const matchesQuoteBank = (consultation.quotes || []).some(q => q.bankId === filters.bank);
      const matchesOrderBank = linkedOrders.some(o => o.bankId === filters.bank);
      if (!matchesSelectedBank && !matchesConsultedBank && !matchesQuoteBank && !matchesOrderBank) {
        return false;
      }
    }

    if (query) {
      const searchableParts = [
        consultation.consultationNumber,
        consultation.purchaseType,
        consultation.selectedBankName,
        consultation.confirmationRef,
        consultation.createdBy,
        consultation.notes,
        consultation.currency,
        ...(consultation.orderNumbers || []),
        ...linkedOrders.flatMap(o => [
          o.orderNumber,
          o.beneficiaryName,
          o.invoiceNumber,
          o.purpose,
          o.bankName,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableParts.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function sortConsultations(
  consultations: CurrencyConsultation[],
  sortField: ConsultationSortField,
  sortOrder: ConsultationSortOrder
): CurrencyConsultation[] {
  return [...consultations].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'operationDate') {
      comparison = (a.operationDate || '').localeCompare(b.operationDate || '');
      if (comparison === 0) {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    } else if (sortField === 'createdAt') {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortField === 'consultationNumber') {
      comparison = a.consultationNumber.localeCompare(b.consultationNumber);
    } else if (sortField === 'totalAmount') {
      comparison = a.totalAmount - b.totalAmount;
    } else if (sortField === 'status') {
      comparison = a.status.localeCompare(b.status);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

export function getConsultationFiscalYears(
  consultations: CurrencyConsultation[]
): string[] {
  const years = new Set<string>();
  consultations.forEach(c => {
    const y = (c.operationDate || c.createdAt || '').slice(0, 4);
    if (/^\d{4}$/.test(y)) {
      years.add(y);
    }
  });
  if (years.size === 0) {
    years.add('2026');
    years.add('2025');
  }
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}
