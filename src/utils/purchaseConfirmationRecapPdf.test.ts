import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPurchaseConfirmationRecapData,
  buildPurchaseConfirmationRecapPdfDocument,
} from './purchaseConfirmationRecapPdf';
import { Bank, CurrencyConsultation, PaymentOrder } from '../types/payment';

const TEST_BANKS: Bank[] = [
  { id: 'bank_stb', code: 'STB', name: 'Société Tunisienne de Banque', swiftCode: 'STBKTNTT', country: 'Tunisie', active: true },
  { id: 'bank_bna', code: 'BNA', name: 'Banque Nationale Agricole', swiftCode: 'BNANTNTT', country: 'Tunisie', active: true },
  { id: 'bank_biat', code: 'BIAT', name: 'Banque Internationale Arabe de Tunisie', swiftCode: 'BIATTNTT', country: 'Tunisie', active: true },
];

const ORDER_1: PaymentOrder = {
  id: 'ord_1',
  orderNumber: '001-026-0006',
  createdAt: '2026-11-12T08:00:00Z',
  updatedAt: '2026-11-12T08:00:00Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  purpose: 'Tabac Burley A',
  beneficiaryName: 'Universal Leaf Tobacco Company Inc.',
  beneficiaryCountry: 'USA',
  beneficiaryAddress: 'Richmond',
  beneficiaryBank: 'Citibank',
  beneficiaryIban: 'US123',
  beneficiarySwift: 'CITIUS33',
  currency: 'USD',
  amount: 24000,
  amountInWords: 'vingt-quatre mille dollars',
  transferPurpose: 'Importation',
  invoiceNumber: 'INV-1',
  invoiceDate: '2026-11-01',
  operationNature: 'Importation',
  bankId: 'bank_stb',
  bankName: 'Société Tunisienne de Banque',
  bankBranch: 'Agence Kairouan',
  bankFileRef: 'STB-01',
  transferType: 'LC',
  lcNumber: 'LC-2026-88',
  status: 'EN_ATTENTE_ACHAT_DEVISE',
  history: [],
  documents: [],
  isDemo: true,
};

const ORDER_2: PaymentOrder = {
  ...ORDER_1,
  id: 'ord_2',
  orderNumber: '001-026-0007',
  amount: 15000,
  transferType: 'VIREMENT',
  lcNumber: undefined,
  bankId: 'bank_biat',
  bankName: 'Banque Internationale Arabe de Tunisie',
  bankBranch: 'Centre',
};

test('buildPurchaseConfirmationRecapData aggregates orders, quotes savings, and BCT letters', () => {
  const consultation: CurrencyConsultation = {
    id: 'cons_recap_bct',
    consultationNumber: 'CONS-2026-0002',
    createdAt: '2026-11-13T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_1', 'ord_2'],
    orderNumbers: ['001-026-0006', '001-026-0007'],
    currency: 'USD',
    totalAmount: 39000,
    operationDate: '2026-11-13',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_bna',
    selectedBankName: 'Banque Nationale Agricole',
    negotiatedRate: 3.109,
    confirmationRef: '102/26',
    confirmationDate: '2026-11-13',
    valueDate: '2026-11-17',
    quotes: [
      {
        bankId: 'bank_bna',
        bankName: 'Banque Nationale Agricole',
        bankCode: 'BNA',
        proposedAmount: 39000,
        isFullAmount: true,
        rate: 3.109,
        receivedAt: '2026-11-13T10:00:00Z',
      },
      {
        bankId: 'bank_biat',
        bankName: 'Banque Internationale Arabe de Tunisie',
        bankCode: 'BIAT',
        proposedAmount: 39000,
        isFullAmount: true,
        rate: 3.12,
        receivedAt: '2026-11-13T10:05:00Z',
      },
    ],
    isDemo: true,
  };

  const recap = buildPurchaseConfirmationRecapData(consultation, [ORDER_1, ORDER_2], TEST_BANKS);
  assert.ok(recap);
  assert.equal(recap.routingMode, 'BCT_INTERBANK');
  assert.equal(recap.totalAmount, 39000);
  assert.equal(recap.totalCounterValueTnd, 121251);
  assert.equal(recap.bctTotalTransferTnd, 121251);
  assert.equal(recap.potentialSavingsTnd, 429);
  assert.equal(recap.orderRows.length, 2);
  assert.equal(recap.orderRows[0].instrumentLabel, 'LC LC-2026-88');
  assert.equal(recap.quoteRows.length, 2);
  assert.equal(recap.quoteRows[0].isRetained, true);
  assert.equal(recap.letterRows.length, 3);

  const pdfBytes = buildPurchaseConfirmationRecapPdfDocument(recap).output('arraybuffer');
  const header = new TextDecoder().decode(new Uint8Array(pdfBytes).slice(0, 5));
  assert.equal(header, '%PDF-');
  assert.ok(pdfBytes.byteLength > 2000);
});

test('buildPurchaseConfirmationRecapData handles SAME_BANK consultation without BCT transfer', () => {
  const consultation: CurrencyConsultation = {
    id: 'cons_recap_same',
    consultationNumber: 'CONS-2026-0001',
    createdAt: '2026-11-13T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_1'],
    orderNumbers: ['001-026-0006'],
    currency: 'USD',
    totalAmount: 24000,
    operationDate: '2026-11-13',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_stb',
    selectedBankName: 'Société Tunisienne de Banque',
    negotiatedRate: 3.11,
    confirmationRef: '101/26',
    isDemo: true,
  };

  const recap = buildPurchaseConfirmationRecapData(consultation, [ORDER_1], TEST_BANKS);
  assert.ok(recap);
  assert.equal(recap.routingMode, 'SAME_BANK');
  assert.equal(recap.bctTotalTransferTnd, 0);
  assert.equal(recap.letterRows.length, 1);
  assert.equal(recap.quoteRows.length, 1);

  const pdfBytes = buildPurchaseConfirmationRecapPdfDocument(recap).output('arraybuffer');
  const header = new TextDecoder().decode(new Uint8Array(pdfBytes).slice(0, 5));
  assert.equal(header, '%PDF-');
});
