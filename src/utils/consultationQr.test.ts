import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CurrencyConsultation,
  Invoice,
  PaymentOrder,
} from '../types/payment';
import {
  buildConsultationQrPayload,
  buildPurchaseConfirmationQrPayload,
  getQrCodeMatrix,
} from './consultationQr';
import { buildConsultationPdfDocument } from './consultationPdf';
import {
  buildPurchaseConfirmations,
  buildPurchaseConfirmationPdfDocument,
} from './purchaseConfirmationPdf';

const SAMPLE_INVOICE: Invoice = {
  id: 'inv_1',
  invoiceNumber: 'FAC-2026-88',
  invoiceDate: '2026-10-15',
  proformaNumber: 'PF-2026-12',
  proformaDate: '2026-09-01',
  definitiveInvoiceNumber: 'FAC-2026-88',
  definitiveInvoiceDate: '2026-10-15',
  documentType: 'FACTURE',
  paymentScheme: 'STANDARD',
  contractNumber: 'CTR-2026-09',
  purpose: 'Achat tabac brut Virginie',
  operationNature: 'Importation matières premières',
  supplierName: 'UNIVERSAL LEAF TOBACCO',
  supplierCountry: 'USA',
  supplierAddress: 'Richmond, VA',
  supplierBank: 'CITIBANK',
  supplierIban: 'US99001122',
  supplierSwift: 'CITIUS33',
  currency: 'EUR',
  totalAmount: 100000,
  createdAt: '2026-10-15T10:00:00Z',
  createdBy: 'Admin MTK',
  createdById: 'u_admin',
  isDemo: false,
};

const SAMPLE_ORDER: PaymentOrder = {
  id: 'ord_1',
  orderNumber: '001-026-0042',
  contractNumber: 'CTR-2026-09',
  createdAt: '2026-11-10T09:00:00Z',
  updatedAt: '2026-11-10T09:00:00Z',
  createdBy: 'Admin MTK',
  createdById: 'u_admin',
  purpose: 'Achat tabac brut Virginie',
  beneficiaryName: 'UNIVERSAL LEAF TOBACCO',
  beneficiaryCountry: 'USA',
  beneficiaryAddress: 'Richmond, VA',
  beneficiaryBank: 'CITIBANK',
  beneficiaryIban: 'US99001122',
  beneficiarySwift: 'CITIUS33',
  invoiceId: 'inv_1',
  documentBasis: 'FACTURE_DEFINITIVE',
  proformaNumber: 'PF-2026-12',
  proformaDate: '2026-09-01',
  currency: 'EUR',
  grossAmount: 50000,
  deductions: [
    {
      id: 'ded_1',
      category: 'RETENUE_SOURCE',
      label: 'Retenue source',
      amount: 1500,
    },
  ],
  deductionsTotal: 1500,
  amount: 48500,
  amountInWords: 'Quarante-huit mille cinq cents euros',
  transferPurpose: 'Solde virement 50% facture FAC-2026-88',
  invoiceNumber: 'FAC-2026-88',
  invoiceDate: '2026-10-15',
  operationNature: 'Importation matières premières',
  bankId: 'bank_bna',
  bankName: 'BNA',
  bankBranch: 'Kairouan',
  bankFileRef: 'BNA-2026-09',
  transferType: 'VIREMENT',
  requiresRateNegotiation: true,
  status: 'EN_ATTENTE_ACHAT_DEVISE',
  history: [],
  documents: [],
  isDemo: false,
};

const SAMPLE_CONSULTATION: CurrencyConsultation = {
  id: 'cons_qr_1',
  consultationNumber: 'CONS-2026-0099',
  createdAt: '2026-11-18T09:00:00Z',
  createdBy: 'Agent Trésorerie',
  createdById: 'u_1',
  orderIds: ['ord_1'],
  orderNumbers: ['001-026-0042'],
  currency: 'EUR',
  totalAmount: 48500,
  operationDate: '2026-11-18',
  purchaseType: 'au comptant',
  submissionDeadlineTime: '14h20',
  validityDeadlineTime: '14h30',
  status: 'CLOTUREE',
  selectedBankId: 'bank_biat',
  selectedBankName: 'BIAT',
  negotiatedRate: 3.3125,
  confirmationRef: '105/26',
  confirmationDate: '2026-11-18',
  valueDate: '2026-11-20',
  isDemo: false,
};

