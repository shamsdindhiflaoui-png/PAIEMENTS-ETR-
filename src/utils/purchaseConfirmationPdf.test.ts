import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPurchaseConfirmations,
  buildPurchaseConfirmationPdfDocument,
  formatTndCounterValue,
  computeDefaultValueDate,
  normalizeBankConfirmationContacts,
  getBankDeskInfo,
} from './purchaseConfirmationPdf';
import { Bank, CurrencyConsultation, PaymentOrder } from '../types/payment';

const TEST_BANKS: Bank[] = [
  { id: 'bank_bna', code: 'BNA', name: 'Banque Nationale Agricole', swiftCode: 'BNANTNTT', country: 'Tunisie', active: true },
  { id: 'bank_biat', code: 'BIAT', name: 'Banque Internationale Arabe de Tunisie', swiftCode: 'BIATTNTT', country: 'Tunisie', active: true },
  { id: 'bank_amen', code: 'AMEN', name: 'Amen Bank', swiftCode: 'CFCTTNTT', country: 'Tunisie', active: true },
  { id: 'bank_stb', code: 'STB', name: 'Société Tunisienne de Banque', swiftCode: 'STBKTNTT', country: 'Tunisie', active: true },
];

const ORDER_BNA: PaymentOrder = {
  id: 'ord_bna',
  orderNumber: 'OP-2026-0010',
  createdAt: '2026-11-12T08:00:00Z',
  updatedAt: '2026-11-12T08:00:00Z',
  createdBy: 'Monia Ben Salem',
  createdById: 'usr_agent1',
  purpose: 'Achat tabac',
  beneficiaryName: 'CNT',
  beneficiaryCountry: 'Suisse',
  beneficiaryAddress: 'Geneva',
  beneficiaryBank: 'UBS',
  beneficiaryIban: 'CH123',
  beneficiarySwift: 'UBSWCHZH',
  currency: 'USD',
  amount: 39000,
  amountInWords: 'trente-neuf mille dollars',
  transferPurpose: 'LC',
  invoiceNumber: 'INV-1',
  invoiceDate: '2026-11-01',
  operationNature: 'Importation',
  bankId: 'bank_bna',
  bankName: 'Banque Nationale Agricole',
  bankBranch: 'AGENCE KAIROUAN',
  bankFileRef: 'BNA-01',
  transferType: 'LC',
  lcNumber: 'CDI30279/014/26',
  status: 'EN_ATTENTE_ACHAT_DEVISE',
  history: [],
  documents: [],
  isDemo: true,
};

const ORDER_AMEN: PaymentOrder = {
  ...ORDER_BNA,
  id: 'ord_amen',
  orderNumber: 'OP-2026-0011',
  beneficiaryName: 'ALLIANCE ONE',
  amount: 140185.81,
  transferType: 'VIREMENT',
  lcNumber: undefined,
  bankId: 'bank_amen',
  bankName: 'Amen Bank',
  bankBranch: 'CAF SOUSSE',
};

test('formatTndCounterValue formats 3 decimals with space grouping', () => {
  assert.equal(formatTndCounterValue(118326), '118 326.000');
  assert.equal(formatTndCounterValue(423697.592), '423 697.592');
});

test('computeDefaultValueDate skips weekends cleanly', () => {
  // 2026-11-12 is Thursday -> +2 business days is Monday 2026-11-16
  assert.equal(computeDefaultValueDate('2026-11-12'), '2026-11-16');
});

test('Case 1 (102-26 rule): generates 1 confirmation when domiciliary bank equals purchase bank', () => {
  const consultation: CurrencyConsultation = {
    id: 'cons_102',
    consultationNumber: 'CONS-2026-0102',
    createdAt: '2026-11-12T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_bna'],
    orderNumbers: ['OP-2026-0010'],
    currency: 'USD',
    totalAmount: 39000,
    operationDate: '2026-11-12',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_bna',
    selectedBankName: 'Banque Nationale Agricole',
    negotiatedRate: 3.034,
    confirmationRef: '102/26',
    confirmationDate: '2026-11-12',
    valueDate: '2026-11-16',
    isDemo: true,
  };

  const letters = buildPurchaseConfirmations(consultation, [ORDER_BNA], TEST_BANKS);
  assert.equal(letters.length, 1);
  assert.equal(letters[0].role, 'SAME_BANK_PURCHASE');
  assert.equal(letters[0].recipientBankCode, 'BNA');
  assert.equal(letters[0].totalCounterValueTnd, 118326);
  assert.equal(letters[0].lines[0].lcNumber, 'CDI30279/014/26');

  const pdfBytes = buildPurchaseConfirmationPdfDocument(letters).output('arraybuffer');
  const header = new TextDecoder().decode(new Uint8Array(pdfBytes).slice(0, 5));
  assert.equal(header, '%PDF-');
});

