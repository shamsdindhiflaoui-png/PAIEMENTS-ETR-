import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatConsultationDate,
  formatConsultationAmount,
  formatConsultationTime,
  validateConsultationSelection,
  buildConsultationPdfDocument,
} from './consultationPdf';
import { PaymentOrder, CurrencyConsultation } from '../types/payment';

function makeOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 'ord_1',
    orderNumber: '001-026-0001',
    createdAt: '2026-11-12T08:00:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    purpose: 'Achat matières premières',
    beneficiaryName: 'Supplier',
    beneficiaryCountry: 'France',
    beneficiaryAddress: 'Paris',
    beneficiaryBank: 'BNP',
    beneficiaryIban: 'FR76...',
    beneficiarySwift: 'BNPAFRPP',
    currency: 'USD',
    amount: 24000,
    amountInWords: 'vingt-quatre mille dollars',
    transferPurpose: 'Facture',
    invoiceNumber: 'FAC-1',
    invoiceDate: '2026-11-10',
    operationNature: 'Importation',
    bankId: 'bank_stb',
    bankName: 'STB',
    bankBranch: 'Kairouan',
    bankFileRef: 'STB-1',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    history: [],
    documents: [],
    isDemo: false,
    ...overrides,
  };
}

test('formatConsultationDate converts YYYY-MM-DD to DD/MM/YYYY', () => {
  assert.equal(formatConsultationDate('2026-11-12'), '12/11/2026');
  assert.equal(formatConsultationDate('2026-02-05T10:30:00.000Z'), '05/02/2026');
});

test('formatConsultationAmount formats thousands with space and 2 decimals', () => {
  assert.equal(formatConsultationAmount(39000, 'USD'), '39 000.00 USD');
  assert.equal(formatConsultationAmount(54300.5, 'EUR'), '54 300.50 EUR');
});

test('formatConsultationTime normalizes HH:MM to HHhMM', () => {
  assert.equal(formatConsultationTime('14:20'), '14h20');
  assert.equal(formatConsultationTime('14h30'), '14h30');
});

test('validateConsultationSelection groups multiple eligible orders of same currency', () => {
  const res = validateConsultationSelection([
    makeOrder({ id: 'o1', orderNumber: 'OP-1', amount: 24000, currency: 'USD' }),
    makeOrder({ id: 'o2', orderNumber: 'OP-2', amount: 15000, currency: 'USD' }),
  ]);
  assert.equal(res.valid, true);
  assert.equal(res.currency, 'USD');
  assert.equal(res.totalAmount, 39000);
});

test('validateConsultationSelection rejects mixed currencies or non-eligible status', () => {
  const mixed = validateConsultationSelection([
    makeOrder({ id: 'o1', currency: 'USD', amount: 10000 }),
    makeOrder({ id: 'o2', currency: 'EUR', amount: 20000 }),
  ]);
  assert.equal(mixed.valid, false);

  const wrongStatus = validateConsultationSelection([
    makeOrder({ id: 'o1', status: 'DEPOSE_BANQUE' }),
  ]);
  assert.equal(wrongStatus.valid, false);
});

test('buildConsultationPdfDocument generates a valid non-empty PDF buffer', () => {
  const consultation: CurrencyConsultation = {
    id: 'cons_1',
    consultationNumber: 'CONS-2026-0001',
    createdAt: '2026-11-12T10:00:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['o1', 'o2'],
    orderNumbers: ['OP-2026-0006', 'OP-2026-0007'],
    currency: 'USD',
    totalAmount: 39000,
    operationDate: '2026-11-12',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'OUVERTE',
    isDemo: false,
  };

  const doc = buildConsultationPdfDocument(consultation);
  const arrayBuffer = doc.output('arraybuffer');
  assert.ok(arrayBuffer.byteLength > 1000);
  const header = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 5)));
  assert.equal(header, '%PDF-');
});
