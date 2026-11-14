import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoicePaymentSummary,
  validateOrderAgainstInvoice,
  getAvailableInvoicesForOrder,
} from './invoiceUtils';
import { Invoice, PaymentOrder } from '../types/payment';

const BASE_INVOICE: Invoice = {
  id: 'inv_1',
  invoiceNumber: 'FAC-2026-0100',
  invoiceDate: '2026-02-01',
  contractNumber: 'CT-2026/01',
  purpose: 'Importation tabac brut',
  operationNature: 'Importation tabac brut',
  supplierId: 'sup_1',
  supplierName: 'Universal Leaf Tobacco',
  supplierCountry: 'États-Unis',
  supplierAddress: 'Richmond VA',
  supplierBank: 'JPMorgan',
  supplierIban: 'US89CHAS123',
  supplierSwift: 'CHASUS33',
  currency: 'USD',
  totalAmount: 100000,
  createdAt: '2026-02-01T10:00:00Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  isDemo: false,
};

const makeOrder = (overrides: Partial<PaymentOrder>): PaymentOrder => ({
  id: 'ord_1',
  orderNumber: '001-026-0001',
  createdAt: '2026-02-02T10:00:00Z',
  updatedAt: '2026-02-02T10:00:00Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  purpose: 'Tranche 1',
  beneficiaryName: 'Universal Leaf Tobacco',
  beneficiaryCountry: 'États-Unis',
  beneficiaryAddress: 'Richmond VA',
  beneficiaryBank: 'JPMorgan',
  beneficiaryIban: 'US89CHAS123',
  beneficiarySwift: 'CHASUS33',
  currency: 'USD',
  amount: 40000,
  amountInWords: 'quarante mille dollars',
  transferPurpose: 'Tranche 1',
  invoiceNumber: 'FAC-2026-0100',
  invoiceDate: '2026-02-01',
  operationNature: 'Importation tabac brut',
  bankId: 'bank_stb',
  bankName: 'STB',
  bankBranch: 'Kairouan',
  bankFileRef: 'REF-1',
  status: 'SAISI',
  history: [],
  documents: [],
  isDemo: false,
  ...overrides,
});

test('computeInvoicePaymentSummary handles unpaid, partially paid (multiple orders), and fully paid invoices', () => {
  const unpaid = computeInvoicePaymentSummary(BASE_INVOICE, []);
  assert.equal(unpaid.paymentStatus, 'NON_PAYEE');
  assert.equal(unpaid.allocatedAmount, 0);
  assert.equal(unpaid.remainingAmount, 100000);
  assert.equal(unpaid.progressPercent, 0);

  const ord1 = makeOrder({ id: 'ord_1', invoiceId: 'inv_1', amount: 40000, status: 'EXECUTE' });
  const ordCancelled = makeOrder({ id: 'ord_canc', invoiceId: 'inv_1', amount: 60000, status: 'ANNULE' });
  const partial = computeInvoicePaymentSummary(BASE_INVOICE, [ord1, ordCancelled]);
  assert.equal(partial.paymentStatus, 'PARTIELLEMENT_PAYEE');
  assert.equal(partial.allocatedAmount, 40000);
  assert.equal(partial.executedAmount, 40000);
  assert.equal(partial.remainingAmount, 60000);
  assert.equal(partial.progressPercent, 40);
  assert.equal(partial.linkedOrders.length, 1);

  const ord2 = makeOrder({ id: 'ord_2', invoiceId: 'inv_1', amount: 60000, status: 'SAISI' });
  const paid = computeInvoicePaymentSummary(BASE_INVOICE, [ord1, ord2]);
  assert.equal(paid.paymentStatus, 'PAYEE');
  assert.equal(paid.allocatedAmount, 100000);
  assert.equal(paid.remainingAmount, 0);
  assert.equal(paid.progressPercent, 100);
  assert.equal(paid.linkedOrders.length, 2);
});

test('validateOrderAgainstInvoice prevents currency mismatch and exceeding remaining balance', () => {
  const ord1 = makeOrder({ id: 'ord_1', invoiceId: 'inv_1', amount: 70000 });

  const badCurrency = validateOrderAgainstInvoice(BASE_INVOICE, [ord1], 20000, 'EUR');
  assert.equal(badCurrency.valid, false);
  assert.match(badCurrency.error || '', /devise/i);

  const tooHigh = validateOrderAgainstInvoice(BASE_INVOICE, [ord1], 35000, 'USD');
  assert.equal(tooHigh.valid, false);
  assert.match(tooHigh.error || '', /dépasse le solde restant/i);

  const validTranche = validateOrderAgainstInvoice(BASE_INVOICE, [ord1], 30000, 'USD');
  assert.equal(validTranche.valid, true);
  assert.equal(validTranche.summary.remainingAmount, 30000);
});

test('getAvailableInvoicesForOrder excludes fully paid invoices', () => {
  const paidInv: Invoice = { ...BASE_INVOICE, id: 'inv_paid', invoiceNumber: 'FAC-PAID', totalAmount: 50000 };
  const openInv: Invoice = { ...BASE_INVOICE, id: 'inv_open', invoiceNumber: 'FAC-OPEN', totalAmount: 80000 };
  const orders = [
    makeOrder({ id: 'o1', invoiceId: 'inv_paid', invoiceNumber: 'FAC-PAID', amount: 50000 }),
    makeOrder({ id: 'o2', invoiceId: 'inv_open', invoiceNumber: 'FAC-OPEN', amount: 25000 }),
  ];

  const available = getAvailableInvoicesForOrder([paidInv, openInv], orders);
  assert.equal(available.length, 1);
  assert.equal(available[0].invoice.id, 'inv_open');
  assert.equal(available[0].summary.remainingAmount, 55000);
});
