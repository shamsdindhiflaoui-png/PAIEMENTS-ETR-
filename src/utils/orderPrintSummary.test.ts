import test from 'node:test';
import assert from 'node:assert/strict';
import { Invoice, PaymentOrder } from '../types/payment';
import {
  HALF_A4_SIGNATORIES,
  buildHalfA4OrderPdf,
  computeOrderPrintData,
} from './orderPrintSummary';

const BASE_INVOICE: Invoice = {
  id: 'inv_1',
  invoiceNumber: 'FAC-2026-0100',
  invoiceDate: '2026-02-01',
  contractNumber: 'CT-2026/MTK-01',
  purpose: 'Importation tabac brut',
  operationNature: 'Importation tabac brut',
  supplierId: 'sup_1',
  supplierName: 'Universal Leaf Tobacco',
  supplierCountry: 'États-Unis',
  supplierAddress: 'Richmond VA',
  supplierBank: 'JPMorgan Chase Bank',
  supplierIban: 'US89CHAS123456',
  supplierSwift: 'CHASUS33',
  currency: 'USD',
  totalAmount: 100000,
  createdAt: '2026-02-01T10:00:00Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  isDemo: false,
};

const makeOrder = (overrides: Partial<PaymentOrder> = {}): PaymentOrder => ({
  id: 'ord_1',
  orderNumber: '001-026-0001',
  createdAt: '2026-02-05T10:00:00Z',
  updatedAt: '2026-02-05T10:00:00Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  purpose: 'Règlement lot tabac Q1',
  beneficiaryName: 'Universal Leaf Tobacco',
  beneficiaryCountry: 'États-Unis',
  beneficiaryAddress: 'Richmond VA',
  beneficiaryBank: 'JPMorgan Chase Bank',
  beneficiaryIban: 'US89CHAS123456',
  beneficiarySwift: 'CHASUS33',
  currency: 'USD',
  amount: 100000,
  amountInWords: 'cent mille dollars américains',
  transferPurpose: 'Règlement facture FAC-2026-0100',
  invoiceNumber: 'FAC-2026-0100',
  invoiceDate: '2026-02-01',
  operationNature: 'Importation tabac brut',
  bankId: 'bank_stb',
  bankName: 'STB (Société Tunisienne de Banque)',
  bankBranch: 'Agence Kairouan',
  bankFileRef: 'REF-1',
  transferType: 'LC',
  lcNumber: 'LC-2026-88',
  status: 'SIGNE',
  history: [],
  documents: [],
  isDemo: false,
  ...overrides,
});

test('computeOrderPrintData formats full single-order settlement with supplier, date, payment type, invoice ref and 100% share', () => {
  const ord = makeOrder({ invoiceId: 'inv_1', amount: 100000 });
  const data = computeOrderPrintData(ord, BASE_INVOICE, [ord]);

  assert.equal(data.supplierName, 'Universal Leaf Tobacco');
  assert.equal(data.orderDateFormatted, '05/02/2026');
  assert.equal(data.invoiceNumber, 'FAC-2026-0100');
  assert.equal(data.invoiceDateFormatted, '01/02/2026');
  assert.equal(data.paymentTypeLabel, 'Crédit Documentaire (LC)');
  assert.equal(data.lcNumber, 'LC-2026-88');
  assert.equal(data.orderSharePercent, 100);
  assert.equal(data.cumulativePercent, 100);
  assert.equal(data.isFullSettlement, true);
  assert.match(data.settlementHeadline, /100 %/);
  assert.match(data.settlementHeadline, /intégral/i);
});

