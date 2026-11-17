import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAdminPermission,
  canUserManageConsultation,
  canUserManageInvoice,
  canUserManageOrder,
  detachOrderFromConsultations,
  findOrdersToDetachFromInvoice,
  findOrdersToResetFromConsultation,
  isAdministrator,
  isEntityCreator,
  syncOrderNumberInConsultations,
  validateAdminConsultationUpdate,
  validateAdminInvoiceUpdate,
  validateAdminOrderUpdate,
} from './adminRules';
import { CurrencyConsultation, Invoice, PaymentOrder, User } from '../types/payment';

const adminUser: User = {
  id: 'usr_admin',
  userCode: '000',
  name: 'Admin DFC',
  email: 'admin@mtk.tn',
  role: 'ADMINISTRATEUR',
  department: 'DFC',
};

const agentUser: User = {
  id: 'usr_agent1',
  userCode: '001',
  name: 'Monia Ben Salem',
  email: 'm@mtk.tn',
  role: 'AGENT_FINANCIER',
  department: 'DFC',
};

const sampleInvoice: Invoice = {
  id: 'inv_1',
  invoiceNumber: 'FAC-2026-001',
  invoiceDate: '2026-01-15',
  purpose: 'Importation tabac',
  operationNature: 'Importation tabac brut',
  supplierName: 'Leaf Co',
  supplierCountry: 'USA',
  supplierAddress: '100 Main St',
  supplierBank: 'Citi',
  supplierIban: 'US123',
  supplierSwift: 'CITIUS33',
  currency: 'USD',
  totalAmount: 100000,
  createdAt: '2026-01-15T10:00:00Z',
  createdBy: 'Agent',
  createdById: 'usr_agent1',
  isDemo: false,
};

const sampleOrder: PaymentOrder = {
  id: 'ord_1',
  orderNumber: '001-026-0001',
  createdAt: '2026-02-01T09:00:00Z',
  updatedAt: '2026-02-01T09:00:00Z',
  createdBy: 'Agent',
  createdById: 'usr_agent1',
  purpose: 'Règlement tranche 1',
  beneficiaryName: 'Leaf Co',
  beneficiaryCountry: 'USA',
  beneficiaryAddress: '100 Main St',
  beneficiaryBank: 'Citi',
  beneficiaryIban: 'US123',
  beneficiarySwift: 'CITIUS33',
  invoiceId: 'inv_1',
  currency: 'USD',
  grossAmount: 50000,
  deductionsTotal: 0,
  deductions: [],
  amount: 50000,
  amountInWords: 'cinquante mille dollars',
  transferPurpose: 'Règlement tranche 1',
  invoiceNumber: 'FAC-2026-001',
  invoiceDate: '2026-01-15',
  operationNature: 'Importation tabac brut',
  bankId: 'bnk_1',
  bankName: 'STB',
  bankBranch: 'Kairouan',
  bankFileRef: 'REF-1',
  status: 'EN_ATTENTE_ACHAT_DEVISE',
  history: [],
  documents: [],
  exchangeTransaction: {
    id: 'ex_1',
    orderId: 'ord_1',
    consultationId: 'cons_1',
    consultationNumber: 'CONS-2026-0001',
    status: 'CONSULTATION_EN_COURS',
  },
  isDemo: false,
};

const sampleOrder2: PaymentOrder = {
  ...sampleOrder,
  id: 'ord_2',
  orderNumber: '001-026-0002',
  amount: 30000,
  grossAmount: 30000,
};

const sampleConsultation: CurrencyConsultation = {
  id: 'cons_1',
  consultationNumber: 'CONS-2026-0001',
  createdAt: '2026-02-05T09:00:00Z',
  createdBy: 'Agent',
  createdById: 'usr_agent1',
  orderIds: ['ord_1', 'ord_2'],
  orderNumbers: ['001-026-0001', '001-026-0002'],
  currency: 'USD',
  totalAmount: 80000,
  operationDate: '2026-02-05',
  purchaseType: 'au comptant',
  submissionDeadlineTime: '14h20',
  validityDeadlineTime: '14h30',
  status: 'OUVERTE',
  isDemo: false,
};

test('isAdministrator & assertAdminPermission enforce ADMINISTRATEUR role', () => {
  assert.equal(isAdministrator(adminUser), true);
  assert.equal(isAdministrator(agentUser), false);
  assert.equal(isAdministrator(null), false);

  assert.equal(assertAdminPermission(adminUser).allowed, true);
  const denied = assertAdminPermission(agentUser);
  assert.equal(denied.allowed, false);
  assert.match(denied.reason || '', /Administrateur/i);
});

