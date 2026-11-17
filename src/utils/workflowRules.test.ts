import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConsultationUpdateToOrder,
  canExecuteOrder,
  canUserPerformTransition,
  computeNextStructuredOrderNumber,
  generateStructuredOrderNumber,
  getDepositTargetStatus,
  normalizeLegacyStatus,
} from './workflowRules';
import type { CurrencyConsultation, PaymentOrder } from '../types/payment';

test('getDepositTargetStatus returns EN_ATTENTE_ACHAT_DEVISE when negotiation is required', () => {
  assert.equal(getDepositTargetStatus(true), 'EN_ATTENTE_ACHAT_DEVISE');
});

test('getDepositTargetStatus returns DEPOSE_BANQUE when negotiation is not required', () => {
  assert.equal(getDepositTargetStatus(false), 'DEPOSE_BANQUE');
  assert.equal(getDepositTargetStatus(undefined), 'DEPOSE_BANQUE');
});

test('prevents depositing at bank if order is not SIGNE', () => {
  const result = canUserPerformTransition('TRANSMIS_SIGNATURE', 'DEPOSE_BANQUE', 'AGENT_FINANCIER');
  assert.equal(result.allowed, false);
  const result2 = canUserPerformTransition('SAISI', 'EN_ATTENTE_ACHAT_DEVISE', 'AGENT_FINANCIER');
  assert.equal(result2.allowed, false);
});

test('allows Responsable Financier and Contrôle de Gestion to sign order from TRANSMIS_SIGNATURE', () => {
  assert.equal(canUserPerformTransition('TRANSMIS_SIGNATURE', 'SIGNE', 'RESPONSABLE_FINANCIER').allowed, true);
  assert.equal(canUserPerformTransition('TRANSMIS_SIGNATURE', 'SIGNE', 'CONTROLE_GESTION').allowed, true);
});

test('prevents Agent Financier from signing order', () => {
  const result = canUserPerformTransition('TRANSMIS_SIGNATURE', 'SIGNE', 'AGENT_FINANCIER');
  assert.equal(result.allowed, false);
});

test('allows Agent Financier to deposit signed order to DEPOSE_BANQUE or EN_ATTENTE_ACHAT_DEVISE', () => {
  assert.equal(canUserPerformTransition('SIGNE', 'DEPOSE_BANQUE', 'AGENT_FINANCIER').allowed, true);
  assert.equal(canUserPerformTransition('SIGNE', 'EN_ATTENTE_ACHAT_DEVISE', 'AGENT_FINANCIER').allowed, true);
});

test('allows Responsable Financier to execute from DEPOSE_BANQUE but blocks direct execution from EN_ATTENTE_ACHAT_DEVISE', () => {
  assert.equal(canUserPerformTransition('DEPOSE_BANQUE', 'EXECUTE', 'RESPONSABLE_FINANCIER').allowed, true);
  assert.equal(canUserPerformTransition('EN_ATTENTE_ACHAT_DEVISE', 'EXECUTE', 'RESPONSABLE_FINANCIER').allowed, false);
  assert.equal(canUserPerformTransition('EN_ATTENTE_ACHAT_DEVISE', 'EXECUTE', 'AGENT_FINANCIER').allowed, false);
});

test('allows Administrator to perform valid transitions but still enforces consultation closure before execution', () => {
  assert.equal(canUserPerformTransition('SIGNE', 'DEPOSE_BANQUE', 'ADMINISTRATEUR').allowed, true);
  assert.equal(canUserPerformTransition('EN_ATTENTE_ACHAT_DEVISE', 'EXECUTE', 'ADMINISTRATEUR').allowed, false);
  assert.equal(canUserPerformTransition('DEPOSE_BANQUE', 'EXECUTE', 'ADMINISTRATEUR').allowed, true);
});

test('normalizeLegacyStatus maps legacy statuses cleanly to the 5-stage circuit', () => {
  assert.equal(normalizeLegacyStatus('BROUILLON'), 'SAISI');
  assert.equal(normalizeLegacyStatus('TRANSMIS_CG'), 'TRANSMIS_SIGNATURE');
  assert.equal(normalizeLegacyStatus('VALIDE_CG'), 'SIGNE');
  assert.equal(normalizeLegacyStatus('ATTENTE_NEGOCIATION'), 'EN_ATTENTE_ACHAT_DEVISE');
  assert.equal(normalizeLegacyStatus('DEPOSE_BANQUE', false), 'DEPOSE_BANQUE');
  assert.equal(normalizeLegacyStatus('DEPOSE_BANQUE', true, false), 'EN_ATTENTE_ACHAT_DEVISE');
  assert.equal(normalizeLegacyStatus('DEPOSE_BANQUE', true, true), 'DEPOSE_BANQUE');
});