test('buildConsultationQrPayload includes order ref, invoice, proforma, payment type, and all amount details', () => {
  const payload = buildConsultationQrPayload(
    SAMPLE_CONSULTATION,
    [SAMPLE_ORDER],
    [SAMPLE_INVOICE]
  );

  assert.match(payload, /CONS-2026-0099/);
  assert.match(payload, /001-026-0042/);
  assert.match(payload, /FAC-2026-88/);
  assert.match(payload, /PF-2026-12/);
  assert.match(payload, /CTR-2026-09/);
  assert.match(payload, /Type paiement: Virement bancaire/);
  assert.match(payload, /Montant net: 48 500\.00 EUR/);
  assert.match(payload, /Brut impute: 50 000\.00 EUR/);
  assert.match(payload, /Deductions: 1 500\.00 EUR/);
  assert.match(payload, /Total facture: 100 000\.00 EUR/);
  assert.match(payload, /Part ordre: 50%/);
  assert.match(payload, /En lettres: Quarante-huit mille cinq cents euros/);
  assert.match(payload, /3\.3125/);
  assert.match(payload, /160 656\.250 TND/);
});

test('buildConsultationQrPayload falls back cleanly when full orders array is omitted and stays within max length for large batches', () => {
  const fallback = buildConsultationQrPayload(SAMPLE_CONSULTATION);
  assert.match(fallback, /CONS-2026-0099/);
  assert.match(fallback, /001-026-0042/);
  assert.match(fallback, /48 500\.00 EUR/);

  const manyOrders: PaymentOrder[] = Array.from({ length: 12 }, (_, idx) => ({
    ...SAMPLE_ORDER,
    id: `ord_${idx}`,
    orderNumber: `001-026-01${String(idx).padStart(2, '0')}`,
  }));
  const largeConsultation: CurrencyConsultation = {
    ...SAMPLE_CONSULTATION,
    orderIds: manyOrders.map(o => o.id),
    orderNumbers: manyOrders.map(o => o.orderNumber),
    totalAmount: 48500 * manyOrders.length,
  };
  const largePayload = buildConsultationQrPayload(largeConsultation, manyOrders, [SAMPLE_INVOICE]);
  assert.ok(largePayload.length <= 1350);
  const matrix = getQrCodeMatrix(largePayload);
  assert.ok(matrix.size >= 21);
});

test('buildPurchaseConfirmationQrPayload and PDF builders generate valid documents with QR codes', () => {
  const banks = [
    {
      id: 'bank_bna',
      code: 'BNA',
      name: 'Banque Nationale Agricole',
      swiftCode: 'BNTETNTT',
      country: 'Tunisie',
      active: true,
    },
    {
      id: 'bank_biat',
      code: 'BIAT',
      name: 'Banque Internationale Arabe de Tunisie',
      swiftCode: 'BIATTNTT',
      country: 'Tunisie',
      active: true,
    },
  ];
  const letters = buildPurchaseConfirmations(SAMPLE_CONSULTATION, [SAMPLE_ORDER], banks);
  assert.equal(letters.length, 2);

  const qrPayload = buildPurchaseConfirmationQrPayload(
    letters[0],
    SAMPLE_CONSULTATION,
    [SAMPLE_ORDER],
    [SAMPLE_INVOICE]
  );
  assert.match(qrPayload, /105\/26/);
  assert.match(qrPayload, /001-026-0042/);
  assert.match(qrPayload, /FAC-2026-88/);
  assert.match(qrPayload, /48 500\.00 EUR/);

  const consultationPdf = buildConsultationPdfDocument(
    SAMPLE_CONSULTATION,
    undefined,
    [SAMPLE_ORDER],
    [SAMPLE_INVOICE]
  );
  const consultationBytes = consultationPdf.output('arraybuffer');
  assert.ok(consultationBytes.byteLength > 2000);

  const confirmationPdf = buildPurchaseConfirmationPdfDocument(
    letters,
    undefined,
    SAMPLE_CONSULTATION,
    [SAMPLE_ORDER],
    [SAMPLE_INVOICE]
  );
  const confirmationBytes = confirmationPdf.output('arraybuffer');
  assert.ok(confirmationBytes.byteLength > 2000);
});
