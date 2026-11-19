import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoiceAxisMetrics,
  computeConsultationAxisMetrics,
  computeDashboardStatsFromOrders,
  filterOrders,
} from './dashboardMetrics';
import { CurrencyConsultation, Invoice, PaymentOrder } from '../types/payment';

const sampleInvoices: Invoice[] = [
  {
    id: 'inv_1',
    invoiceNumber: 'FAC-001',
    invoiceDate: '2026-01-15',
    supplierName: 'Supplier A',
    supplierCountry: 'USA',
    supplierAddress: 'Addr 1',
    supplierBank: 'Bank A',
    supplierIban: 'US1',
    supplierSwift: 'SWIFT1',
    currency: 'USD',
    totalAmount: 100000,
    operationNature: 'Importation tabac brut',
    purpose: 'Lot 1',
    createdAt: '2026-01-15T10:00:00Z',
    createdBy: 'Monia',
    createdById: 'usr_1',
    isDemo: true,
  },
  {
    id: 'inv_2',
    invoiceNumber: 'FAC-002',
    invoiceDate: '2026-02-10',
    supplierName: 'Supplier B',
    supplierCountry: 'DE',
    supplierAddress: 'Addr 2',
    supplierBank: 'Bank B',
    supplierIban: 'DE1',
    supplierSwift: 'SWIFT2',
    currency: 'EUR',
    totalAmount: 50000,
    operationNature: 'Pièces',
    purpose: 'Lot 2',
    createdAt: '2026-02-10T10:00:00Z',
    createdBy: 'Monia',
    createdById: 'usr_1',
    isDemo: true,
  },
  {
    id: 'inv_3',
    invoiceNumber: 'FAC-003',
    invoiceDate: '2025-11-05',
    supplierName: 'Supplier C',
    supplierCountry: 'FR',
    supplierAddress: 'Addr 3',
    supplierBank: 'Bank C',
    supplierIban: 'FR1',
    supplierSwift: 'SWIFT3',
    currency: 'EUR',
    totalAmount: 20000,
    operationNature: 'Arômes',
    purpose: 'Lot 2025',
    createdAt: '2025-11-05T10:00:00Z',
    createdBy: 'Monia',
    createdById: 'usr_1',
    isDemo: false,
  },
];

const sampleOrders: PaymentOrder[] = [
  {
    id: 'ord_1',
    orderNumber: 'OP-2026-0001',
    fiscalYear: 2026,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-01-20T10:00:00Z',
    createdBy: 'Monia',
    createdById: 'usr_1',
    purpose: 'Tranche 1',
    beneficiaryName: 'Supplier A',
    beneficiaryCountry: 'USA',
    beneficiaryAddress: 'Addr 1',
    beneficiaryBank: 'Bank A',
    beneficiaryIban: 'US1',
    beneficiarySwift: 'SWIFT1',
    invoiceId: 'inv_1',
    currency: 'USD',
    amount: 40000,
    amountInWords: 'quarante mille dollars',
    transferPurpose: 'Tranche 1',
    invoiceNumber: 'FAC-001',
    invoiceDate: '2026-01-15',
    operationNature: 'Importation tabac brut',
    bankId: 'bnk_stb',
    bankName: 'STB',
    bankBranch: 'Kairouan',
    bankFileRef: 'REF1',
    status: 'EXECUTE',
    documents: [],
    history: [],
    isDemo: true,
  },
  {
    id: 'ord_2',
    orderNumber: 'OP-2026-0002',
    fiscalYear: 2026,
    createdAt: '2026-02-12T10:00:00Z',
    updatedAt: '2026-02-12T10:00:00Z',
    createdBy: 'Monia',
    createdById: 'usr_1',
    purpose: 'Solde Fac 2',
    beneficiaryName: 'Supplier B',
    beneficiaryCountry: 'DE',
    beneficiaryAddress: 'Addr 2',
    beneficiaryBank: 'Bank B',
    beneficiaryIban: 'DE1',
    beneficiarySwift: 'SWIFT2',
    invoiceId: 'inv_2',
    currency: 'EUR',
    amount: 50000,
    amountInWords: 'cinquante mille euros',
    transferPurpose: 'Solde',
    invoiceNumber: 'FAC-002',
    invoiceDate: '2026-02-10',
    operationNature: 'Pièces',
    bankId: 'bnk_biat',
    bankName: 'BIAT',
    bankBranch: 'Kairouan',
    bankFileRef: 'REF2',
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    requiresRateNegotiation: true,
    documents: [],
    history: [],
    isDemo: true,
  },
  {
    id: 'ord_3',
    orderNumber: 'OP-2026-0003',
    fiscalYear: 2026,
    createdAt: '2026-02-14T10:00:00Z',
    updatedAt: '2026-02-14T10:00:00Z',
    createdBy: 'Monia',
    createdById: 'usr_1',
    purpose: 'Achat direct',
    beneficiaryName: 'Supplier A',
    beneficiaryCountry: 'USA',
    beneficiaryAddress: 'Addr 1',
    beneficiaryBank: 'Bank A',
    beneficiaryIban: 'US1',
    beneficiarySwift: 'SWIFT1',
    currency: 'USD',
    amount: 25000,
    amountInWords: 'vingt cinq mille dollars',
    transferPurpose: 'Achat',
    invoiceNumber: 'FAC-999',
    invoiceDate: '2026-02-14',
    operationNature: 'Tabac',
    bankId: 'bnk_stb',
    bankName: 'STB',
    bankBranch: 'Kairouan',
    bankFileRef: 'REF3',
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    requiresRateNegotiation: true,
    documents: [],
    history: [],
    isDemo: true,
  },
];

