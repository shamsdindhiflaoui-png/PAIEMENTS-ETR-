import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterConsultations,
  sortConsultations,
  getConsultationBeneficiarySummary,
  getConsultationFiscalYears,
} from './consultationFilters';
import { CurrencyConsultation, PaymentOrder } from '../types/payment';

const sampleOrders: PaymentOrder[] = [
  {
    id: 'ord_1',
    orderNumber: '001 DFC 001 2026 0001',
    createdAt: '2026-02-10T09:00:00.000Z',
    updatedAt: '2026-02-10T09:00:00.000Z',
    createdBy: 'Sami',
    createdById: 'u_1',
    fiscalYear: 2026,
    supplierId: 'sup_1',
    beneficiaryName: 'ALLIANCE ONE INTERNATIONAL',
    beneficiaryCountry: 'Belgique',
    beneficiaryAddress: 'Brussels',
    beneficiaryBank: 'ING',
    beneficiaryIban: 'BE12',
    beneficiarySwift: 'BBRUBEBB',
    amount: 120000,
    amountInWords: 'cent vingt mille euros',
    currency: 'EUR',
    purpose: 'Tabac brut Virginie',
    transferPurpose: 'Tabac brut Virginie',
    invoiceNumber: 'FAC-100',
    invoiceDate: '2026-02-01',
    operationNature: 'Importation',
    bankId: 'bank_stb',
    bankName: 'STB',
    bankBranch: 'Kairouan',
    bankFileRef: 'REF-1',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    documents: [],
    history: [],
    isDemo: false,
  },
  {
    id: 'ord_2',
    orderNumber: '001 DFC 001 2026 0002',
    createdAt: '2026-03-05T10:00:00.000Z',
    updatedAt: '2026-03-05T10:00:00.000Z',
    createdBy: 'Sami',
    createdById: 'u_1',
    fiscalYear: 2026,
    supplierId: 'sup_2',
    beneficiaryName: 'UNIVERSAL LEAF',
    beneficiaryCountry: 'Suisse',
    beneficiaryAddress: 'Geneva',
    beneficiaryBank: 'UBS',
    beneficiaryIban: 'CH12',
    beneficiarySwift: 'UBSWCHZH',
    amount: 85000,
    amountInWords: 'quatre-vingt-cinq mille dollars',
    currency: 'USD',
    purpose: 'Feuilles tabac Burley',
    transferPurpose: 'Feuilles tabac Burley',
    invoiceNumber: 'FAC-200',
    invoiceDate: '2026-03-01',
    operationNature: 'Importation',
    bankId: 'bank_biat',
    bankName: 'BIAT',
    bankBranch: 'Kairouan',
    bankFileRef: 'REF-2',
    requiresRateNegotiation: true,
    status: 'DEPOSE_BANQUE',
    documents: [],
    history: [],
    isDemo: false,
  },
];

const sampleConsultations: CurrencyConsultation[] = [
  {
    id: 'cons_1',
    consultationNumber: 'CONS-2026-0001',
    createdAt: '2026-02-12T10:00:00.000Z',
    createdBy: 'Nadia Trésorerie',
    createdById: 'u_2',
    orderIds: ['ord_1'],
    orderNumbers: ['001 DFC 001 2026 0001'],
    currency: 'EUR',
    totalAmount: 120000,
    operationDate: '2026-02-12',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    consultedBankIds: ['bank_stb', 'bank_bna'],
    status: 'CLOTUREE',
    selectedBankId: 'bank_bna',
    selectedBankName: 'Banque Nationale Agricole (BNA)',
    negotiatedRate: 3.3185,
    confirmationRef: '101/26',
    quotes: [
      {
        bankId: 'bank_bna',
        bankName: 'BNA',
        rate: 3.3185,
        receivedAt: '2026-02-12T14:00:00.000Z',
      },
    ],
    isDemo: false,
  },
  {
    id: 'cons_2',
    consultationNumber: 'CONS-2025-0009',
    createdAt: '2025-11-20T09:00:00.000Z',
    createdBy: 'Amine Finance',
    createdById: 'u_3',
    orderIds: ['ord_2'],
    orderNumbers: ['001 DFC 001 2026 0002'],
    currency: 'USD',
    totalAmount: 85000,
    operationDate: '2025-11-20',
    purchaseType: 'à terme 30 jours',
    submissionDeadlineTime: '11h00',
    validityDeadlineTime: '11h15',
    consultedBankIds: ['bank_biat'],
    status: 'OUVERTE',
    quotes: [],
    isDemo: true,
  },
];