test('computeOrderPrintData computes partial tranche percentage and remaining balance cleanly', () => {
  const ord1 = makeOrder({
    id: 'ord_1',
    invoiceId: 'inv_1',
    createdAt: '2026-02-05T10:00:00Z',
    amount: 40000,
    transferType: 'VIREMENT',
  });
  const ord2 = makeOrder({
    id: 'ord_2',
    orderNumber: '001-026-0002',
    invoiceId: 'inv_1',
    createdAt: '2026-02-12T10:00:00Z',
    amount: 25000,
    transferType: 'VIREMENT',
  });

  const data1 = computeOrderPrintData(ord1, BASE_INVOICE, [ord1, ord2]);
  assert.equal(data1.orderSharePercent, 40);
  assert.equal(data1.cumulativePercent, 65);
  assert.equal(data1.trancheIndex, 1);
  assert.equal(data1.totalTranches, 2);
  assert.equal(data1.remainingAmount, 35000);
  assert.equal(data1.isFullSettlement, false);
  assert.match(data1.settlementHeadline, /40 %/);
  assert.match(data1.settlementHeadline, /Tranche 1\/2/);
  assert.match(data1.settlementSubline, /Cumul réglé : 65 %/);
});

test('computeOrderPrintData uses grossAmount (net + deductions) for invoice share when order has deductions', () => {
  const ord = makeOrder({
    invoiceId: 'inv_1',
    amount: 97500,
    grossAmount: 100000,
    deductionsTotal: 2500,
    deductions: [
      {
        id: 'd1',
        category: 'FRAIS_ENREGISTREMENT',
        label: "Frais d'enregistrement",
        amount: 2500,
      },
    ],
  });

  const data = computeOrderPrintData(ord, BASE_INVOICE, [ord]);
  assert.equal(data.hasDeductions, true);
  assert.equal(data.netAmount, 97500);
  assert.equal(data.grossAmount, 100000);
  assert.equal(data.deductionsTotal, 2500);
  assert.equal(data.orderSharePercent, 100);
  assert.match(data.settlementSubline, /Net viré/i);
  assert.match(data.settlementSubline, /Déductions/i);
});

test('computeOrderPrintData handles standalone order without linked Invoice entity and cancelled order', () => {
  const standalone = makeOrder({ invoiceId: undefined, invoiceNumber: 'FAC-EXT-99' });
  const dataStandalone = computeOrderPrintData(standalone, undefined, [standalone]);
  assert.equal(dataStandalone.hasLinkedInvoice, false);
  assert.equal(dataStandalone.invoiceNumber, 'FAC-EXT-99');
  assert.match(dataStandalone.settlementHeadline, /FAC-EXT-99/);

  const cancelled = makeOrder({ invoiceId: 'inv_1', status: 'ANNULE', amount: 40000 });
  const dataCancelled = computeOrderPrintData(cancelled, BASE_INVOICE, [cancelled]);
  assert.equal(dataCancelled.isCancelled, true);
  assert.equal(dataCancelled.orderSharePercent, 0);
  assert.match(dataCancelled.settlementHeadline, /annulé/i);
});

test('buildHalfA4OrderPdf generates a single-page Half-A4 (210 x 148 mm) PDF document', () => {
  const ord = makeOrder({ invoiceId: 'inv_1', amount: 40000 });
  const doc = buildHalfA4OrderPdf(ord, BASE_INVOICE, [ord]);
  assert.equal(doc.getNumberOfPages(), 1);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  assert.ok(Math.abs(pageWidth - 210) < 0.5, `Expected width 210mm, got ${pageWidth}`);
  assert.ok(Math.abs(pageHeight - 148) < 0.5, `Expected height 148mm, got ${pageHeight}`);
  const output = doc.output('arraybuffer');
  assert.ok(output.byteLength > 1000);
});