test('order number generator produces compliant 000 UTILISATEUR 000 ANNEE 0000 ORDRE format', () => {
  const { orderNumber, userPart, yearPart, seqPart } = generateStructuredOrderNumber('012', 2026, 41);
  assert.equal(userPart, '012');
  assert.equal(yearPart, '026');
  assert.equal(seqPart, '0042');
  assert.equal(orderNumber, '012-026-0042');
});

test('computeNextStructuredOrderNumber derives monotonic non-colliding sequence per year and userCode', () => {
  const existing = [
    { orderNumber: 'OP-2026-0001', fiscalYear: 2026 },
    { orderNumber: 'OP-2026-0007', fiscalYear: 2026 },
    { orderNumber: '002-026-0008', fiscalYear: 2026, yearCode: '026', orderSeq: '0008' },
    { orderNumber: '001-025-0099', fiscalYear: 2025, yearCode: '025', orderSeq: '0099' },
  ];
  const next2026 = computeNextStructuredOrderNumber('001', 2026, existing);
  assert.equal(next2026.userPart, '001');
  assert.equal(next2026.yearPart, '026');
  assert.equal(next2026.seqPart, '0009');
  assert.equal(next2026.orderNumber, '001-026-0009');

  const next2027 = computeNextStructuredOrderNumber('003', 2027, existing);
  assert.equal(next2027.orderNumber, '003-027-0001');
});

function makeTestOrder(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 'ord_test_1',
    orderNumber: 'OP-2026-0006',
    createdAt: '2026-02-11T09:15:00.000Z',
    updatedAt: '2026-02-12T10:30:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    purpose: 'Achat tabac brut',
    beneficiaryName: 'Universal Leaf',
    beneficiaryCountry: 'États-Unis',
    beneficiaryAddress: 'Richmond',
    beneficiaryBank: 'JPMorgan',
    beneficiaryIban: 'US123',
    beneficiarySwift: 'CHASUS33',
    currency: 'USD',
    amount: 24000,
    amountInWords: 'vingt-quatre mille dollars',
    transferPurpose: 'Facture 114',
    invoiceNumber: 'FAC-114',
    invoiceDate: '2026-02-08',
    operationNature: 'Importation tabac brut',
    bankId: 'bank_stb',
    bankName: 'Société Tunisienne de Banque',
    bankBranch: 'Kairouan',
    bankFileRef: 'STB-EXT-2026-118',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    history: [],
    documents: [],
    isDemo: true,
    ...overrides,
  };
}

test('applyConsultationUpdateToOrder keeps EN_ATTENTE_ACHAT_DEVISE while quotes are open', () => {
  const order = makeTestOrder();
  const res = applyConsultationUpdateToOrder(order, {
    consultationId: 'cons_1',
    consultationNumber: 'CONS-2026-0001',
    quotes: [
      {
        bankId: 'bank_biat',
        bankName: 'BIAT',
        rate: 3.112,
        proposedAmount: 24000,
        isFullAmount: true,
        receivedAt: '2026-02-13T10:00:00.000Z',
      },
    ],
    closed: false,
    timestamp: '2026-02-13T10:05:00.000Z',
    user: { id: 'usr_agent1', name: 'Monia Ben Salem', role: 'AGENT_FINANCIER' },
  });

  assert.equal(res.statusChanged, false);
  assert.equal(res.order.status, 'EN_ATTENTE_ACHAT_DEVISE');
  assert.equal(res.order.exchangeTransaction?.status, 'NEGOCIE');
  assert.equal(res.order.history.length, 0);
});