test('Case 2 (101-26 rule): generates 2 confirmations when 1 domiciliary bank differs from purchase bank', () => {
  const consultation: CurrencyConsultation = {
    id: 'cons_101_single',
    consultationNumber: 'CONS-2026-0101',
    createdAt: '2026-11-11T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_amen'],
    orderNumbers: ['OP-2026-0011'],
    currency: 'USD',
    totalAmount: 140185.81,
    operationDate: '2026-11-11',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_biat',
    selectedBankName: 'Banque Internationale Arabe de Tunisie',
    negotiatedRate: 3.0224,
    confirmationRef: '101/26',
    confirmationDate: '2026-11-11',
    valueDate: '2026-11-13',
    isDemo: true,
  };

  const letters = buildPurchaseConfirmations(consultation, [ORDER_AMEN], TEST_BANKS);
  assert.equal(letters.length, 2);
  assert.equal(letters[0].role, 'DOMICILIARY_BANK');
  assert.equal(letters[0].recipientBankCode, 'AB');
  assert.equal(letters[1].role, 'PURCHASE_BANK');
  assert.equal(letters[1].recipientBankCode, 'BIAT');
  assert.deepEqual(letters[1].otherDomiciliaryBankLabels, ['AB']);
  assert.equal(letters[0].totalCounterValueTnd, letters[1].bctTransferCounterValueTnd);
});

test('Case 3 (101-26 multi-bank): generates 1 letter per distinct domiciliary bank + 1 letter for purchase bank', () => {
  const consultation: CurrencyConsultation = {
    id: 'cons_101_multi',
    consultationNumber: 'CONS-2026-0103',
    createdAt: '2026-11-11T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_amen', 'ord_bna'],
    orderNumbers: ['OP-2026-0011', 'OP-2026-0010'],
    currency: 'USD',
    totalAmount: 179185.81,
    operationDate: '2026-11-11',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_biat',
    selectedBankName: 'Banque Internationale Arabe de Tunisie',
    negotiatedRate: 3.0224,
    confirmationRef: '103/26',
    confirmationDate: '2026-11-11',
    valueDate: '2026-11-13',
    isDemo: true,
  };

  const letters = buildPurchaseConfirmations(consultation, [ORDER_AMEN, ORDER_BNA], TEST_BANKS);
  assert.equal(letters.length, 3);
  assert.equal(letters[0].role, 'DOMICILIARY_BANK');
  assert.equal(letters[0].recipientBankCode, 'AB');
  assert.equal(letters[1].role, 'DOMICILIARY_BANK');
  assert.equal(letters[1].recipientBankCode, 'BNA');
  assert.equal(letters[2].role, 'PURCHASE_BANK');
  assert.equal(letters[2].recipientBankCode, 'BIAT');
  assert.equal(letters[2].lines.length, 2);

  const pdfBytes = buildPurchaseConfirmationPdfDocument(letters).output('arraybuffer');
  assert.ok(pdfBytes.byteLength > 2000);
});

test('normalizeBankConfirmationContacts deduplicates case-insensitively and merges legacy contactEmails', () => {
  const normalized = normalizeBankConfirmationContacts(
    [
      { name: '  Wassim Attia ', role: ' Salle de change ', email: 'WASSIM.ATTIA@bna.tn ' },
      { name: 'Duplicate', email: 'wassim.attia@bna.tn' },
      { name: 'Empty email', email: '   ' },
    ],
    ['wassim.attia@bna.tn', 'Agence.Kairouan@bna.tn']
  );

  assert.equal(normalized.length, 2);
  assert.deepEqual(normalized[0], {
    id: undefined,
    name: 'Wassim Attia',
    role: 'Salle de change',
    email: 'WASSIM.ATTIA@bna.tn',
  });
  assert.deepEqual(normalized[1], {
    name: '',
    email: 'Agence.Kairouan@bna.tn',
  });
});

