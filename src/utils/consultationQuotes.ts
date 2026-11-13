import { Bank, CurrencyConsultation, ExchangeQuote } from '../types/payment';

export interface BankOfferDraft {
  bankId: string;
  bankName: string;
  bankCode?: string;
  isFullAmount: boolean;
  proposedAmount: string;
  rate: string;
  notes?: string;
}

export interface RankedBankOffer extends ExchangeQuote {
  proposedAmount: number;
  isFullAmount: boolean;
  rank: number;
  isLowestRate: boolean; // Moins-disant (meilleure offre pour achat de devise)
  isHighestRate: boolean; // Plus-disant
  counterValueTnd: number;
  coveragePercent: number;
  spreadVsBestRate: number;
  extraCostOnFullAmountTnd: number;
}

export interface CoverageAllocationStep {
  rank: number;
  bankId: string;
  bankName: string;
  rate: number;
  allocatedAmount: number;
  counterValueTnd: number;
}

export interface OfferRankingSummary {
  count: number;
  bestOffer: RankedBankOffer | null;
  worstOffer: RankedBankOffer | null;
  maxSpreadRate: number;
  potentialSavingsTnd: number;
  fullCoverageCount: number;
  allocationSteps: CoverageAllocationStep[];
  remainingUncoveredAmount: number;
}

export function buildInitialOfferDrafts(
  banks: Bank[],
  consultation: CurrencyConsultation
): BankOfferDraft[] {
  const existingQuotes = consultation.quotes || [];
  const consultedIds = new Set(consultation.consultedBankIds || []);
  const quotedIds = new Set(existingQuotes.map(q => q.bankId));

  // Si des banques ont été ciblées à la création, on affiche celles-ci + celles ayant déjà une offre.
  // Sinon on affiche toutes les banques du référentiel.
  const targetBanks =
    consultedIds.size > 0
      ? banks.filter(b => consultedIds.has(b.id) || quotedIds.has(b.id))
      : banks;

  const finalBanks = targetBanks.length > 0 ? targetBanks : banks;

  return finalBanks.map(bank => {
    const existing = existingQuotes.find(q => q.bankId === bank.id);
    if (existing) {
      const proposed =
        existing.proposedAmount !== undefined
          ? existing.proposedAmount
          : consultation.totalAmount;
      const isFull =
        existing.isFullAmount !== undefined
          ? existing.isFullAmount
          : Math.abs(proposed - consultation.totalAmount) < 0.01;
      return {
        bankId: bank.id,
        bankName: bank.name,
        bankCode: bank.code,
        isFullAmount: isFull,
        proposedAmount: String(proposed),
        rate: existing.rate > 0 ? String(existing.rate) : '',
        notes: existing.notes || '',
      };
    }

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankCode: bank.code,
      isFullAmount: true,
      proposedAmount: String(consultation.totalAmount),
      rate: '',
      notes: '',
    };
  });
}