test('creators can manage their own orders, invoices, and consultations while non-creators are denied', () => {
  const otherUser: User = {
    id: 'usr_cg',
    userCode: '002',
    name: 'Karim Mezghani',
    email: 'k@mtk.tn',
    role: 'CONTROLE_GESTION',
    department: 'CG',
  };

  assert.equal(isEntityCreator(agentUser, sampleOrder), true);
  assert.equal(isEntityCreator(otherUser, sampleOrder), false);

  // Orders: creator allowed when not EXECUTE; other user denied; admin always allowed
  assert.equal(canUserManageOrder(agentUser, sampleOrder).allowed, true);
  assert.equal(canUserManageOrder(otherUser, sampleOrder).allowed, false);
  assert.equal(canUserManageOrder(adminUser, { ...sampleOrder, status: 'EXECUTE' }).allowed, true);
  assert.equal(canUserManageOrder(agentUser, { ...sampleOrder, status: 'EXECUTE' }).allowed, false);

  // Invoices: creator and admin allowed; other user denied
  assert.equal(canUserManageInvoice(agentUser, sampleInvoice).allowed, true);
  assert.equal(canUserManageInvoice(adminUser, sampleInvoice).allowed, true);
  assert.equal(canUserManageInvoice(otherUser, sampleInvoice).allowed, false);

  // Consultations: creator and admin allowed; other user denied
  assert.equal(canUserManageConsultation(agentUser, sampleConsultation).allowed, true);
  assert.equal(canUserManageConsultation(adminUser, sampleConsultation).allowed, true);
  assert.equal(canUserManageConsultation(otherUser, sampleConsultation).allowed, false);
});

test('validateAdminInvoiceUpdate checks uniqueness and positive totalAmount', () => {
  const otherInv: Invoice = { ...sampleInvoice, id: 'inv_2', invoiceNumber: 'FAC-2026-002' };

  const dup = validateAdminInvoiceUpdate({
    current: sampleInvoice,
    payload: { invoiceNumber: 'fac-2026-002' },
    existingInvoices: [sampleInvoice, otherInv],
  });
  assert.equal(dup.valid, false);

  const zeroAmt = validateAdminInvoiceUpdate({
    current: sampleInvoice,
    payload: { totalAmount: 0 },
    existingInvoices: [sampleInvoice, otherInv],
  });
  assert.equal(zeroAmt.valid, false);

  const ok = validateAdminInvoiceUpdate({
    current: sampleInvoice,
    payload: { invoiceNumber: 'FAC-2026-001-REV', totalAmount: 125000.456 },
    existingInvoices: [sampleInvoice, otherInv],
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalizedNumber, 'FAC-2026-001-REV');
  assert.equal(ok.totalAmount, 125000.46);
});

test('validateAdminOrderUpdate checks uniqueness excluding self and positive net amount', () => {
  const dup = validateAdminOrderUpdate({
    current: sampleOrder,
    payload: { orderNumber: '001-026-0002' },
    existingOrders: [sampleOrder, sampleOrder2],
  });
  assert.equal(dup.valid, false);

  const ok = validateAdminOrderUpdate({
    current: sampleOrder,
    payload: { orderNumber: '001-026-0001', amount: 45500 },
    existingOrders: [sampleOrder, sampleOrder2],
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.amount, 45500);
});

test('validateAdminConsultationUpdate checks uniqueness and mandatory fields', () => {
  const otherCons: CurrencyConsultation = {
    ...sampleConsultation,
    id: 'cons_2',
    consultationNumber: 'CONS-2026-0002',
  };

  const dup = validateAdminConsultationUpdate({
    current: sampleConsultation,
    payload: { consultationNumber: 'CONS-2026-0002' },
    existingConsultations: [sampleConsultation, otherCons],
  });
  assert.equal(dup.valid, false);

  const ok = validateAdminConsultationUpdate({
    current: sampleConsultation,
    payload: { consultationNumber: 'CONS-2026-0001-B', purchaseType: 'à terme 30 jours' },
    existingConsultations: [sampleConsultation, otherCons],
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalizedNumber, 'CONS-2026-0001-B');
});

test('detachOrderFromConsultations removes deleted order and recalculates totalAmount', () => {
  const affected = detachOrderFromConsultations(
    [sampleConsultation],
    'ord_1',
    [sampleOrder2]
  );
  assert.equal(affected.length, 1);
  assert.deepEqual(affected[0].orderIds, ['ord_2']);
  assert.deepEqual(affected[0].orderNumbers, ['001-026-0002']);
  assert.equal(affected[0].totalAmount, 30000);
});

test('syncOrderNumberInConsultations propagates updated orderNumber cleanly', () => {
  const affected = syncOrderNumberInConsultations([sampleConsultation], {
    ...sampleOrder,
    orderNumber: '001-026-0099',
  });
  assert.equal(affected.length, 1);
  assert.deepEqual(affected[0].orderNumbers, ['001-026-0099', '001-026-0002']);
});

test('findOrdersToDetachFromInvoice clears invoiceId on linked orders', () => {
  const detached = findOrdersToDetachFromInvoice([sampleOrder, { ...sampleOrder2, invoiceId: 'other' }], 'inv_1');
  assert.equal(detached.length, 1);
  assert.equal(detached[0].id, 'ord_1');
  assert.equal(detached[0].invoiceId, undefined);
});

test('findOrdersToResetFromConsultation resets exchangeTransaction on linked orders', () => {
  const reset = findOrdersToResetFromConsultation(
    [sampleOrder, { ...sampleOrder2, exchangeTransaction: undefined }],
    'cons_1'
  );
  assert.equal(reset.length, 1);
  assert.equal(reset[0].id, 'ord_1');
  assert.equal(reset[0].exchangeTransaction?.status, 'NON_DEMARRE');
  assert.equal(reset[0].exchangeTransaction?.consultationId, undefined);
});