test('applyConsultationUpdateToOrder transitions order to DEPOSE_BANQUE, sets rate, savings & history on closure', () => {
  const order = makeTestOrder();
  const res = applyConsultationUpdateToOrder(order, {
    consultationId: 'cons_1',
    consultationNumber: 'CONS-2026-0001',
    confirmationRef: '101/26',
    confirmationDate: '2026-02-13',
    valueDate: '2026-02-17',
    selectedBankId: 'bank_biat',
    selectedBankName: 'Banque Internationale Arabe de Tunisie',
    negotiatedRate: 3.112,
    quotes: [
      {
        bankId: 'bank_biat',
        bankName: 'BIAT',
        rate: 3.112,
        proposedAmount: 24000,
        isFullAmount: true,
        receivedAt: '2026-02-13T10:00:00.000Z',
      },
      {
        bankId: 'bank_stb',
        bankName: 'STB',
        rate: 3.132,
        proposedAmount: 24000,
        isFullAmount: true,
        receivedAt: '2026-02-13T10:00:00.000Z',
      },
    ],
    closed: true,
    timestamp: '2026-02-13T11:00:00.000Z',
    user: { id: 'usr_rf', name: 'Samir Trabelsi', role: 'RESPONSABLE_FINANCIER' },
  });

  assert.equal(res.statusChanged, true);
  assert.equal(res.order.status, 'DEPOSE_BANQUE');
  assert.equal(res.order.finalExchangeRate, 3.112);
  assert.equal(res.order.exchangeTransaction?.status, 'VALIDE');
  assert.equal(res.order.exchangeTransaction?.selectedBankName, 'Banque Internationale Arabe de Tunisie');
  assert.equal(res.order.exchangeTransaction?.finalNegotiatedRate, 3.112);
  assert.equal(res.order.exchangeTransaction?.savingsTnd, 480);
  assert.equal(res.order.history.length, 1);
  assert.equal(res.order.history[0].fromStatus, 'EN_ATTENTE_ACHAT_DEVISE');
  assert.equal(res.order.history[0].toStatus, 'DEPOSE_BANQUE');
  assert.match(res.order.history[0].comment ?? '', /CONS-2026-0001/);
  assert.match(res.order.history[0].comment ?? '', /101\/26/);
  assert.match(res.order.history[0].comment ?? '', /3\.1120 TND/);
  assert.equal(canUserPerformTransition(res.order.status, 'EXECUTE', 'RESPONSABLE_FINANCIER').allowed, true);
  assert.equal(canExecuteOrder(res.order).allowed, true);
});

test('canExecuteOrder blocks execution when negotiation is required until consultation is closed', () => {
  const pendingOrder = makeTestOrder({
    id: 'ord_neg_1',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    exchangeTransaction: { id: 'ex_1', orderId: 'ord_neg_1', status: 'NON_DEMARRE' },
  });

  // 1. Aucune consultation créée -> bloqué
  const checkNoCons = canExecuteOrder(pendingOrder, []);
  assert.equal(checkNoCons.allowed, false);
  assert.match(checkNoCons.reason ?? '', /négociation du cours est exigée/i);

  // 2. Consultation ouverte -> toujours bloqué avec référence de la consultation
  const openConsultation: Pick<CurrencyConsultation, 'orderIds' | 'status' | 'consultationNumber'> = {
    consultationNumber: 'CONS-2026-0009',
    orderIds: ['ord_neg_1'],
    status: 'OUVERTE',
  };
  const checkOpenCons = canExecuteOrder(pendingOrder, [openConsultation]);
  assert.equal(checkOpenCons.allowed, false);
  assert.equal(checkOpenCons.openConsultationNumber, 'CONS-2026-0009');
  assert.match(checkOpenCons.reason ?? '', /CONS-2026-0009/);

  // 3. Même si statut DEPOSE_BANQUE forcé sans validation d'achat devise -> bloqué
  const unvalidatedDeposited = makeTestOrder({
    id: 'ord_neg_1',
    requiresRateNegotiation: true,
    status: 'DEPOSE_BANQUE',
    exchangeTransaction: { id: 'ex_1', orderId: 'ord_neg_1', status: 'CONSULTATION_EN_COURS' },
  });
  assert.equal(canExecuteOrder(unvalidatedDeposited, [openConsultation]).allowed, false);

  // 4. Après clôture de la consultation -> autorisé
  const closedConsultation: Pick<CurrencyConsultation, 'orderIds' | 'status' | 'consultationNumber'> = {
    consultationNumber: 'CONS-2026-0009',
    orderIds: ['ord_neg_1'],
    status: 'CLOTUREE',
  };
  const afterClosure = makeTestOrder({
    id: 'ord_neg_1',
    requiresRateNegotiation: true,
    status: 'DEPOSE_BANQUE',
    exchangeTransaction: { id: 'ex_1', orderId: 'ord_neg_1', status: 'VALIDE' },
  });
  assert.equal(canExecuteOrder(afterClosure, [closedConsultation]).allowed, true);

  // 5. Ordre sans négociation exigée -> autorisé dès DEPOSE_BANQUE
  const directOrder = makeTestOrder({
    id: 'ord_direct',
    requiresRateNegotiation: false,
    status: 'DEPOSE_BANQUE',
  });
  assert.equal(canExecuteOrder(directOrder, []).allowed, true);
});