test('Custom bank confirmationContacts propagate to confirmation letters and PDF output', () => {
  const customBanks: Bank[] = [
    {
      ...TEST_BANKS[0],
      confirmationContacts: [
        { name: 'Leila Mansour', role: 'Chef Salle des Marchés', email: 'leila.mansour@bna.tn' },
      ],
      contactEmails: ['leila.mansour@bna.tn'],
    },
    {
      ...TEST_BANKS[1],
      confirmationContacts: [
        { name: 'Nadia Ben Ali', role: 'Trésorerie', email: 'nadia.benali@biat.com.tn' },
        { name: 'Hichem Gharbi', email: 'hichem.gharbi@biat.com.tn' },
      ],
      contactEmails: ['nadia.benali@biat.com.tn', 'hichem.gharbi@biat.com.tn'],
    },
  ];

  const deskBiat = getBankDeskInfo(customBanks[1]);
  assert.equal(deskBiat.confirmationContacts.length, 2);
  assert.equal(deskBiat.confirmationContacts[0].name, 'Nadia Ben Ali');
  assert.deepEqual(deskBiat.contactEmails, ['nadia.benali@biat.com.tn', 'hichem.gharbi@biat.com.tn']);

  const consultation: CurrencyConsultation = {
    id: 'cons_custom_contacts',
    consultationNumber: 'CONS-2026-0199',
    createdAt: '2026-11-12T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_bna'],
    orderNumbers: ['OP-2026-0010'],
    currency: 'USD',
    totalAmount: 39000,
    operationDate: '2026-11-12',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_biat',
    selectedBankName: 'Banque Internationale Arabe de Tunisie',
    negotiatedRate: 3.034,
    confirmationRef: '199/26',
    confirmationDate: '2026-11-12',
    valueDate: '2026-11-16',
    isDemo: true,
  };

  const letters = buildPurchaseConfirmations(consultation, [ORDER_BNA], customBanks);
  assert.equal(letters.length, 2);
  // Letter 0 -> domiciliary bank (BNA)
  assert.equal(letters[0].footerContacts?.length, 1);
  assert.equal(letters[0].footerContacts?.[0].name, 'Leila Mansour');
  assert.deepEqual(letters[0].footerEmails, ['leila.mansour@bna.tn']);

  // Letter 1 -> purchase bank (BIAT) includes purchase bank contacts + domiciliary bank contacts
  assert.equal(letters[1].footerContacts?.length, 3);
  assert.deepEqual(
    letters[1].footerContacts?.map(c => c.email),
    ['nadia.benali@biat.com.tn', 'hichem.gharbi@biat.com.tn', 'leila.mansour@bna.tn']
  );

  const pdfBytes = buildPurchaseConfirmationPdfDocument(letters).output('arraybuffer');
  const header = new TextDecoder().decode(new Uint8Array(pdfBytes).slice(0, 5));
  assert.equal(header, '%PDF-');
});

test('Contacts are filtered by order transferType (LC, VIREMENT, REMISE, AUTRE) on confirmation letters', () => {
  const bankWithTypedContacts: Bank = {
    ...TEST_BANKS[0],
    confirmationContacts: [
      {
        name: 'Contact LC Seulement',
        role: 'Crédits Documentaires',
        email: 'lc@bna.tn',
        orderTypes: ['LC'],
      },
      {
        name: 'Contact Virement & Remise',
        role: 'Transferts',
        email: 'virement@bna.tn',
        orderTypes: ['VIREMENT', 'REMISE'],
      },
      {
        name: 'Contact Tous Types',
        role: 'Salle de change',
        email: 'tous@bna.tn',
        orderTypes: ['LC', 'VIREMENT', 'REMISE', 'AUTRE'],
      },
    ],
  };

  const lcOnlyConsultation: CurrencyConsultation = {
    id: 'cons_lc_only',
    consultationNumber: 'CONS-2026-0210',
    createdAt: '2026-11-13T09:00:00Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    orderIds: ['ord_bna'], // transferType: 'LC'
    orderNumbers: ['OP-2026-0010'],
    currency: 'USD',
    totalAmount: 39000,
    operationDate: '2026-11-13',
    purchaseType: 'au comptant',
    submissionDeadlineTime: '14h20',
    validityDeadlineTime: '14h30',
    status: 'CLOTUREE',
    selectedBankId: 'bank_bna',
    selectedBankName: 'Banque Nationale Agricole',
    negotiatedRate: 3.034,
    confirmationRef: '210/26',
    confirmationDate: '2026-11-13',
    valueDate: '2026-11-17',
    isDemo: true,
  };

  const lcLetters = buildPurchaseConfirmations(lcOnlyConsultation, [ORDER_BNA], [bankWithTypedContacts]);
  assert.equal(lcLetters.length, 1);
  assert.deepEqual(
    lcLetters[0].footerContacts?.map(c => c.email),
    ['lc@bna.tn', 'tous@bna.tn']
  );

  const virOrder: PaymentOrder = {
    ...ORDER_BNA,
    id: 'ord_bna_vir',
    orderNumber: 'OP-2026-0012',
    transferType: 'VIREMENT',
    lcNumber: undefined,
  };
  const virOnlyConsultation: CurrencyConsultation = {
    ...lcOnlyConsultation,
    id: 'cons_vir_only',
    orderIds: ['ord_bna_vir'],
    orderNumbers: ['OP-2026-0012'],
  };

  const virLetters = buildPurchaseConfirmations(virOnlyConsultation, [virOrder], [bankWithTypedContacts]);
  assert.equal(virLetters.length, 1);
  assert.deepEqual(
    virLetters[0].footerContacts?.map(c => c.email),
    ['virement@bna.tn', 'tous@bna.tn']
  );

  const pdfBytes = buildPurchaseConfirmationPdfDocument(lcLetters).output('arraybuffer');
  assert.ok(pdfBytes.byteLength > 1500);
});

