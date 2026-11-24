import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeInvoicePaymentSummary,
  validateOrderAgainstInvoice,
  getAvailableInvoicesForOrder,
  normalizeOrderDeductions,
  getOrderInvoiceGrossAmount,
  getOrderDeductionsTotal,
  canEditOrderDeductions,
  validateExistingOrderDeductionsUpdate,
  doesOrderBelongToInvoice,
  doesInvoiceRequireConversion,
  findReferenceConflict,
  getInvoiceDocumentType,
  getSuggestedNextTranche,
  isProformaConverted,
  resolveOrderDocumentSnapshot,
} from './invoiceUtils';
import { Invoice, OrderDeduction, PaymentOrder } from '../types/payment';

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

test('normalizeOrderDeductions cleans, defaults labels, and rejects negative deductions', () => {
  const res = normalizeOrderDeductions([
    { category: 'FRAIS_ENREGISTREMENT', label: '', amount: 450.126, reference: 'Q-2026-01' },
    { category: 'PENALITE_RETARD', label: 'Retard livraison', amount: 1500 },
    { category: 'AUTRE_DEDUCTION', label: 'Ignoré car zéro', amount: 0 },
  ]);
  assert.equal(res.error, undefined);
  assert.equal(res.items.length, 2);
  assert.equal(res.items[0].label, "Frais d'enregistrement");
  assert.equal(res.items[0].amount, 450.13);
  assert.equal(res.total, 1950.13);

  const bad = normalizeOrderDeductions([
    { category: 'FRAIS_ENREGISTREMENT', label: 'Test', amount: -50 },
  ]);
  assert.ok(bad.error);
});

test('invoice settlement with deductions imputes grossAmount to invoice while order transfers netAmount', () => {
  const deductions: OrderDeduction[] = [
    { id: 'd1', category: 'FRAIS_ENREGISTREMENT', label: "Frais d'enregistrement", amount: 500 },
    { id: 'd2', category: 'RETENUE_SOURCE', label: 'Retenue à la source', amount: 1500 },
  ];

  // Validate full 100,000 USD settlement with 2,000 USD deductions -> net transfer 98,000 USD
  const validation = validateOrderAgainstInvoice(
    BASE_INVOICE,
    [],
    98000,
    'USD',
    deductions,
    100000
  );
  assert.equal(validation.valid, true);
  assert.equal(validation.deductionsTotal, 2000);
  assert.equal(validation.grossAmount, 100000);

  const orderWithDeductions = makeOrder({
    id: 'ord_ded',
    invoiceId: 'inv_1',
    amount: 98000,
    grossAmount: 100000,
    deductionsTotal: 2000,
    deductions,
  });

  assert.equal(getOrderDeductionsTotal(orderWithDeductions), 2000);
  assert.equal(getOrderInvoiceGrossAmount(orderWithDeductions), 100000);

  const summary = computeInvoicePaymentSummary(BASE_INVOICE, [orderWithDeductions]);
  assert.equal(summary.allocatedAmount, 100000);
  assert.equal(summary.netOrderedAmount, 98000);
  assert.equal(summary.deductionsTotal, 2000);
  assert.equal(summary.remainingAmount, 0);
  assert.equal(summary.progressPercent, 100);
  assert.equal(summary.paymentStatus, 'PAYEE');

  // Cannot exceed remaining balance when net + deductions > remainingAmount
  const partialOrder = makeOrder({
    id: 'ord_p1',
    invoiceId: 'inv_1',
    amount: 48000,
    grossAmount: 50000,
    deductionsTotal: 2000,
    deductions,
  });
  const overflowCheck = validateOrderAgainstInvoice(
    BASE_INVOICE,
    [partialOrder],
    49000,
    'USD',
    [{ category: 'FRAIS_ENREGISTREMENT', label: "Frais d'enregistrement", amount: 2000 }]
  );
  assert.equal(overflowCheck.valid, false);
  assert.match(overflowCheck.error || '', /dépasse le solde restant/i);
});