export function parseOfferDraftsToQuotes(
  drafts: BankOfferDraft[],
  totalConsultationAmount: number
): {
  quotes: ExchangeQuote[];
  errors: string[];
} {
  const quotes: ExchangeQuote[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (const draft of drafts) {
    const rawRate = (draft.rate || '').trim().replace(',', '.');
    const hasRate = rawRate.length > 0;

    if (!hasRate) {
      // Aucune cote saisie pour cette banque => banque n'a pas soumissionné
      continue;
    }

    const parsedRate = Number(rawRate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      errors.push(`Le cours saisi pour ${draft.bankName} doit être un nombre strictement positif.`);
      continue;
    }

    let amount: number;
    if (draft.isFullAmount) {
      amount = Number(totalConsultationAmount.toFixed(2));
    } else {
      const rawAmount = (draft.proposedAmount || '').trim().replace(/\s+/g, '').replace(',', '.');
      amount = Number(rawAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push(`Veuillez saisir un montant proposé valide pour ${draft.bankName}.`);
        continue;
      }
      if (amount > totalConsultationAmount + 0.001) {
        errors.push(
          `Le montant proposé par ${draft.bankName} (${amount}) dépasse le montant de la consultation (${totalConsultationAmount}).`
        );
        continue;
      }
      amount = Number(amount.toFixed(2));
    }

    quotes.push({
      bankId: draft.bankId,
      bankName: draft.bankName,
      bankCode: draft.bankCode,
      isFullAmount: draft.isFullAmount,
      proposedAmount: amount,
      rate: Number(parsedRate.toFixed(4)),
      feesTnd: 0,
      validityMinutes: 10,
      receivedAt: now,
      notes: draft.notes?.trim() || undefined,
    });
  }

  return { quotes, errors };
}

/**
 * Classe les offres bancaires reçues du MOINS-DISANT (cours le plus bas pour acheter la devise)
 * vers le PLUS-DISANT (cours le plus élevé).
 * À égalité de cours, l'offre couvrant le montant le plus élevé est prioritaire.
 */
export function rankBankOffers(
  quotes: ExchangeQuote[],
  totalConsultationAmount: number
): RankedBankOffer[] {
  const validQuotes = (quotes || []).filter(q => {
    const rate = Number(q.rate);
    const amount = Number(q.proposedAmount ?? totalConsultationAmount);
    return Number.isFinite(rate) && rate > 0 && Number.isFinite(amount) && amount > 0;
  });

  if (validQuotes.length === 0) return [];

  const sorted = [...validQuotes].sort((a, b) => {
    const rateDiff = Number(a.rate) - Number(b.rate);
    if (Math.abs(rateDiff) > 1e-6) {
      return rateDiff;
    }
    const amtA = Number(a.proposedAmount ?? totalConsultationAmount);
    const amtB = Number(b.proposedAmount ?? totalConsultationAmount);
    if (Math.abs(amtB - amtA) > 0.01) {
      return amtB - amtA;
    }
    return a.bankName.localeCompare(b.bankName, 'fr');
  });

  const bestRate = Number(sorted[0].rate);

  return sorted.map((q, index) => {
    const proposedAmount = Number(
      (q.proposedAmount !== undefined ? q.proposedAmount : totalConsultationAmount).toFixed(2)
    );
    const isFullAmount =
      q.isFullAmount !== undefined
        ? q.isFullAmount
        : Math.abs(proposedAmount - totalConsultationAmount) < 0.01;
    const rate = Number(q.rate);
    const spreadVsBestRate = Number((rate - bestRate).toFixed(4));
    const counterValueTnd = Number((proposedAmount * rate).toFixed(3));
    const coveragePercent =
      totalConsultationAmount > 0
        ? Number(Math.min(100, (proposedAmount / totalConsultationAmount) * 100).toFixed(1))
        : 0;
    const extraCostOnFullAmountTnd = Number(
      ((rate - bestRate) * totalConsultationAmount).toFixed(3)
    );

    return {
      ...q,
      proposedAmount,
      isFullAmount,
      rank: index + 1,
      isLowestRate: index === 0,
      isHighestRate: sorted.length > 1 && index === sorted.length - 1,
      counterValueTnd,
      coveragePercent,
      spreadVsBestRate,
      extraCostOnFullAmountTnd,
    };
  });
}

export function computeOfferRankingSummary(
  rankedOffers: RankedBankOffer[],
  totalConsultationAmount: number
): OfferRankingSummary {
  if (rankedOffers.length === 0) {
    return {
      count: 0,
      bestOffer: null,
      worstOffer: null,
      maxSpreadRate: 0,
      potentialSavingsTnd: 0,
      fullCoverageCount: 0,
      allocationSteps: [],
      remainingUncoveredAmount: totalConsultationAmount,
    };
  }

  const bestOffer = rankedOffers[0];
  const worstOffer = rankedOffers[rankedOffers.length - 1];
  const maxSpreadRate = Number((worstOffer.rate - bestOffer.rate).toFixed(4));
  const potentialSavingsTnd = Number((maxSpreadRate * totalConsultationAmount).toFixed(3));
  const fullCoverageCount = rankedOffers.filter(o => o.isFullAmount).length;

  let remaining = totalConsultationAmount;
  const allocationSteps: CoverageAllocationStep[] = [];
  for (const offer of rankedOffers) {
    if (remaining <= 0.001) break;
    const take = Number(Math.min(remaining, offer.proposedAmount).toFixed(2));
    if (take > 0) {
      allocationSteps.push({
        rank: offer.rank,
        bankId: offer.bankId,
        bankName: offer.bankName,
        rate: offer.rate,
        allocatedAmount: take,
        counterValueTnd: Number((take * offer.rate).toFixed(3)),
      });
      remaining = Number((remaining - take).toFixed(2));
    }
  }

  return {
    count: rankedOffers.length,
    bestOffer,
    worstOffer,
    maxSpreadRate,
    potentialSavingsTnd,
    fullCoverageCount,
    allocationSteps,
    remainingUncoveredAmount: Math.max(0, remaining),
  };
}