test('computeOrderPrintData formats 50% LC on Proforma vs 50% Virement on Facture Définitive with Proforma recall', () => {
  const mixedDossier: Invoice = {
    ...BASE_INVOICE,
    id: 'inv_mix',
    invoiceNumber: 'FAC-DEF-2026-88',
    invoiceDate: '2026-03-20',
    proformaNumber: 'PROF-2026-12',
    proformaDate: '2026-03-01',
    definitiveInvoiceNumber: 'FAC-DEF-2026-88',
    definitiveInvoiceDate: '2026-03-20',
    paymentScheme: '50_LC_50_VIREMENT',
    totalAmount: 100000,
  };

  const lcOrder = makeOrder({
    id: 'ord_lc',
    invoiceId: 'inv_mix',
    documentBasis: 'PROFORMA',
    invoiceNumber: 'PROF-2026-12',
    invoiceDate: '2026-03-01',
    proformaNumber: 'PROF-2026-12',
    proformaDate: '2026-03-01',
    transferType: 'LC',
    lcNumber: 'LC-STB-2026-50',
    amount: 50000,
  });

  const virOrder = makeOrder({
    id: 'ord_vir',
    orderNumber: '001-026-0002',
    createdAt: '2026-03-22T10:00:00Z',
    invoiceId: 'inv_mix',
    documentBasis: 'FACTURE_DEFINITIVE',
    invoiceNumber: 'FAC-DEF-2026-88',
    invoiceDate: '2026-03-20',
    proformaNumber: 'PROF-2026-12',
    proformaDate: '2026-03-01',
    transferType: 'VIREMENT',
    lcNumber: '',
    amount: 50000,
  });

  const lcPrint = computeOrderPrintData(lcOrder, mixedDossier, [lcOrder, virOrder]);
  assert.equal(lcPrint.documentBasis, 'PROFORMA');
  assert.equal(lcPrint.documentRefLabel, 'Réf. Proforma');
  assert.equal(lcPrint.invoiceNumber, 'PROF-2026-12');
  assert.equal(lcPrint.invoiceDateFormatted, '01/03/2026');
  assert.equal(lcPrint.proformaRecall, undefined);
  assert.equal(lcPrint.orderSharePercent, 50);
  assert.equal(lcPrint.cumulativePercent, 100);

  const virPrint = computeOrderPrintData(virOrder, mixedDossier, [lcOrder, virOrder]);
  assert.equal(virPrint.documentBasis, 'FACTURE_DEFINITIVE');
  assert.equal(virPrint.documentRefLabel, 'Réf. Facture');
  assert.equal(virPrint.invoiceNumber, 'FAC-DEF-2026-88');
  assert.equal(virPrint.invoiceDateFormatted, '20/03/2026');
  assert.equal(virPrint.proformaRecall, 'sur Proforma PROF-2026-12 (01/03/2026)');
  assert.equal(virPrint.orderSharePercent, 50);
  assert.equal(virPrint.cumulativePercent, 100);

  const docVir = buildHalfA4OrderPdf(virOrder, mixedDossier, [lcOrder, virOrder]);
  assert.equal(docVir.getNumberOfPages(), 1);
  assert.ok(docVir.output('arraybuffer').byteLength > 1000);
});

test('Half-A4 print includes invoice purpose (Objet de la facture), Contrat, and exactly 2 signatories (Service Financier and S/D Trésorerie)', () => {
  assert.equal(HALF_A4_SIGNATORIES.length, 2);
  assert.equal(HALF_A4_SIGNATORIES[0].title, '1. Service Financier');
  assert.equal(HALF_A4_SIGNATORIES[1].title, '2. S/D Trésorerie');

  const ord = makeOrder({
    invoiceId: 'inv_1',
    purpose: 'Objet ordre secondaire',
    transferPurpose: 'Règlement facture FAC-2026-0100',
    contractNumber: undefined,
  });

  const data = computeOrderPrintData(ord, BASE_INVOICE, [ord]);
  assert.equal(data.invoicePurpose, 'Importation tabac brut');
  assert.equal(data.purpose, 'Importation tabac brut');
  assert.equal(data.contractNumber, 'CT-2026/MTK-01');

  const doc = buildHalfA4OrderPdf(ord, BASE_INVOICE, [ord]);
  const pdfRaw = doc.output('datauristring');
  const decoded = Buffer.from(pdfRaw.split(',')[1] || '', 'base64').toString('latin1');
  assert.match(decoded, /OBJET DE LA FACTURE/);
  assert.match(decoded, /Importation tabac brut/);
  assert.match(decoded, /CONTRAT/);
  assert.match(decoded, /CT-2026\/MTK-01/);
  assert.match(decoded, /1\. Service Financier/);
  assert.match(decoded, /2\. S\/D Tr/);
  assert.doesNotMatch(decoded, /Agent Comptable/);
  assert.doesNotMatch(decoded, /Controle de Gestion/);
});