const sampleConsultations: CurrencyConsultation[] = [
  {
    id: 'cons_1',
    consultationNumber: 'CONS-2026-0001',
    createdAt: '2026-02-13T09:00:00Z',
    createdBy: 'Samir',
    createdById: 'usr_rf',
    orderIds: ['ord_2'],
    orderNumbers: ['OP-2026-0002'],
    currency: 'EUR',
    totalAmount: 50000,
    operationDate: '2026-02-13',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '11h00',
    validityDeadlineTime: '11h30',
    status: 'CLOTUREE',
    selectedBankId: 'bnk_biat',
    selectedBankName: 'Banque Internationale Arabe de Tunisie',
    negotiatedRate: 3.31,
    quotes: [
      { bankId: 'bnk_biat', bankName: 'Banque Internationale Arabe de Tunisie', rate: 3.31, proposedAmount: 50000, isFullAmount: true, receivedAt: '2026-02-13T10:30:00Z' },
      { bankId: 'bnk_stb', bankName: 'Société Tunisienne de Banque', rate: 3.33, proposedAmount: 50000, isFullAmount: true, receivedAt: '2026-02-13T10:35:00Z' },
    ],
    isDemo: true,
  },
  {
    id: 'cons_2',
    consultationNumber: 'CONS-2026-0002',
    createdAt: '2026-02-15T09:00:00Z',
    createdBy: 'Samir',
    createdById: 'usr_rf',
    orderIds: [],
    orderNumbers: [],
    currency: 'USD',
    totalAmount: 30000,
    operationDate: '2026-02-15',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h00',
    validityDeadlineTime: '14h30',
    status: 'OUVERTE',
    isDemo: true,
  },
];

test('computeInvoiceAxisMetrics computes totals, status counts, and respects fiscal/currency filters', () => {
  const all = computeInvoiceAxisMetrics(sampleInvoices, sampleOrders, { fiscalYear: 'ALL', currency: 'ALL' });
  assert.equal(all.totalCount, 3);
  assert.equal(all.unpaidCount, 1); // inv_3
  assert.equal(all.partialCount, 1); // inv_1 (40k / 100k)
  assert.equal(all.paidCount, 1); // inv_2 (50k / 50k)
  assert.equal(all.totalByCurrency.USD, 100000);
  assert.equal(all.allocatedByCurrency.USD, 40000);
  assert.equal(all.remainingByCurrency.USD, 60000);
  assert.equal(all.totalByCurrency.EUR, 70000);

  const only2026Eur = computeInvoiceAxisMetrics(sampleInvoices, sampleOrders, {
    fiscalYear: 2026,
    currency: 'EUR',
  });
  assert.equal(only2026Eur.totalCount, 1);
  assert.equal(only2026Eur.paidCount, 1);
  assert.equal(only2026Eur.totalByCurrency.EUR, 50000);
});

test('computeConsultationAxisMetrics computes open/closed counts, savings, pending orders, and bank awards', () => {
  const metrics = computeConsultationAxisMetrics(sampleConsultations, sampleOrders, {
    fiscalYear: 'ALL',
    currency: 'ALL',
  });
  assert.equal(metrics.totalCount, 2);
  assert.equal(metrics.closedCount, 1);
  assert.equal(metrics.openCount, 1);
  // ord_2 is already in cons_1; ord_3 is EN_ATTENTE_ACHAT_DEVISE without active consultation
  assert.equal(metrics.pendingOrdersToConsultCount, 1);
  // Savings: (3.33 - 3.31) * 50000 = 1000 TND
  assert.equal(metrics.totalSavingsTnd, 1000);
  assert.equal(metrics.totalCounterValueTnd, 165500);
  assert.equal(metrics.bankAwards.length, 1);
  assert.equal(metrics.bankAwards[0].bankName, 'Banque Internationale Arabe de Tunisie');
  assert.equal(metrics.bankAwards[0].winsCount, 1);
});

test('filterOrders and computeDashboardStatsFromOrders filter and aggregate order KPIs accurately', () => {
  const usdOrders = filterOrders(sampleOrders, { currency: 'USD', fiscalYear: 2026 });
  assert.equal(usdOrders.length, 2);

  const stats = computeDashboardStatsFromOrders(sampleOrders);
  assert.equal(stats.totalOrders, 3);
  assert.equal(stats.totalUsdAmount, 65000);
  assert.equal(stats.totalEurAmount, 50000);
  assert.equal(stats.executedCount, 1);
  assert.equal(stats.pendingExchangeCount, 2);
  assert.equal(stats.ordersByBank['STB']?.count, 2);
  assert.equal(stats.ordersByBank['BIAT']?.count, 1);
});