test('filterConsultations filters by searchQuery (beneficiary, consultation number, bank, confirmation ref)', () => {
  const byBeneficiary = filterConsultations(sampleConsultations, sampleOrders, {
    searchQuery: 'alliance one',
  });
  assert.equal(byBeneficiary.length, 1);
  assert.equal(byBeneficiary[0].id, 'cons_1');

  const byRef = filterConsultations(sampleConsultations, sampleOrders, {
    searchQuery: '101/26',
  });
  assert.equal(byRef.length, 1);
  assert.equal(byRef[0].id, 'cons_1');

  const byOrderNumber = filterConsultations(sampleConsultations, sampleOrders, {
    searchQuery: '0002',
  });
  assert.equal(byOrderNumber.length, 1);
  assert.equal(byOrderNumber[0].id, 'cons_2');
});

test('filterConsultations filters by status, currency, bank, and fiscalYear', () => {
  assert.equal(
    filterConsultations(sampleConsultations, sampleOrders, { status: 'OUVERTE' }).length,
    1
  );
  assert.equal(
    filterConsultations(sampleConsultations, sampleOrders, { currency: 'EUR' })[0].id,
    'cons_1'
  );
  assert.equal(
    filterConsultations(sampleConsultations, sampleOrders, { bank: 'bank_bna' })[0].id,
    'cons_1'
  );
  assert.equal(
    filterConsultations(sampleConsultations, sampleOrders, { fiscalYear: '2025' })[0].id,
    'cons_2'
  );
});

test('sortConsultations sorts ascending and descending across fields', () => {
  const byAmountAsc = sortConsultations(sampleConsultations, 'totalAmount', 'asc');
  assert.deepEqual(
    byAmountAsc.map(c => c.id),
    ['cons_2', 'cons_1']
  );

  const byOpDateDesc = sortConsultations(sampleConsultations, 'operationDate', 'desc');
  assert.deepEqual(
    byOpDateDesc.map(c => c.id),
    ['cons_1', 'cons_2']
  );

  const byNumAsc = sortConsultations(sampleConsultations, 'consultationNumber', 'asc');
  assert.deepEqual(
    byNumAsc.map(c => c.id),
    ['cons_2', 'cons_1']
  );
});

test('getConsultationBeneficiarySummary handles single, multi, and missing orders', () => {
  const singleSummary = getConsultationBeneficiarySummary(sampleConsultations[0], sampleOrders);
  assert.equal(singleSummary.primaryLabel, 'ALLIANCE ONE INTERNATIONAL');
  assert.deepEqual(singleSummary.orderNumbers, ['001 DFC 001 2026 0001']);

  const multiConsultation: CurrencyConsultation = {
    ...sampleConsultations[0],
    orderIds: ['ord_1', 'ord_2'],
    orderNumbers: ['001 DFC 001 2026 0001', '001 DFC 001 2026 0002'],
  };
  const multiSummary = getConsultationBeneficiarySummary(multiConsultation, sampleOrders);
  assert.equal(multiSummary.primaryLabel, 'ALLIANCE ONE INTERNATIONAL + 1 autre');

  const missingSummary = getConsultationBeneficiarySummary(
    { ...sampleConsultations[0], orderIds: ['unknown'], orderNumbers: ['ORD-X'] },
    sampleOrders
  );
  assert.equal(missingSummary.primaryLabel, '1 ordre regroupé');
});

test('getConsultationFiscalYears returns unique sorted years', () => {
  assert.deepEqual(getConsultationFiscalYears(sampleConsultations), ['2026', '2025']);
  assert.deepEqual(getConsultationFiscalYears([]), ['2026', '2025']);
});