test('canEditOrderDeductions allows SAISI, TRANSMIS_SIGNATURE, SIGNE before deposit/consultation and blocks locked states', () => {
  assert.equal(canEditOrderDeductions(makeOrder({ status: 'SAISI' })).allowed, true);
  assert.equal(canEditOrderDeductions(makeOrder({ status: 'TRANSMIS_SIGNATURE' })).allowed, true);
  assert.equal(canEditOrderDeductions(makeOrder({ status: 'SIGNE' })).allowed, true);

  const deposited = canEditOrderDeductions(makeOrder({ status: 'DEPOSE_BANQUE' }));
  assert.equal(deposited.allowed, false);
  assert.match(deposited.reason || '', /déposé/i);

  const waitingFx = canEditOrderDeductions(makeOrder({ status: 'EN_ATTENTE_ACHAT_DEVISE' }));
  assert.equal(waitingFx.allowed, false);

  const signedWithDeposit = canEditOrderDeductions(
    makeOrder({
      status: 'SIGNE',
      deposit: {
        id: 'dep_1',
        orderId: 'ord_1',
        bankId: 'b1',
        bankName: 'STB',
        depositDate: '2026-02-05',
        slipNumber: 'B-1',
        bankReference: 'R-1',
        depositedBy: 'Agent',
      },
    })
  );
  assert.equal(signedWithDeposit.allowed, false);

  const inConsultation = canEditOrderDeductions(
    makeOrder({
      status: 'SIGNE',
      exchangeTransaction: {
        id: 'ex_1',
        orderId: 'ord_1',
        consultationId: 'cons_1',
        status: 'CONSULTATION_EN_COURS',
      },
    })
  );
  assert.equal(inConsultation.allowed, false);
  assert.match(inConsultation.reason || '', /consultation/i);

  assert.equal(canEditOrderDeductions(makeOrder({ status: 'EXECUTE' })).allowed, false);
  assert.equal(canEditOrderDeductions(makeOrder({ status: 'ANNULE' })).allowed, false);
});

test('validateExistingOrderDeductionsUpdate adds, updates, and clears deductions on a single order without creating a new one', () => {
  const existingOrder = makeOrder({
    id: 'ord_single',
    invoiceId: 'inv_1',
    status: 'TRANSMIS_SIGNATURE',
    amount: 100000,
    grossAmount: 100000,
    deductionsTotal: 0,
    deductions: [],
  });

  // 1. Add Frais d'enregistrement + Retenue à la source -> gross stays 100,000, net drops to 97,500
  const added = validateExistingOrderDeductionsUpdate({
    order: existingOrder,
    invoice: BASE_INVOICE,
    allOrders: [existingOrder],
    deductions: [
      { category: 'FRAIS_ENREGISTREMENT', label: "Frais d'enregistrement", amount: 500, reference: 'Q-01' },
      { category: 'RETENUE_SOURCE', label: 'Retenue RAS', amount: 2000 },
    ],
  });
  assert.equal(added.valid, true);
  assert.equal(added.grossAmount, 100000);
  assert.equal(added.deductionsTotal, 2500);
  assert.equal(added.netAmount, 97500);
  assert.equal(added.normalizedDeductions.length, 2);

  // Invoice summary remains 100,000 allocated (remaining 0) while netOrderedAmount is 97,500
  const updatedOrder: PaymentOrder = {
    ...existingOrder,
    grossAmount: added.grossAmount,
    deductionsTotal: added.deductionsTotal,
    deductions: added.normalizedDeductions,
    amount: added.netAmount,
  };
  const invSummary = computeInvoicePaymentSummary(BASE_INVOICE, [updatedOrder]);
  assert.equal(invSummary.allocatedAmount, 100000);
  assert.equal(invSummary.netOrderedAmount, 97500);
  assert.equal(invSummary.deductionsTotal, 2500);
  assert.equal(invSummary.remainingAmount, 0);

  // 2. Clear deductions -> net restores cleanly to 100,000
  const cleared = validateExistingOrderDeductionsUpdate({
    order: updatedOrder,
    invoice: BASE_INVOICE,
    allOrders: [updatedOrder],
    deductions: [],
  });
  assert.equal(cleared.valid, true);
  assert.equal(cleared.grossAmount, 100000);
  assert.equal(cleared.deductionsTotal, 0);
  assert.equal(cleared.netAmount, 100000);
});

