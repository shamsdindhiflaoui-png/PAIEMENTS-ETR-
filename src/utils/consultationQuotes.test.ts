import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialOfferDrafts,
  parseOfferDraftsToQuotes,
  rankBankOffers,
  computeOfferRankingSummary,
} from './consultationQuotes';
import { Bank, CurrencyConsultation, ExchangeQuote } from '../types/payment';

const SAMPLE_BANKS: Bank[] = [
  { id: 'bank_stb', code: 'STB', name: 'Société Tunisienne de Banque', swiftCode: 'STBKTNTT', country: 'Tunisie', active: true, contactAgency: 'Kairouan' },
  { id: 'bank_bna', code: 'BNA', name: 'Banque Nationale Agricole', swiftCode: 'BNTETNTT', country: 'Tunisie', active: true, contactAgency: 'Kairouan' },
  { id: 'bank_biat', code: 'BIAT', name: 'Banque Internationale Arabe de Tunisie', swiftCode: 'BIATTNTT', country: 'Tunisie', active: true, contactAgency: 'Kairouan' },
];

const SAMPLE_CONSULTATION: CurrencyConsultation = {
  id: 'cons_test',
  consultationNumber: 'CONS-2026-0001',
  createdAt: '2026-11-12T10:00:00.000Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  orderIds: ['ord_06', 'ord_07'],
  orderNumbers: ['OP-2026-0006', 'OP-2026-0007'],
  currency: 'USD',
  totalAmount: 39000,
  operationDate: '2026-11-12',
  purchaseType: 'au comptant',
  submissionDeadlineTime: '14h20',
  validityDeadlineTime: '14h30',
  consultedBankIds: ['bank_stb', 'bank_bna', 'bank_biat'],
  status: 'OUVERTE',
  quotes: [],
  isDemo: true,
};

test('buildInitialOfferDrafts initializes banks with Montant total checked by default', () => {
  const drafts = buildInitialOfferDrafts(SAMPLE_BANKS, SAMPLE_CONSULTATION);
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0].isFullAmount, true);
  assert.equal(drafts[0].proposedAmount, '39000');
  assert.equal(drafts[0].rate, '');
});

test('parseOfferDraftsToQuotes handles full amount checked vs custom partial amount', () => {
  const drafts = [
    {
      bankId: 'bank_stb',
      bankName: 'Société Tunisienne de Banque',
      bankCode: 'STB',
      isFullAmount: true,
      proposedAmount: '12345', // ignored because isFullAmount is true
      rate: '3.1180',
    },
    {
      bankId: 'bank_bna',
      bankName: 'Banque Nationale Agricole',
      bankCode: 'BNA',
      isFullAmount: false,
      proposedAmount: '20000',
      rate: '3.1090',
    },
    {
      bankId: 'bank_biat',
      bankName: 'BIAT',
      bankCode: 'BIAT',
      isFullAmount: true,
      proposedAmount: '39000',
      rate: '', // no offer submitted
    },
  ];

  const { quotes, errors } = parseOfferDraftsToQuotes(drafts, 39000);
  assert.equal(errors.length, 0);
  assert.equal(quotes.length, 2);
  assert.equal(quotes[0].proposedAmount, 39000);
  assert.equal(quotes[0].isFullAmount, true);
  assert.equal(quotes[1].proposedAmount, 20000);
  assert.equal(quotes[1].isFullAmount, false);
});

test('parseOfferDraftsToQuotes rejects invalid or excessive partial amount', () => {
  const drafts = [
    {
      bankId: 'bank_bna',
      bankName: 'Banque Nationale Agricole',
      isFullAmount: false,
      proposedAmount: '45000',
      rate: '3.1100',
    },
  ];
  const { quotes, errors } = parseOfferDraftsToQuotes(drafts, 39000);
  assert.equal(quotes.length, 0);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('dépasse le montant'));
});

test('rankBankOffers orders offers from moins-disant (lowest rate) to plus-disant (highest rate)', () => {
  const quotes: ExchangeQuote[] = [
    {
      bankId: 'bank_stb',
      bankName: 'STB',
      isFullAmount: true,
      proposedAmount: 39000,
      rate: 3.124,
      receivedAt: '2026-11-12T14:05:00.000Z',
    },
    {
      bankId: 'bank_biat',
      bankName: 'BIAT',
      isFullAmount: false,
      proposedAmount: 20000,
      rate: 3.108,
      receivedAt: '2026-11-12T14:08:00.000Z',
    },
    {
      bankId: 'bank_bna',
      bankName: 'BNA',
      isFullAmount: true,
      proposedAmount: 39000,
      rate: 3.115,
      receivedAt: '2026-11-12T14:10:00.000Z',
    },
  ];

  const ranked = rankBankOffers(quotes, 39000);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].bankName, 'BIAT');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].isLowestRate, true);
  assert.equal(ranked[0].spreadVsBestRate, 0);
  assert.equal(ranked[1].bankName, 'BNA');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[1].spreadVsBestRate, 0.007);
  assert.equal(ranked[2].bankName, 'STB');
  assert.equal(ranked[2].rank, 3);
  assert.equal(ranked[2].isHighestRate, true);

  const summary = computeOfferRankingSummary(ranked, 39000);
  assert.equal(summary.bestOffer?.bankName, 'BIAT');
  assert.equal(summary.worstOffer?.bankName, 'STB');
  assert.equal(summary.maxSpreadRate, 0.016);
  assert.equal(summary.allocationSteps.length, 2);
  assert.equal(summary.allocationSteps[0].allocatedAmount, 20000);
  assert.equal(summary.allocationSteps[1].allocatedAmount, 19000);
  assert.equal(summary.remainingUncoveredAmount, 0);
});

test('rankBankOffers breaks ties in favor of higher proposed amount', () => {
  const quotes: ExchangeQuote[] = [
    {
      bankId: 'bank_a',
      bankName: 'Banque A',
      isFullAmount: false,
      proposedAmount: 15000,
      rate: 3.11,
      receivedAt: '2026-11-12T14:00:00.000Z',
    },
    {
      bankId: 'bank_b',
      bankName: 'Banque B',
      isFullAmount: true,
      proposedAmount: 39000,
      rate: 3.11,
      receivedAt: '2026-11-12T14:00:00.000Z',
    },
  ];
  const ranked = rankBankOffers(quotes, 39000);
  assert.equal(ranked[0].bankName, 'Banque B');
  assert.equal(ranked[1].bankName, 'Banque A');
});