test('validateExistingOrderDeductionsUpdate enforces net > 0, positive amounts, invoice remaining cap, and unlocked status', () => {
  const order1 = makeOrder({
    id: 'ord_1',
    invoiceId: 'inv_1',
    status: 'SIGNE',
    amount: 40000,
    grossAmount: 40000,
  });
  const order2 = makeOrder({
    id: 'ord_2',
    invoiceId: 'inv_1',
    status: 'EXECUTE',
    amount: 50000,
    grossAmount: 50000,
  });

  // Deductions >= gross rejected
  const tooMuchDed = validateExistingOrderDeductionsUpdate({
    order: order1,
    invoice: BASE_INVOICE,
    allOrders: [order1, order2],
    deductions: [{ category: 'PENALITE_RETARD', label: 'Pénalité', amount: 40000 }],
  });
  assert.equal(tooMuchDed.valid, false);
  assert.match(tooMuchDed.error || '', /net à transférer positif/i);

  // Negative deduction rejected
  const negativeDed = validateExistingOrderDeductionsUpdate({
    order: order1,
    invoice: BASE_INVOICE,
    allOrders: [order1, order2],
    deductions: [{ category: 'FRAIS_ENREGISTREMENT', label: 'Frais', amount: -100 }],
  });
  assert.equal(negativeDed.valid, false);

  // Gross increase up to maxAllowedGross (100,000 - 50,000 = 50,000) succeeds, above fails
  const validGrossIncrease = validateExistingOrderDeductionsUpdate({
    order: order1,
    invoice: BASE_INVOICE,
    allOrders: [order1, order2],
    grossAmount: 50000,
    deductions: [{ category: 'FRAIS_ENREGISTREMENT', label: 'Enreg.', amount: 1200 }],
  });
  assert.equal(validGrossIncrease.valid, true);
  assert.equal(validGrossIncrease.grossAmount, 50000);
  assert.equal(validGrossIncrease.netAmount, 48800);

  const exceedGrossIncrease = validateExistingOrderDeductionsUpdate({
    order: order1,
    invoice: BASE_INVOICE,
    allOrders: [order1, order2],
    grossAmount: 55000,
    deductions: [{ category: 'FRAIS_ENREGISTREMENT', label: 'Enreg.', amount: 1200 }],
  });
  assert.equal(exceedGrossIncrease.valid, false);
  assert.match(exceedGrossIncrease.error || '', /dépasse le solde disponible/i);

  // Locked order rejected
  const lockedUpdate = validateExistingOrderDeductionsUpdate({
    order: order2,
    invoice: BASE_INVOICE,
    allOrders: [order1, order2],
    deductions: [{ category: 'FRAIS_ENREGISTREMENT', label: 'Enreg.', amount: 500 }],
  });
  assert.equal(lockedUpdate.valid, false);
  assert.match(lockedUpdate.error || '', /exécuté/i);
});

test('Proforma -> Facture lifecycle: 1st order on Proforma allowed, then mandatory conversion to Facture with a strictly new reference', () => {
  const proformaDossier: Invoice = {
    ...BASE_INVOICE,
    id: 'inv_prof',
    documentType: 'PROFORMA',
    invoiceNumber: 'PROF-2026-500',
    invoiceDate: '2026-03-01',
    proformaNumber: 'PROF-2026-500',
    proformaDate: '2026-03-01',
    paymentScheme: 'STANDARD',
    totalAmount: 100000,
  };

  assert.equal(getInvoiceDocumentType(BASE_INVOICE), 'FACTURE');
  assert.equal(getInvoiceDocumentType(proformaDossier), 'PROFORMA');
  assert.equal(isProformaConverted(proformaDossier), false);
  assert.equal(doesInvoiceRequireConversion(proformaDossier, 0), false);
  assert.equal(doesInvoiceRequireConversion(proformaDossier, 1), true);

  // 1st order suggestion on Proforma: LC on PROFORMA, no conversion forced yet
  const summary0 = computeInvoicePaymentSummary(proformaDossier, []);
  const s1 = getSuggestedNextTranche(proformaDossier, summary0);
  assert.equal(s1.documentType, 'PROFORMA');
  assert.equal(s1.requiresConversionToInvoice, false);
  assert.equal(s1.transferType, 'LC');
  assert.equal(s1.documentBasis, 'PROFORMA');
  assert.equal(s1.paymentMode, 'FULL');
  assert.equal(s1.suggestedGrossAmount, 100000);

  const snap1 = resolveOrderDocumentSnapshot({
    invoice: proformaDossier,
    documentBasis: s1.documentBasis,
    existingInvoices: [BASE_INVOICE, proformaDossier],
    existingLinkedOrdersCount: 0,
  });
  assert.equal(snap1.valid, true);
  assert.equal(snap1.documentBasis, 'PROFORMA');
  assert.equal(snap1.invoiceNumber, 'PROF-2026-500');
  assert.equal(snap1.proformaNumber, 'PROF-2026-500');
  assert.equal(snap1.invoiceDefinitiveAttach, undefined);

  const firstLcOrder = makeOrder({
    id: 'ord_lc_1',
    invoiceId: 'inv_prof',
    documentBasis: 'PROFORMA',
    invoiceNumber: 'PROF-2026-500',
    invoiceDate: '2026-03-01',
    proformaNumber: 'PROF-2026-500',
    proformaDate: '2026-03-01',
    transferType: 'LC',
    lcNumber: 'LC-2026-099',
    amount: 50000,
    grossAmount: 50000,
  });

  // After 1st order is entered, conversion to Facture with a new ref becomes mandatory
  const summaryAfterFirst = computeInvoicePaymentSummary(proformaDossier, [firstLcOrder]);
  assert.equal(summaryAfterFirst.remainingAmount, 50000);
  assert.equal(summaryAfterFirst.progressPercent, 50);

  const s2 = getSuggestedNextTranche(proformaDossier, summaryAfterFirst);
  assert.equal(s2.requiresConversionToInvoice, true);
  assert.equal(s2.transferType, 'VIREMENT');
  assert.equal(s2.documentBasis, 'FACTURE_DEFINITIVE');
  assert.equal(s2.paymentMode, 'FULL');
  assert.equal(s2.suggestedGrossAmount, 50000);

  // Attempting 2nd order still on PROFORMA must be blocked
  const blockedProformaSecondOrder = resolveOrderDocumentSnapshot({
    invoice: proformaDossier,
    documentBasis: 'PROFORMA',
    existingInvoices: [BASE_INVOICE, proformaDossier],
    existingLinkedOrdersCount: 1,
  });
  assert.equal(blockedProformaSecondOrder.valid, false);
  assert.match(blockedProformaSecondOrder.error || '', /convertir la Proforma en Facture/i);

  // Attempting 2nd order without new Facture ref must fail
  const missingNewRef = resolveOrderDocumentSnapshot({
    invoice: proformaDossier,
    documentBasis: 'FACTURE_DEFINITIVE',
    existingInvoices: [BASE_INVOICE, proformaDossier],
    existingLinkedOrdersCount: 1,
  });
  assert.equal(missingNewRef.valid, false);
  assert.match(missingNewRef.error || '', /convertir la Proforma en Facture/i);

  // Attempting to reuse the same Proforma reference as the new Facture ref must fail
  const sameAsProforma = resolveOrderDocumentSnapshot({
    invoice: proformaDossier,
    documentBasis: 'FACTURE_DEFINITIVE',
    inlineDefinitiveNumber: 'PROF-2026-500',
    inlineDefinitiveDate: '2026-03-20',
    existingInvoices: [BASE_INVOICE, proformaDossier],
    existingLinkedOrdersCount: 1,
  });
  assert.equal(sameAsProforma.valid, false);
  assert.match(sameAsProforma.error || '', /différente de la référence Proforma/i);

  // Conflict check against another invoice's reference must fail
  const conflictSnap = resolveOrderDocumentSnapshot({
    invoice: proformaDossier,
    documentBasis: 'FACTURE_DEFINITIVE',
    inlineDefinitiveNumber: 'FAC-2026-0100',
    inlineDefinitiveDate: '2026-03-20',
    existingInvoices: [BASE_INVOICE, proformaDossier],
    existingLinkedOrdersCount: 1,
  });
  assert.equal(conflictSnap.valid, false);
  assert.match(conflictSnap.error || '', /FAC-2026-0100/);

  // Valid conversion with a strictly new Facture reference attaches definitiveInvoiceNumber & keeps Proforma recall
  const validConversionSnap = resolveOrderDocumentSnapshot({
    invoice: proformaDossier,
    documentBasis: 'FACTURE_DEFINITIVE',
    inlineDefinitiveNumber: 'FAC-DEF-2026-777',
    inlineDefinitiveDate: '2026-03-20',
    existingInvoices: [BASE_INVOICE, proformaDossier],
    existingLinkedOrdersCount: 1,
  });
  assert.equal(validConversionSnap.valid, true);
  assert.equal(validConversionSnap.invoiceNumber, 'FAC-DEF-2026-777');
  assert.equal(validConversionSnap.invoiceDate, '2026-03-20');
  assert.equal(validConversionSnap.proformaNumber, 'PROF-2026-500');
  assert.deepEqual(validConversionSnap.invoiceDefinitiveAttach, {
    definitiveInvoiceNumber: 'FAC-DEF-2026-777',
    definitiveInvoiceDate: '2026-03-20',
  });

  // Once converted, documentType becomes FACTURE, isProformaConverted is true, totalAmount stays 100,000 and both orders belong to it
  const convertedDossier: Invoice = {
    ...proformaDossier,
    documentType: 'FACTURE',
    invoiceNumber: 'FAC-DEF-2026-777',
    invoiceDate: '2026-03-20',
    definitiveInvoiceNumber: 'FAC-DEF-2026-777',
    definitiveInvoiceDate: '2026-03-20',
  };
  assert.equal(getInvoiceDocumentType(convertedDossier), 'FACTURE');
  assert.equal(isProformaConverted(convertedDossier), true);
  assert.equal(doesInvoiceRequireConversion(convertedDossier, 1), false);

  const secondOrder = makeOrder({
    id: 'ord_vir_2',
    invoiceId: undefined,
    documentBasis: 'FACTURE_DEFINITIVE',
    invoiceNumber: 'FAC-DEF-2026-777',
    invoiceDate: '2026-03-20',
    proformaNumber: 'PROF-2026-500',
    proformaDate: '2026-03-01',
    transferType: 'VIREMENT',
    amount: 50000,
    grossAmount: 50000,
  });
  const firstOrderByRefOnly = { ...firstLcOrder, invoiceId: undefined };

  assert.equal(doesOrderBelongToInvoice(firstOrderByRefOnly, convertedDossier), true);
  assert.equal(doesOrderBelongToInvoice(secondOrder, convertedDossier), true);

  const finalSummary = computeInvoicePaymentSummary(convertedDossier, [
    firstOrderByRefOnly,
    secondOrder,
  ]);
  assert.equal(finalSummary.allocatedAmount, 100000);
  assert.equal(finalSummary.remainingAmount, 0);
  assert.equal(finalSummary.progressPercent, 100);
  assert.equal(finalSummary.paymentStatus, 'PAYEE');

  assert.ok(findReferenceConflict(['PROF-2026-500'], [convertedDossier]));
  assert.equal(findReferenceConflict(['PROF-2026-500'], [convertedDossier], 'inv_prof'), null);
});


