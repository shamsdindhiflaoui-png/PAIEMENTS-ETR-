import fs from 'fs';
import path from 'path';
import {
  PaymentOrder,
  Supplier,
  Bank,
  User,
  AuditLog,
  PaymentWorkflow,
  BankDeposit,
  ExchangeTransaction,
  DashboardStats,
  FilterParams,
  PaymentStatus,
  CurrencyConsultation,
  ExchangeQuote,
} from '../types/payment';
import { numberToFrenchWords } from '../utils/numberToFrenchWords';
import {
  applyConsultationUpdateToOrder,
  generateOrderNumber,
  generateStructuredOrderNumber,
  canUserPerformTransition,
  getDepositTargetStatus,
  normalizeLegacyStatus,
} from '../utils/workflowRules';
import {
  validateConsultationSelection,
  formatConsultationTime,
} from '../utils/consultationPdf';
import {
  computeDefaultValueDate,
  generateNextConfirmationRef,
  normalizeBankConfirmationContacts,
} from '../utils/purchaseConfirmationPdf';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'mtk_payments.json');

// Initial seed data
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin',
    userCode: '000',
    name: 'Admin DFC',
    email: 'admin.dfc@mtk.tn',
    role: 'ADMINISTRATEUR',
    department: 'Direction Générale / DFC',
  },
  {
    id: 'usr_agent1',
    userCode: '001',
    name: 'Monia Ben Salem',
    email: 'm.bensalem@mtk.tn',
    role: 'AGENT_FINANCIER',
    department: 'Service Trésorerie & Règlements Extérieurs',
  },
  {
    id: 'usr_cg',
    userCode: '002',
    name: 'Karim Mezghani',
    email: 'k.mezghani@mtk.tn',
    role: 'CONTROLE_GESTION',
    department: 'Direction du Contrôle de Gestion & Budget',
  },
  {
    id: 'usr_rf',
    userCode: '003',
    name: 'Samir Trabelsi',
    email: 's.trabelsi@mtk.tn',
    role: 'RESPONSABLE_FINANCIER',
    department: 'Directeur Financier et Comptable',
  },
];

export const INITIAL_BANKS: Bank[] = [
  {
    id: 'bank_stb',
    code: 'STB',
    name: 'Société Tunisienne de Banque',
    swiftCode: 'STBKTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'Agence Kairouan République (012)',
    tradingDeskName: 'STB SALLE DE CHANGE',
    tradingDeskAddress: 'STB SALLE DE CHANGE',
    tradingDeskFax: '70.140.415',
    tradingDeskPhone: '70.140.000',
    contactEmails: ['salle.change@stb.com.tn', 'Agence.Kairouan@stb.com.tn'],
    confirmationContacts: [
      { id: 'cnt_stb_1', name: 'Salle de Change STB', role: 'Salle des marchés', email: 'salle.change@stb.com.tn' },
      { id: 'cnt_stb_2', name: 'Agence Kairouan République', role: 'Domiciliation', email: 'Agence.Kairouan@stb.com.tn' },
    ],
  },
  {
    id: 'bank_bna',
    code: 'BNA',
    name: 'Banque Nationale Agricole',
    swiftCode: 'BNANTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'AGENCE KAIROUAN',
    tradingDeskName: 'BNA SALLE DE CHANGE',
    tradingDeskAddress: 'BNA SALLE DE CHANGE',
    tradingDeskFax: '70.257.362',
    contactEmails: ['WASSIM.ATTIA@bna.tn', 'SANA.CHEFFAI@bna.tn', 'Agence.Kairouan@bna.tn'],
    confirmationContacts: [
      { id: 'cnt_bna_1', name: 'Wassim Attia', role: 'Salle de change', email: 'WASSIM.ATTIA@bna.tn' },
      { id: 'cnt_bna_2', name: 'Sana Cheffai', role: 'Salle de change', email: 'SANA.CHEFFAI@bna.tn' },
      { id: 'cnt_bna_3', name: 'Agence Kairouan', role: 'Domiciliation', email: 'Agence.Kairouan@bna.tn' },
    ],
  },
  {
    id: 'bank_bh',
    code: 'BH',
    name: 'BH Bank',
    swiftCode: 'BHTNTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'Agence Kairouan Okba (008)',
    tradingDeskName: 'BH BANK SALLE DE MARCHE',
    tradingDeskAddress: 'BH BANK SALLE DE MARCHE',
    tradingDeskFax: '71.790.240',
    contactEmails: ['marches@bhbank.tn', 'Agence.Kairouan@bhbank.tn'],
    confirmationContacts: [
      { id: 'cnt_bh_1', name: 'Salle des Marchés BH', role: 'Salle de marché', email: 'marches@bhbank.tn' },
      { id: 'cnt_bh_2', name: 'Agence Kairouan Okba', role: 'Domiciliation', email: 'Agence.Kairouan@bhbank.tn' },
    ],
  },
  {
    id: 'bank_biat',
    code: 'BIAT',
    name: 'Banque Internationale Arabe de Tunisie',
    swiftCode: 'BIATTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'Agence Kairouan Centre (021)',
    tradingDeskName: 'BIAT (Salle de change)',
    tradingDeskAddress: 'Markets.Sales@biat.com.tn',
    tradingDeskFax: '71.340.958 / 71.344.524',
    tradingDeskPhone: '71.336.472',
    contactEmails: ['Markets.Sales@biat.com.tn', 'Agence.Kairouan@biat.tn'],
    confirmationContacts: [
      { id: 'cnt_biat_1', name: 'Markets & Sales', role: 'Salle de change', email: 'Markets.Sales@biat.com.tn' },
      { id: 'cnt_biat_2', name: 'Agence Kairouan', role: 'Domiciliation', email: 'Agence.Kairouan@biat.tn' },
    ],
  },
  {
    id: 'bank_attijari',
    code: 'ATTIJARI',
    name: 'Attijari bank Tunisie',
    swiftCode: 'BSTNTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'Agence Kairouan Mansoura (015)',
    tradingDeskName: 'ATTIJARI SALLE DES MARCHES',
    tradingDeskAddress: 'ATTIJARI SALLE DES MARCHES',
    tradingDeskFax: '71.111.300',
    contactEmails: ['salle.marches@attijaribank.com.tn', 'Agence.Kairouan@attijaribank.com.tn'],
    confirmationContacts: [
      { id: 'cnt_att_1', name: 'Salle des Marchés Attijari', role: 'Salle des marchés', email: 'salle.marches@attijaribank.com.tn' },
      { id: 'cnt_att_2', name: 'Agence Kairouan Mansoura', role: 'Domiciliation', email: 'Agence.Kairouan@attijaribank.com.tn' },
    ],
  },
  {
    id: 'bank_amen',
    code: 'AMEN',
    name: 'Amen Bank',
    swiftCode: 'CFCTTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'Agence Kairouan Allani (042)',
    tradingDeskName: 'AB SALLE DE MARCHE',
    tradingDeskAddress: 'AB SALLE DE MARCHE',
    tradingDeskFax: '71.831.122 / 71.835.402',
    contactEmails: ['imen.baklouti@amenbank.com.tn', 'mohamedamine.essid@amenbank.com.tn'],
    confirmationContacts: [
      { id: 'cnt_amen_1', name: 'Imen Baklouti', role: 'Salle de marché', email: 'imen.baklouti@amenbank.com.tn' },
      { id: 'cnt_amen_2', name: 'Mohamed Amine Essid', role: 'Salle de marché', email: 'mohamedamine.essid@amenbank.com.tn' },
    ],
  },
  {
    id: 'bank_uib',
    code: 'UIB',
    name: 'Union Internationale de Banques',
    swiftCode: 'UIBKTNTT',
    country: 'Tunisie',
    active: true,
    contactAgency: 'Agence Kairouan Ville (009)',
    tradingDeskName: 'UIB SALLE DES MARCHES',
    tradingDeskAddress: 'UIB SALLE DES MARCHES',
    tradingDeskFax: '71.800.912',
    contactEmails: ['salle.marches@uib.com.tn', 'Agence.Kairouan@uib.com.tn'],
    confirmationContacts: [
      { id: 'cnt_uib_1', name: 'Salle des Marchés UIB', role: 'Salle des marchés', email: 'salle.marches@uib.com.tn' },
      { id: 'cnt_uib_2', name: 'Agence Kairouan Ville', role: 'Domiciliation', email: 'Agence.Kairouan@uib.com.tn' },
    ],
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_universal_leaf',
    code: 'FOURN-001',
    name: 'Universal Leaf Tobacco Company Inc.',
    country: 'États-Unis',
    address: '9201 Forest Hill Avenue, Richmond, VA 23235',
    bankName: 'JPMorgan Chase Bank, N.A., New York',
    iban: 'US89CHAS32009876543210',
    swift: 'CHASUS33',
    email: 'invoicing@universalcorp.com',
    phone: '+1 804 359 9311',
    active: true,
  },
  {
    id: 'sup_swm_glatfelter',
    code: 'FOURN-002',
    name: 'SWM International (Schweitzer-Mauduit)',
    country: 'France',
    address: 'Papeteries de Kergroës, 29393 Quimperlé Cedex',
    bankName: 'BNP Paribas Paris Opéra',
    iban: 'FR7630004008920001234567890',
    swift: 'BNPAFRRP',
    email: 'contact.paper@swmintl.com',
    phone: '+33 2 98 96 40 00',
    active: true,
  },
  {
    id: 'sup_hauni',
    code: 'FOURN-003',
    name: 'Hauni Maschinenbau GmbH (Körber Technologies)',
    country: 'Allemagne',
    address: 'Kampchaussee 8-32, 21033 Hamburg',
    bankName: 'Deutsche Bank AG Hamburg',
    iban: 'DE89200700000123456789',
    swift: 'DEUTDEDBHAM',
    email: 'spareparts@koerber-technologies.com',
    phone: '+49 40 7250 01',
    active: true,
  },
  {
    id: 'sup_mane',
    code: 'FOURN-004',
    name: 'V. MANE FILS SA',
    country: 'France',
    address: '620 Route de Grasse, 06620 Le Bar-sur-Loup',
    bankName: 'Crédit Agricole Provence Côte d’Azur',
    iban: 'FR7618206001234567890123456',
    swift: 'AGRIFRPP882',
    email: 'finance.flavours@mane.com',
    phone: '+33 4 92 42 42 42',
    active: true,
  },
  {
    id: 'sup_gd',
    code: 'FOURN-005',
    name: 'G.D S.p.A. (Coesia Group)',
    country: 'Italie',
    address: 'Via Battindarno 91, 40133 Bologna',
    bankName: 'UniCredit S.p.A. Bologna',
    iban: 'IT60X0200802400000012345678',
    swift: 'UNCRITM1B01',
    email: 'admin.sales@gdpack.com',
    phone: '+39 051 647 3111',
    active: true,
  },
  {
    id: 'sup_bat_raw',
    code: 'FOURN-006',
    name: 'BAT Raw Materials Trading Ltd',
    country: 'Royaume-Uni',
    address: 'Globe House, 4 Temple Place, London WC2R 2PG',
    bankName: 'HSBC Bank plc London',
    iban: 'GB29MIDL40051512345678',
    swift: 'HBUKGB41B',
    email: 'leaf.settlements@bat.com',
    phone: '+44 20 7845 1000',
    active: true,
  },
];

export const INITIAL_ORDERS: PaymentOrder[] = [
  // 1. Ordre exécuté avec SWIFT et cotation de change
  {
    id: 'ord_demo_01',
    orderNumber: 'OP-2026-0001',
    fiscalYear: 2026,
    createdAt: '2026-01-15T09:30:00.000Z',
    updatedAt: '2026-01-24T14:15:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction des Approvisionnements',
    purpose: 'Règlement importation lots tabac brut Virginie Flue-Cured',
    supplierId: 'sup_universal_leaf',
    beneficiaryName: 'Universal Leaf Tobacco Company Inc.',
    beneficiaryCountry: 'États-Unis',
    beneficiaryAddress: '9201 Forest Hill Avenue, Richmond, VA 23235',
    beneficiaryBank: 'JPMorgan Chase Bank, N.A., New York',
    beneficiaryIban: 'US89CHAS32009876543210',
    beneficiarySwift: 'CHASUS33',
    currency: 'USD',
    amount: 145000,
    amountInWords: numberToFrenchWords(145000, 'USD'),
    transferPurpose: 'Paiement Facture PROFORMA ULT-2026-019',
    invoiceNumber: 'FAC-ULT-88902',
    invoiceDate: '2026-01-10',
    domiciliationNumber: 'DOM-2026-STB-0087',
    operationNature: 'Importation matières premières industrielles',
    bankId: 'bank_stb',
    bankName: 'Société Tunisienne de Banque',
    bankBranch: 'Agence Kairouan République',
    bankFileRef: 'STB-EXT-2026-042',
    remarks: 'Dossier prioritaire pour continuité de la chaîne de fabrication.',
    requiresRateNegotiation: true,
    status: 'EXECUTE',
    isDemo: true,
    history: [
      {
        id: 'wf_01_1',
        orderId: 'ord_demo_01',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-01-15T09:30:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Création et enregistrement initial du dossier de paiement.',
      },
      {
        id: 'wf_01_2',
        orderId: 'ord_demo_01',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-01-15T11:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Transmission pour signature officielle de la DFC.',
      },
      {
        id: 'wf_01_3',
        orderId: 'ord_demo_01',
        fromStatus: 'TRANSMIS_SIGNATURE',
        toStatus: 'SIGNE',
        timestamp: '2026-01-16T15:20:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Ordre signé et autorisé pour dépôt bancaire.',
      },
      {
        id: 'wf_01_4',
        orderId: 'ord_demo_01',
        fromStatus: 'SIGNE',
        toStatus: 'EN_ATTENTE_ACHAT_DEVISE',
        timestamp: '2026-01-18T10:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Dépôt à la STB Kairouan (négociation de cours exigée -> En attente d’achat devise).',
      },
      {
        id: 'wf_01_5',
        orderId: 'ord_demo_01',
        fromStatus: 'EN_ATTENTE_ACHAT_DEVISE',
        toStatus: 'EXECUTE',
        timestamp: '2026-01-24T14:15:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Achat de devise conclu à 3.1200 TND et avis de débit SWIFT MT103 reçu.',
      },
    ],
    deposit: {
      id: 'dep_01',
      orderId: 'ord_demo_01',
      bankId: 'bank_stb',
      bankName: 'Société Tunisienne de Banque',
      depositDate: '2026-01-18',
      slipNumber: 'BORD-2026-STB-014',
      bankReference: 'STB-DEP-8841',
      depositedBy: 'Monia Ben Salem',
      notes: 'Remise en mains propres au chef d’agence M. Chahed.',
    },
    executionDate: '2026-01-24',
    executingBank: 'Société Tunisienne de Banque (STB)',
    executedAmount: 145000,
    finalExchangeRate: 3.1200,
    debitAmountTnd: 452400.000,
    accountDebitDate: '2026-01-24',
    swiftReference: 'SWIFT-MT103-STB202601249912',
    bankFees: 450.000,
    exchangeTransaction: {
      id: 'ex_01',
      orderId: 'ord_demo_01',
      status: 'VALIDE',
      consultationDate: '2026-01-20',
      referenceCentralBankRate: 3.1420,
      finalNegotiatedRate: 3.1200,
      savingsTnd: 3190.000,
      validatedAt: '2026-01-20T11:30:00.000Z',
      validatedBy: 'Samir Trabelsi',
      notes: 'Taux négocié avantageux par rapport au cours BCT.',
    },
    documents: [
      {
        id: 'doc_01_1',
        orderId: 'ord_demo_01',
        name: 'Facture_Universal_Leaf_88902.pdf',
        type: 'FACTURE',
        size: 452000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-01-15T09:32:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
      {
        id: 'doc_01_2',
        orderId: 'ord_demo_01',
        name: 'Fiche_Domiciliation_DOM2026STB.pdf',
        type: 'DOMICILIATION',
        size: 320000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-01-15T09:35:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
      {
        id: 'doc_01_3',
        orderId: 'ord_demo_01',
        name: 'Avis_Debit_SWIFT_MT103.pdf',
        type: 'AVIS_DEBIT_SWIFT',
        size: 198000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-01-24T14:16:00.000Z',
        uploadedBy: 'Samir Trabelsi',
      },
    ],
  },

  // 2. Ordre en attente de validation par le Contrôle de Gestion
  {
    id: 'ord_demo_02',
    orderNumber: 'OP-2026-0002',
    fiscalYear: 2026,
    createdAt: '2026-02-02T10:15:00.000Z',
    updatedAt: '2026-02-02T11:30:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction Technique & Maintenance',
    purpose: 'Acquisition pièces de rechange d’origine pour chaîne Hauni Protos 90',
    supplierId: 'sup_hauni',
    beneficiaryName: 'Hauni Maschinenbau GmbH (Körber Technologies)',
    beneficiaryCountry: 'Allemagne',
    beneficiaryAddress: 'Kampchaussee 8-32, 21033 Hamburg',
    beneficiaryBank: 'Deutsche Bank AG Hamburg',
    beneficiaryIban: 'DE89200700000123456789',
    beneficiarySwift: 'DEUTDEDBHAM',
    currency: 'EUR',
    amount: 68500,
    amountInWords: numberToFrenchWords(68500, 'EUR'),
    transferPurpose: 'Règlement facture pièces de maintenance préventive',
    invoiceNumber: 'HAU-INV-2026-441',
    invoiceDate: '2026-01-28',
    domiciliationNumber: 'DOM-2026-BNA-0112',
    operationNature: 'Pièces de rechange industrielles',
    bankId: 'bank_bna',
    bankName: 'Banque Nationale Agricole',
    bankBranch: 'Agence Kairouan Médina',
    bankFileRef: 'BNA-EXT-2026-019',
    remarks: 'Livraison express par DHL express Allemagne.',
    requiresRateNegotiation: false,
    status: 'TRANSMIS_SIGNATURE',
    isDemo: true,
    history: [
      {
        id: 'wf_02_1',
        orderId: 'ord_demo_02',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-02-02T10:15:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Saisie complète des données fournisseur et bancaires.',
      },
      {
        id: 'wf_02_2',
        orderId: 'ord_demo_02',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-02-02T11:30:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Dossier transmis pour signature avec facture d’origine et certificat douanier.',
      },
    ],
    documents: [
      {
        id: 'doc_02_1',
        orderId: 'ord_demo_02',
        name: 'Hauni_Invoice_2026_441.pdf',
        type: 'FACTURE',
        size: 512000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-02-02T10:20:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
    ],
  },

  // 3. Ordre validé par CG, prêt pour dépôt bancaire
  {
    id: 'ord_demo_03',
    orderNumber: 'OP-2026-0003',
    fiscalYear: 2026,
    createdAt: '2026-02-04T14:00:00.000Z',
    updatedAt: '2026-02-05T09:45:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction Industrielle',
    purpose: 'Fourniture papier à cigarettes bobines et manchettes filtres',
    supplierId: 'sup_swm_glatfelter',
    beneficiaryName: 'SWM International (Schweitzer-Mauduit)',
    beneficiaryCountry: 'France',
    beneficiaryAddress: 'Papeteries de Kergroës, 29393 Quimperlé Cedex',
    beneficiaryBank: 'BNP Paribas Paris Opéra',
    beneficiaryIban: 'FR7630004008920001234567890',
    beneficiarySwift: 'BNPAFRRP',
    currency: 'EUR',
    amount: 112400,
    amountInWords: numberToFrenchWords(112400, 'EUR'),
    transferPurpose: 'Paiement acompte 50% commande trimestrielle papier',
    invoiceNumber: 'SWM-FR-99302',
    invoiceDate: '2026-02-01',
    domiciliationNumber: 'DOM-2026-BIAT-0043',
    operationNature: 'Consommables de fabrication tabac',
    bankId: 'bank_biat',
    bankName: 'Banque Internationale Arabe de Tunisie',
    bankBranch: 'Agence Kairouan Centre',
    bankFileRef: 'BIAT-EXT-2026-077',
    remarks: 'Bon de commande MTK-BC-2026-081 joint au dossier.',
    requiresRateNegotiation: true,
    status: 'SIGNE',
    isDemo: true,
    history: [
      {
        id: 'wf_03_1',
        orderId: 'ord_demo_03',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-02-04T14:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Saisie initiale.',
      },
      {
        id: 'wf_03_2',
        orderId: 'ord_demo_03',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-02-04T16:15:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Soumis pour signature.',
      },
      {
        id: 'wf_03_3',
        orderId: 'ord_demo_03',
        fromStatus: 'TRANSMIS_SIGNATURE',
        toStatus: 'SIGNE',
        timestamp: '2026-02-05T09:45:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Ordre signé. Bon pour dépôt bancaire (avec négociation de cours exigée).',
      },
    ],
    documents: [
      {
        id: 'doc_03_1',
        orderId: 'ord_demo_03',
        name: 'Facture_Proforma_SWM_99302.pdf',
        type: 'FACTURE',
        size: 384000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-02-04T14:05:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
      {
        id: 'doc_03_2',
        orderId: 'ord_demo_03',
        name: 'Bon_Commande_MTK_081.pdf',
        type: 'CONTRAT',
        size: 640000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-02-04T14:07:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
    ],
  },

  // 4. Ordre déposé à la banque, prêt pour négociation de change (Module 02)
  {
    id: 'ord_demo_04',
    orderNumber: 'OP-2026-0004',
    fiscalYear: 2026,
    createdAt: '2026-02-06T08:30:00.000Z',
    updatedAt: '2026-02-08T15:20:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction Industrielle',
    purpose: 'Importation essences arômes tabac blond et oriental',
    supplierId: 'sup_mane',
    beneficiaryName: 'V. MANE FILS SA',
    beneficiaryCountry: 'France',
    beneficiaryAddress: '620 Route de Grasse, 06620 Le Bar-sur-Loup',
    beneficiaryBank: 'Crédit Agricole Provence Côte d’Azur',
    beneficiaryIban: 'FR7618206001234567890123456',
    beneficiarySwift: 'AGRIFRPP882',
    currency: 'EUR',
    amount: 54300,
    amountInWords: numberToFrenchWords(54300, 'EUR'),
    transferPurpose: 'Règlement commande trimestrielle arômes conformes CEE',
    invoiceNumber: 'MANE-2026-0914',
    invoiceDate: '2026-02-03',
    domiciliationNumber: 'DOM-2026-STB-0105',
    operationNature: 'Additifs et arômes de fabrication',
    bankId: 'bank_stb',
    bankName: 'Société Tunisienne de Banque',
    bankBranch: 'Agence Kairouan République',
    bankFileRef: 'STB-EXT-2026-091',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    isDemo: true,
    history: [
      {
        id: 'wf_04_1',
        orderId: 'ord_demo_04',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-02-06T08:30:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Dossier initié.',
      },
      {
        id: 'wf_04_2',
        orderId: 'ord_demo_04',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-02-06T10:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Transmis pour signature.',
      },
      {
        id: 'wf_04_3',
        orderId: 'ord_demo_04',
        fromStatus: 'TRANSMIS_SIGNATURE',
        toStatus: 'SIGNE',
        timestamp: '2026-02-07T11:00:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Signé favorablement.',
      },
      {
        id: 'wf_04_4',
        orderId: 'ord_demo_04',
        fromStatus: 'SIGNE',
        toStatus: 'EN_ATTENTE_ACHAT_DEVISE',
        timestamp: '2026-02-08T15:20:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Déposé auprès de la STB (négociation de cours exigée : en attente d’achat devise).',
      },
    ],
    deposit: {
      id: 'dep_04',
      orderId: 'ord_demo_04',
      bankId: 'bank_stb',
      bankName: 'Société Tunisienne de Banque',
      depositDate: '2026-02-08',
      slipNumber: 'BORD-2026-STB-028',
      bankReference: 'STB-EXT-99120',
      depositedBy: 'Monia Ben Salem',
      notes: 'Bordereau avec accusé de réception visé par la banque.',
    },
    exchangeTransaction: {
      id: 'ex_04',
      orderId: 'ord_demo_04',
      status: 'NON_DEMARRE',
    },
    documents: [
      {
        id: 'doc_04_1',
        orderId: 'ord_demo_04',
        name: 'Facture_Mane_Fils_0914.pdf',
        type: 'FACTURE',
        size: 420000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-02-06T08:35:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
      {
        id: 'doc_04_2',
        orderId: 'ord_demo_04',
        name: 'Accuse_Reception_Bordereau_STB.pdf',
        type: 'BORDEREAU_DEPOT',
        size: 265000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-02-08T15:21:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
    ],
  },

  // 5. Ordre retourné pour correction
  {
    id: 'ord_demo_05',
    orderNumber: 'OP-2026-0005',
    fiscalYear: 2026,
    createdAt: '2026-02-09T09:00:00.000Z',
    updatedAt: '2026-02-10T14:30:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction Financière et Comptable',
    purpose: 'Règlement assistance technique et révision automate paquetage',
    supplierId: 'sup_gd',
    beneficiaryName: 'G.D S.p.A. (Coesia Group)',
    beneficiaryCountry: 'Italie',
    beneficiaryAddress: 'Via Battindarno 91, 40133 Bologna',
    beneficiaryBank: 'UniCredit S.p.A. Bologna',
    beneficiaryIban: 'IT60X0200802400000012345678',
    beneficiarySwift: 'UNCRITM1B01',
    currency: 'EUR',
    amount: 32800,
    amountInWords: numberToFrenchWords(32800, 'EUR'),
    transferPurpose: 'Prestation intervention ingénieur site Kairouan',
    invoiceNumber: 'GD-IT-2026-78',
    invoiceDate: '2026-02-02',
    domiciliationNumber: 'DOM-2026-BH-0021',
    operationNature: 'Prestations de services et assistance technique',
    bankId: 'bank_bh',
    bankName: 'BH Bank',
    bankBranch: 'Agence Kairouan Okba',
    bankFileRef: 'BH-EXT-2026-011',
    requiresRateNegotiation: false,
    status: 'DEPOSE_BANQUE',
    isDemo: true,
    history: [
      {
        id: 'wf_05_1',
        orderId: 'ord_demo_05',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-02-09T09:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Saisie initiale.',
      },
      {
        id: 'wf_05_2',
        orderId: 'ord_demo_05',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-02-09T11:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Transmis pour signature.',
      },
      {
        id: 'wf_05_3',
        orderId: 'ord_demo_05',
        fromStatus: 'TRANSMIS_SIGNATURE',
        toStatus: 'SIGNE',
        timestamp: '2026-02-10T10:15:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Signé pour dépôt direct (négociation de cours non exigée).',
      },
      {
        id: 'wf_05_4',
        orderId: 'ord_demo_05',
        fromStatus: 'SIGNE',
        toStatus: 'DEPOSE_BANQUE',
        timestamp: '2026-02-10T14:30:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Déposé directement à BH Bank Kairouan.',
      },
    ],
    deposit: {
      id: 'dep_05',
      orderId: 'ord_demo_05',
      bankId: 'bank_bh',
      bankName: 'BH Bank',
      depositDate: '2026-02-10',
      slipNumber: 'BORD-2026-BH-011',
      bankReference: 'BH-DEP-4410',
      depositedBy: 'Monia Ben Salem',
      notes: 'Dépôt direct sans négociation préalable de cours.',
    },
    documents: [
      {
        id: 'doc_05_1',
        orderId: 'ord_demo_05',
        name: 'Facture_GD_2026_78.pdf',
        type: 'FACTURE',
        size: 310000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-02-09T09:05:00.000Z',
        uploadedBy: 'Monia Ben Salem',
      },
    ],
  },

  // 6. Ordre USD déposé à la banque en attente d'achat devise (24 000 USD)
  {
    id: 'ord_demo_06',
    orderNumber: 'OP-2026-0006',
    fiscalYear: 2026,
    createdAt: '2026-02-11T09:15:00.000Z',
    updatedAt: '2026-02-12T10:30:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction des Approvisionnements',
    purpose: 'Importation lot tabac Burley - Tranche A',
    supplierId: 'sup_universal_leaf',
    beneficiaryName: 'Universal Leaf Tobacco Company Inc.',
    beneficiaryCountry: 'États-Unis',
    beneficiaryAddress: '9201 Forest Hill Avenue, Richmond, VA 23235',
    beneficiaryBank: 'JPMorgan Chase Bank, N.A., New York',
    beneficiaryIban: 'US89CHAS32009876543210',
    beneficiarySwift: 'CHASUS33',
    currency: 'USD',
    amount: 24000,
    amountInWords: numberToFrenchWords(24000, 'USD'),
    transferPurpose: 'Règlement facture ULT-2026-114',
    invoiceNumber: 'FAC-ULT-2026-114',
    invoiceDate: '2026-02-08',
    contractNumber: 'CT-2026/MTK-018',
    operationNature: 'Importation tabac brut',
    bankId: 'bank_stb',
    bankName: 'Société Tunisienne de Banque',
    bankBranch: 'Agence Kairouan République',
    bankFileRef: 'STB-EXT-2026-118',
    transferType: 'VIREMENT',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    isDemo: true,
    history: [
      {
        id: 'wf_06_1',
        orderId: 'ord_demo_06',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-02-11T09:15:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Saisie initiale du dossier.',
      },
      {
        id: 'wf_06_2',
        orderId: 'ord_demo_06',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-02-11T11:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Transmis pour signature.',
      },
      {
        id: 'wf_06_3',
        orderId: 'ord_demo_06',
        fromStatus: 'TRANSMIS_SIGNATURE',
        toStatus: 'SIGNE',
        timestamp: '2026-02-11T16:00:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Signé avec négociation de cours exigée.',
      },
      {
        id: 'wf_06_4',
        orderId: 'ord_demo_06',
        fromStatus: 'SIGNE',
        toStatus: 'EN_ATTENTE_ACHAT_DEVISE',
        timestamp: '2026-02-12T10:30:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Déposé à la STB (négociation du cours exigée -> En attente d’achat devise).',
      },
    ],
    deposit: {
      id: 'dep_06',
      orderId: 'ord_demo_06',
      bankId: 'bank_stb',
      bankName: 'Société Tunisienne de Banque',
      depositDate: '2026-02-12',
      slipNumber: 'BORD-2026-STB-045',
      bankReference: 'STB-DEP-11402',
      depositedBy: 'Monia Ben Salem',
      notes: 'Dépôt effectué avec négociation de devise requise.',
    },
    exchangeTransaction: {
      id: 'ex_06',
      orderId: 'ord_demo_06',
      status: 'NON_DEMARRE',
    },
    documents: [],
  },

  // 7. Second ordre USD déposé à la banque en attente d'achat devise (15 000 USD -> total regroupé = 39 000 USD)
  {
    id: 'ord_demo_07',
    orderNumber: 'OP-2026-0007',
    fiscalYear: 2026,
    createdAt: '2026-02-11T10:00:00.000Z',
    updatedAt: '2026-02-12T11:00:00.000Z',
    createdBy: 'Monia Ben Salem',
    createdById: 'usr_agent1',
    department: 'Direction des Approvisionnements',
    purpose: 'Importation lot tabac Burley - Tranche B',
    supplierId: 'sup_universal_leaf',
    beneficiaryName: 'Universal Leaf Tobacco Company Inc.',
    beneficiaryCountry: 'États-Unis',
    beneficiaryAddress: '9201 Forest Hill Avenue, Richmond, VA 23235',
    beneficiaryBank: 'JPMorgan Chase Bank, N.A., New York',
    beneficiaryIban: 'US89CHAS32009876543210',
    beneficiarySwift: 'CHASUS33',
    currency: 'USD',
    amount: 15000,
    amountInWords: numberToFrenchWords(15000, 'USD'),
    transferPurpose: 'Règlement facture ULT-2026-115',
    invoiceNumber: 'FAC-ULT-2026-115',
    invoiceDate: '2026-02-09',
    contractNumber: 'CT-2026/MTK-019',
    operationNature: 'Importation tabac brut',
    bankId: 'bank_biat',
    bankName: 'Banque Internationale Arabe de Tunisie',
    bankBranch: 'Agence Kairouan Centre',
    bankFileRef: 'BIAT-EXT-2026-095',
    transferType: 'VIREMENT',
    requiresRateNegotiation: true,
    status: 'EN_ATTENTE_ACHAT_DEVISE',
    isDemo: true,
    history: [
      {
        id: 'wf_07_1',
        orderId: 'ord_demo_07',
        fromStatus: 'INITIAL',
        toStatus: 'SAISI',
        timestamp: '2026-02-11T10:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Saisie initiale du dossier.',
      },
      {
        id: 'wf_07_2',
        orderId: 'ord_demo_07',
        fromStatus: 'SAISI',
        toStatus: 'TRANSMIS_SIGNATURE',
        timestamp: '2026-02-11T11:15:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Transmis pour signature.',
      },
      {
        id: 'wf_07_3',
        orderId: 'ord_demo_07',
        fromStatus: 'TRANSMIS_SIGNATURE',
        toStatus: 'SIGNE',
        timestamp: '2026-02-11T16:10:00.000Z',
        userId: 'usr_rf',
        userName: 'Samir Trabelsi',
        userRole: 'RESPONSABLE_FINANCIER',
        comment: 'Signé avec négociation de cours exigée.',
      },
      {
        id: 'wf_07_4',
        orderId: 'ord_demo_07',
        fromStatus: 'SIGNE',
        toStatus: 'EN_ATTENTE_ACHAT_DEVISE',
        timestamp: '2026-02-12T11:00:00.000Z',
        userId: 'usr_agent1',
        userName: 'Monia Ben Salem',
        userRole: 'AGENT_FINANCIER',
        comment: 'Déposé à la BIAT (négociation du cours exigée -> En attente d’achat devise).',
      },
    ],
    deposit: {
      id: 'dep_07',
      orderId: 'ord_demo_07',
      bankId: 'bank_biat',
      bankName: 'Banque Internationale Arabe de Tunisie',
      depositDate: '2026-02-12',
      slipNumber: 'BORD-2026-BIAT-019',
      bankReference: 'BIAT-DEP-33901',
      depositedBy: 'Monia Ben Salem',
      notes: 'Prêt pour regroupement en consultation d’achat devise.',
    },
    exchangeTransaction: {
      id: 'ex_07',
      orderId: 'ord_demo_07',
      status: 'NON_DEMARRE',
    },
    documents: [],
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log_01',
    entityType: 'PAYMENT_ORDER',
    entityId: 'ord_demo_01',
    entityRef: 'OP-2026-0001',
    action: 'TRANSFER_EXECUTED',
    timestamp: '2026-01-24T14:15:00.000Z',
    userId: 'usr_rf',
    userName: 'Samir Trabelsi',
    userRole: 'RESPONSABLE_FINANCIER',
    details: 'Exécution confirmée du transfert SWIFT MT103 (145 000 USD / Contre-valeur 452 400.000 TND).',
  },
  {
    id: 'log_02',
    entityType: 'PAYMENT_ORDER',
    entityId: 'ord_demo_04',
    entityRef: 'OP-2026-0004',
    action: 'BANK_DEPOSIT_RECORDED',
    timestamp: '2026-02-08T15:20:00.000Z',
    userId: 'usr_agent1',
    userName: 'Monia Ben Salem',
    userRole: 'AGENT_FINANCIER',
    details: 'Dépôt physique à la STB sous bordereau BORD-2026-STB-028.',
  },
  {
    id: 'log_03',
    entityType: 'PAYMENT_ORDER',
    entityId: 'ord_demo_03',
    entityRef: 'OP-2026-0003',
    action: 'CONTROLE_GESTION_VALIDATED',
    timestamp: '2026-02-05T09:45:00.000Z',
    userId: 'usr_cg',
    userName: 'Karim Mezghani',
    userRole: 'CONTROLE_GESTION',
    details: 'Validation budgétaire accordée pour un montant de 112 400 EUR.',
  },
];

class Database {
  private users: User[] = [...INITIAL_USERS];
  private suppliers: Supplier[] = [...INITIAL_SUPPLIERS];
  private banks: Bank[] = [...INITIAL_BANKS];
  private orders: PaymentOrder[] = [...INITIAL_ORDERS];
  private consultations: CurrencyConsultation[] = [];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.orders && Array.isArray(parsed.orders)) {
          this.orders = parsed.orders.map((o: any) => {
            const isExchangeValidated = o.exchangeTransaction?.status === 'VALIDE';
            return {
              ...o,
              requiresRateNegotiation: Boolean(o.requiresRateNegotiation),
              status: normalizeLegacyStatus(
                o.status,
                Boolean(o.requiresRateNegotiation),
                isExchangeValidated
              ),
              history: Array.isArray(o.history)
                ? o.history.map((h: any) => ({
                    ...h,
                    fromStatus:
                      h.fromStatus === 'INITIAL'
                        ? 'INITIAL'
                        : normalizeLegacyStatus(
                            h.fromStatus,
                            Boolean(o.requiresRateNegotiation),
                            isExchangeValidated
                          ),
                    toStatus: normalizeLegacyStatus(
                      h.toStatus,
                      Boolean(o.requiresRateNegotiation),
                      isExchangeValidated
                    ),
                  }))
                : [],
            };
          });
        }
        if (parsed.suppliers && Array.isArray(parsed.suppliers)) {
          this.suppliers = parsed.suppliers;
        }
        if (parsed.banks && Array.isArray(parsed.banks)) {
          this.banks = parsed.banks.map((b: Bank) => {
            const seedPreset = INITIAL_BANKS.find(ib => ib.id === b.id || ib.code === b.code);
            const normalizedContacts = normalizeBankConfirmationContacts(
              b.confirmationContacts ?? seedPreset?.confirmationContacts,
              b.contactEmails ?? seedPreset?.contactEmails
            );
            return {
              ...b,
              confirmationContacts: normalizedContacts,
              contactEmails: normalizedContacts.map(c => c.email),
            };
          });
        }
        if (parsed.consultations && Array.isArray(parsed.consultations)) {
          this.consultations = parsed.consultations;
        }
        if (parsed.auditLogs && Array.isArray(parsed.auditLogs)) {
          this.auditLogs = parsed.auditLogs;
        }
        if (parsed.users && Array.isArray(parsed.users)) {
          this.users = parsed.users;
        }
      } else {
        this.saveToDisk();
      }
    } catch (err) {
      console.error('Error loading db file:', err);
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        users: this.users,
        suppliers: this.suppliers,
        banks: this.banks,
        orders: this.orders,
        consultations: this.consultations,
        auditLogs: this.auditLogs,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db file:', err);
    }
  }

  public getUsers(): User[] {
    return this.users;
  }

  public getSuppliers(): Supplier[] {
    return this.suppliers;
  }

  public createSupplier(supplier: Omit<Supplier, 'id'>, user: User): Supplier {
    const newSupplier: Supplier = {
      ...supplier,
      id: 'sup_' + Date.now(),
    };
    this.suppliers.push(newSupplier);
    this.addAuditLog({
      entityType: 'SUPPLIER',
      entityId: newSupplier.id,
      entityRef: newSupplier.name,
      action: 'SUPPLIER_CREATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Création du fournisseur international : ${newSupplier.name} (${newSupplier.country})`,
    });
    this.saveToDisk();
    return newSupplier;
  }

  public getBanks(): Bank[] {
    return this.banks;
  }

  public createBank(bank: Omit<Bank, 'id'>, user: User): Bank {
    const normalizedContacts = normalizeBankConfirmationContacts(
      bank.confirmationContacts,
      bank.contactEmails
    );
    const code = (bank.code || '').trim().toUpperCase();
    const newBank: Bank = {
      ...bank,
      id: 'bank_' + Date.now(),
      code,
      name: (bank.name || '').trim(),
      swiftCode: (bank.swiftCode || '').trim().toUpperCase(),
      contactAgency: bank.contactAgency?.trim() || 'Agence Kairouan',
      tradingDeskName: bank.tradingDeskName?.trim() || `${code} SALLE DE CHANGE`,
      tradingDeskAddress: bank.tradingDeskAddress?.trim() || bank.tradingDeskName?.trim() || `${code} SALLE DE CHANGE`,
      tradingDeskFax: bank.tradingDeskFax?.trim() || undefined,
      tradingDeskPhone: bank.tradingDeskPhone?.trim() || undefined,
      confirmationContacts: normalizedContacts,
      contactEmails: normalizedContacts.map(c => c.email),
    };
    this.banks.push(newBank);
    this.addAuditLog({
      entityType: 'BANK',
      entityId: newBank.id,
      entityRef: newBank.name,
      action: 'BANK_CREATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Ajout de la banque tunisienne : ${newBank.name} (${newBank.code}) — ${normalizedContacts.length} contact(s) email de confirmation`,
    });
    this.saveToDisk();
    return newBank;
  }

  public updateBank(id: string, bankData: Partial<Bank>, user: User): Bank {
    const idx = this.banks.findIndex(b => b.id === id);
    if (idx === -1) {
      throw new Error('Banque introuvable');
    }
    const existing = this.banks[idx];
    const hasContactsField =
      bankData.confirmationContacts !== undefined || bankData.contactEmails !== undefined;
    const normalizedContacts = hasContactsField
      ? normalizeBankConfirmationContacts(bankData.confirmationContacts, bankData.contactEmails)
      : normalizeBankConfirmationContacts(existing.confirmationContacts, existing.contactEmails);

    const updatedCode = (bankData.code !== undefined ? bankData.code : existing.code).trim().toUpperCase();
    const updatedBank: Bank = {
      ...existing,
      ...bankData,
      id: existing.id,
      code: updatedCode,
      name: (bankData.name !== undefined ? bankData.name : existing.name).trim(),
      swiftCode: (bankData.swiftCode !== undefined ? bankData.swiftCode : existing.swiftCode).trim().toUpperCase(),
      contactAgency:
        bankData.contactAgency !== undefined
          ? bankData.contactAgency.trim() || 'Agence Kairouan'
          : existing.contactAgency,
      tradingDeskName:
        bankData.tradingDeskName !== undefined
          ? bankData.tradingDeskName.trim() || `${updatedCode} SALLE DE CHANGE`
          : existing.tradingDeskName,
      tradingDeskAddress:
        bankData.tradingDeskAddress !== undefined
          ? bankData.tradingDeskAddress.trim() || bankData.tradingDeskName?.trim() || `${updatedCode} SALLE DE CHANGE`
          : existing.tradingDeskAddress,
      tradingDeskFax:
        bankData.tradingDeskFax !== undefined
          ? bankData.tradingDeskFax.trim() || undefined
          : existing.tradingDeskFax,
      tradingDeskPhone:
        bankData.tradingDeskPhone !== undefined
          ? bankData.tradingDeskPhone.trim() || undefined
          : existing.tradingDeskPhone,
      confirmationContacts: normalizedContacts,
      contactEmails: normalizedContacts.map(c => c.email),
    };

    this.banks[idx] = updatedBank;
    this.addAuditLog({
      entityType: 'BANK',
      entityId: updatedBank.id,
      entityRef: updatedBank.name,
      action: 'BANK_UPDATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Mise à jour de la banque ${updatedBank.name} (${updatedBank.code}) : ${normalizedContacts.length} contact(s) confirmation configuré(s)`,
    });
    this.saveToDisk();
    return updatedBank;
  }

  public getOrders(filters: FilterParams = {}): PaymentOrder[] {
    return this.orders.filter(order => {
      if (filters.status && filters.status !== 'ALL' && order.status !== filters.status) {
        return false;
      }
      if (filters.currency && filters.currency !== 'ALL' && order.currency !== filters.currency) {
        return false;
      }
      if (filters.bank && filters.bank !== 'ALL' && order.bankId !== filters.bank) {
        return false;
      }
      if (filters.supplier && filters.supplier !== 'ALL' && order.supplierId !== filters.supplier) {
        return false;
      }
      if (filters.fiscalYear && filters.fiscalYear !== 'ALL' && order.fiscalYear !== Number(filters.fiscalYear)) {
        return false;
      }
      if (filters.startDate && new Date(order.createdAt) < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate && new Date(order.createdAt) > new Date(filters.endDate + 'T23:59:59.999Z')) {
        return false;
      }
      if (filters.isDemo !== undefined && filters.isDemo !== 'ALL' && order.isDemo !== filters.isDemo) {
        return false;
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matches =
          order.orderNumber.toLowerCase().includes(q) ||
          order.beneficiaryName.toLowerCase().includes(q) ||
          order.purpose.toLowerCase().includes(q) ||
          order.invoiceNumber.toLowerCase().includes(q) ||
          (order.contractNumber && order.contractNumber.toLowerCase().includes(q)) ||
          (order.lcNumber && order.lcNumber.toLowerCase().includes(q)) ||
          (order.domiciliationNumber && order.domiciliationNumber.toLowerCase().includes(q)) ||
          order.bankName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }

  public getOrderById(id: string): PaymentOrder | undefined {
    return this.orders.find(o => o.id === id);
  }

  public createOrder(payload: Partial<PaymentOrder>, user: User): PaymentOrder {
    const existingCount = this.orders.length;
    const year = payload.fiscalYear || new Date().getFullYear();
    const uCode = payload.userCode || user.userCode || '001';
    const structured = generateStructuredOrderNumber(uCode, year, existingCount);
    const orderNumber = payload.orderNumber || structured.orderNumber;
    const now = new Date().toISOString();

    const amount = Number(payload.amount) || 0;
    const currency = payload.currency || 'EUR';
    const amountInWords = payload.amountInWords || numberToFrenchWords(amount, currency);

    const initialStatus: PaymentStatus =
      payload.status === 'TRANSMIS_SIGNATURE' ? 'TRANSMIS_SIGNATURE' : 'SAISI';

    const historyEntry: PaymentWorkflow = {
      id: 'wf_' + Date.now(),
      orderId: 'ord_' + Date.now(),
      fromStatus: 'INITIAL',
      toStatus: initialStatus,
      timestamp: now,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      comment:
        initialStatus === 'TRANSMIS_SIGNATURE'
          ? 'Création et transmission directe pour signature'
          : 'Création et enregistrement en brouillon (Saisi)',
    };

    const newOrder: PaymentOrder = {
      id: historyEntry.orderId,
      orderNumber,
      userCode: payload.userCode || structured.userPart,
      yearCode: payload.yearCode || structured.yearPart,
      orderSeq: payload.orderSeq || structured.seqPart,
      contractNumber: payload.contractNumber || '',
      transferType: payload.transferType || 'VIREMENT',
      lcNumber: payload.lcNumber || '',
      requiresRateNegotiation: Boolean(payload.requiresRateNegotiation),
      fiscalYear: year,
      createdAt: now,
      updatedAt: now,
      createdBy: user.name,
      createdById: user.id,
      department: payload.department || 'Direction Financière et Comptable',
      purpose: payload.purpose || 'Règlement fournisseur étranger',
      supplierId: payload.supplierId,
      beneficiaryName: payload.beneficiaryName || '',
      beneficiaryCountry: payload.beneficiaryCountry || '',
      beneficiaryAddress: payload.beneficiaryAddress || '',
      beneficiaryBank: payload.beneficiaryBank || '',
      beneficiaryIban: payload.beneficiaryIban || '',
      beneficiarySwift: payload.beneficiarySwift || '',
      currency,
      amount,
      amountInWords,
      transferPurpose: payload.transferPurpose || payload.purpose || '',
      invoiceNumber: payload.invoiceNumber || '',
      invoiceDate: payload.invoiceDate || now.split('T')[0],
      domiciliationNumber: payload.domiciliationNumber || '',
      operationNature: payload.operationNature || 'Importation industrielle',
      bankId: payload.bankId || '',
      bankName: payload.bankName || '',
      bankBranch: payload.bankBranch || '',
      bankFileRef: payload.bankFileRef || '',
      remarks: payload.remarks || '',
      status: initialStatus,
      history: [historyEntry],
      documents: payload.documents || [],
      isDemo: payload.isDemo !== undefined ? payload.isDemo : false,
      exchangeTransaction: {
        id: 'ex_' + Date.now(),
        orderId: historyEntry.orderId,
        status: 'NON_DEMARRE',
      },
    };

    this.orders.unshift(newOrder);

    this.addAuditLog({
      entityType: 'PAYMENT_ORDER',
      entityId: newOrder.id,
      entityRef: newOrder.orderNumber,
      action: 'ORDER_CREATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Création de l'ordre ${newOrder.orderNumber} pour ${newOrder.beneficiaryName} (${newOrder.amount} ${newOrder.currency}). Statut: ${newOrder.status}`,
    });

    this.saveToDisk();
    return newOrder;
  }

  public updateOrder(id: string, payload: Partial<PaymentOrder>, user: User): PaymentOrder {
    const idx = this.orders.findIndex(o => o.id === id);
    if (idx === -1) {
      throw new Error(`Ordre introuvable avec l'identifiant ${id}`);
    }

    const current = this.orders[idx];
    if (current.status !== 'SAISI' && user.role !== 'ADMINISTRATEUR') {
      throw new Error(`Modification interdite : l'ordre est en statut ${current.status}`);
    }

    const now = new Date().toISOString();
    const updatedAmount = payload.amount !== undefined ? Number(payload.amount) : current.amount;
    const updatedCurrency = payload.currency || current.currency;
    const amountInWords = payload.amountInWords || numberToFrenchWords(updatedAmount, updatedCurrency);

    const updated: PaymentOrder = {
      ...current,
      ...payload,
      amount: updatedAmount,
      currency: updatedCurrency,
      amountInWords,
      updatedAt: now,
    };

    this.orders[idx] = updated;

    this.addAuditLog({
      entityType: 'PAYMENT_ORDER',
      entityId: updated.id,
      entityRef: updated.orderNumber,
      action: 'ORDER_UPDATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Mise à jour des informations de l'ordre ${updated.orderNumber}`,
    });

    this.saveToDisk();
    return updated;
  }

  public changeOrderStatus(
    orderId: string,
    targetStatus: PaymentStatus,
    comment: string,
    user: User,
    depositData?: Partial<BankDeposit>,
    executionData?: Partial<PaymentOrder>
  ): PaymentOrder {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) {
      throw new Error(`Ordre introuvable : ${orderId}`);
    }

    const order = this.orders[idx];
    const check = canUserPerformTransition(order.status, targetStatus, user.role);
    if (!check.allowed) {
      throw new Error(check.reason || 'Action non autorisée sur cet ordre de paiement.');
    }

    const now = new Date().toISOString();

    const workflowEntry: PaymentWorkflow = {
      id: 'wf_' + Date.now(),
      orderId,
      fromStatus: order.status,
      toStatus: targetStatus,
      timestamp: now,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      comment: comment || `Passage au statut ${targetStatus}`,
    };

    const updated: PaymentOrder = {
      ...order,
      status: targetStatus,
      updatedAt: now,
      history: [...order.history, workflowEntry],
    };

    // Dépôt bancaire (statut 4 conditionnel : DEPOSE_BANQUE ou EN_ATTENTE_ACHAT_DEVISE)
    if ((targetStatus === 'DEPOSE_BANQUE' || targetStatus === 'EN_ATTENTE_ACHAT_DEVISE') && depositData) {
      const deposit: BankDeposit = {
        id: 'dep_' + Date.now(),
        orderId,
        bankId: depositData.bankId || order.bankId,
        bankName: depositData.bankName || order.bankName,
        depositDate: depositData.depositDate || now.split('T')[0],
        slipNumber: depositData.slipNumber || '',
        bankReference: depositData.bankReference || '',
        depositedBy: user.name,
        notes: depositData.notes,
        depositReceiptDocId: depositData.depositReceiptDocId,
      };
      updated.deposit = deposit;
    }

    // Exécution du transfert
    if (targetStatus === 'EXECUTE' && executionData) {
      updated.executionDate = executionData.executionDate || now.split('T')[0];
      updated.executingBank = executionData.executingBank || order.bankName;
      updated.executedAmount = executionData.executedAmount || order.amount;
      updated.finalExchangeRate = executionData.finalExchangeRate;
      updated.debitAmountTnd = executionData.debitAmountTnd;
      updated.accountDebitDate = executionData.accountDebitDate || updated.executionDate;
      updated.swiftReference = executionData.swiftReference;
      updated.bankFees = executionData.bankFees || 0;
    }

    this.orders[idx] = updated;

    this.addAuditLog({
      entityType: 'PAYMENT_ORDER',
      entityId: updated.id,
      entityRef: updated.orderNumber,
      action: `STATUS_CHANGED_${targetStatus}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Changement de statut : ${order.status} -> ${targetStatus}. Motif : ${comment}`,
    });

    this.saveToDisk();
    return updated;
  }

  public addDocumentToOrder(orderId: string, doc: Omit<PaymentOrder['documents'][0], 'id' | 'orderId'>, user: User): PaymentOrder {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error('Ordre introuvable');
    const order = this.orders[idx];

    const newDoc = {
      ...doc,
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      orderId,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.name,
    };

    order.documents.push(newDoc);
    order.updatedAt = new Date().toISOString();

    this.addAuditLog({
      entityType: 'PAYMENT_ORDER',
      entityId: order.id,
      entityRef: order.orderNumber,
      action: 'DOCUMENT_UPLOADED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Ajout de la pièce justificative ${newDoc.name} (${newDoc.type})`,
    });

    this.saveToDisk();
    return order;
  }

  public getDashboardStats(filters: FilterParams = {}): DashboardStats {
    const filtered = this.getOrders(filters);

    let totalEurAmount = 0;
    let totalUsdAmount = 0;
    let totalTndExecuted = 0;
    const amountByCurrency: Record<string, number> = {};
    const countByStatus: Record<PaymentStatus, number> = {
      SAISI: 0,
      TRANSMIS_SIGNATURE: 0,
      SIGNE: 0,
      DEPOSE_BANQUE: 0,
      EN_ATTENTE_ACHAT_DEVISE: 0,
      EXECUTE: 0,
      ANNULE: 0,
    };

    const ordersByBank: Record<string, { count: number; totalTnd: number }> = {};
    const monthlyMap: Record<string, { count: number; amountEur: number; amountUsd: number; executedTnd: number }> = {};

    filtered.forEach(o => {
      // Compteurs par statut
      if (countByStatus[o.status] !== undefined) {
        countByStatus[o.status]++;
      }

      // Montants par devise
      amountByCurrency[o.currency] = (amountByCurrency[o.currency] || 0) + o.amount;
      if (o.currency === 'EUR') totalEurAmount += o.amount;
      if (o.currency === 'USD') totalUsdAmount += o.amount;

      // Montants exécutés
      if (o.status === 'EXECUTE' && o.debitAmountTnd) {
        totalTndExecuted += o.debitAmountTnd;
      }

      // Par banque
      const bankName = o.bankName || 'Non assignée';
      if (!ordersByBank[bankName]) {
        ordersByBank[bankName] = { count: 0, totalTnd: 0 };
      }
      ordersByBank[bankName].count++;
      if (o.debitAmountTnd) {
        ordersByBank[bankName].totalTnd += o.debitAmountTnd;
      }

      // Évolution mensuelle
      const date = new Date(o.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { count: 0, amountEur: 0, amountUsd: 0, executedTnd: 0 };
      }
      monthlyMap[monthKey].count++;
      if (o.currency === 'EUR') monthlyMap[monthKey].amountEur += o.amount;
      if (o.currency === 'USD') monthlyMap[monthKey].amountUsd += o.amount;
      if (o.status === 'EXECUTE' && o.debitAmountTnd) {
        monthlyMap[monthKey].executedTnd += o.debitAmountTnd;
      }
    });

    const monthlyEvolution = Object.keys(monthlyMap)
      .sort()
      .map(month => ({
        month,
        ...monthlyMap[month],
      }));

    return {
      totalOrders: filtered.length,
      totalEurAmount,
      totalUsdAmount,
      totalTndExecuted,
      amountByCurrency,
      countByStatus,
      saisiCount: countByStatus['SAISI'] || 0,
      transmisSignatureCount: countByStatus['TRANSMIS_SIGNATURE'] || 0,
      signeCount: countByStatus['SIGNE'] || 0,
      depositedCount: countByStatus['DEPOSE_BANQUE'] || 0,
      pendingExchangeCount: countByStatus['EN_ATTENTE_ACHAT_DEVISE'] || 0,
      executedCount: countByStatus['EXECUTE'] || 0,
      cancelledCount: countByStatus['ANNULE'] || 0,
      ordersByBank,
      monthlyEvolution,
    };
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const entry: AuditLog = {
      ...log,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    // Limiter la taille de l'historique
    if (this.auditLogs.length > 2000) {
      this.auditLogs = this.auditLogs.slice(0, 2000);
    }
  }

  // --- CONSULTATIONS D'ACHAT DE DEVISES (MODULE 02) ---

  public getConsultations(): CurrencyConsultation[] {
    return [...this.consultations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public createConsultation(
    payload: {
      orderIds: string[];
      operationDate: string;
      purchaseType: string;
      submissionDeadlineTime: string;
      validityDeadlineTime: string;
      contactPhone?: string;
      contactEmail?: string;
      faxNumbers?: string;
      consultedBankIds?: string[];
      notes?: string;
    },
    user: User
  ): CurrencyConsultation {
    const orderIds = Array.isArray(payload.orderIds) ? payload.orderIds : [];
    if (orderIds.length === 0) {
      throw new Error('Veuillez sélectionner au moins un ordre de paiement.');
    }

    const selectedOrders = orderIds
      .map(id => this.orders.find(o => o.id === id))
      .filter((o): o is PaymentOrder => Boolean(o));

    if (selectedOrders.length !== orderIds.length) {
      throw new Error('Un ou plusieurs ordres sélectionnés sont introuvables.');
    }

    const validation = validateConsultationSelection(selectedOrders);
    if (!validation.valid || !validation.currency) {
      throw new Error(validation.error || 'Sélection d’ordres invalide pour la consultation.');
    }

    // Vérifier qu'aucun ordre n'est déjà rattaché à une consultation active non annulée
    const alreadyLinked = this.consultations.find(
      c => c.status !== 'ANNULEE' && c.orderIds.some(oid => orderIds.includes(oid))
    );
    if (alreadyLinked) {
      throw new Error(
        `Un des ordres sélectionnés est déjà inclus dans la consultation ${alreadyLinked.consultationNumber}.`
      );
    }

    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const seq = String(this.consultations.length + 1).padStart(4, '0');
    const consultationNumber = `CONS-${year}-${seq}`;

    const consultation: CurrencyConsultation = {
      id: 'cons_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      consultationNumber,
      createdAt: now,
      createdBy: user.name,
      createdById: user.id,
      orderIds: selectedOrders.map(o => o.id),
      orderNumbers: selectedOrders.map(o => o.orderNumber),
      currency: validation.currency,
      totalAmount: validation.totalAmount,
      operationDate: payload.operationDate || now.split('T')[0],
      purchaseType: (payload.purchaseType || 'au comptant').trim(),
      submissionDeadlineTime: formatConsultationTime(payload.submissionDeadlineTime || '14h20'),
      validityDeadlineTime: formatConsultationTime(payload.validityDeadlineTime || '14h30'),
      contactPhone: (payload.contactPhone || '(77) 281 699').trim(),
      contactEmail: (payload.contactEmail || 'mtk.tn@mtk.tn').trim(),
      faxNumbers: (payload.faxNumbers || '(77).287.200   (77).283.130').trim(),
      consultedBankIds: Array.isArray(payload.consultedBankIds) ? payload.consultedBankIds : [],
      status: 'OUVERTE',
      quotes: [],
      notes: payload.notes,
      isDemo: selectedOrders.every(o => o.isDemo),
    };

    this.consultations.unshift(consultation);

    // Lier les ordres à la consultation
    selectedOrders.forEach(order => {
      const idx = this.orders.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        this.orders[idx] = {
          ...this.orders[idx],
          updatedAt: now,
          exchangeTransaction: {
            ...(this.orders[idx].exchangeTransaction || {
              id: 'ex_' + order.id,
              orderId: order.id,
            }),
            consultationId: consultation.id,
            consultationNumber: consultation.consultationNumber,
            status: 'CONSULTATION_EN_COURS',
            consultationDate: consultation.operationDate,
          },
        };
      }
    });

    this.addAuditLog({
      entityType: 'CONSULTATION',
      entityId: consultation.id,
      entityRef: consultation.consultationNumber,
      action: 'CONSULTATION_CREATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Création de la consultation ${consultation.consultationNumber} (${consultation.totalAmount} ${consultation.currency}, ${consultation.purchaseType}, limites ${consultation.submissionDeadlineTime} / ${consultation.validityDeadlineTime}) regroupant : ${consultation.orderNumbers.join(', ')}`,
    });

    this.saveToDisk();
    return consultation;
  }

  public recordConsultationQuotes(
    consultationId: string,
    payload: {
      quotes?: ExchangeQuote[];
      selectedBankId?: string;
      selectedBankName?: string;
      negotiatedRate?: number;
      confirmationRef?: string;
      confirmationDate?: string;
      valueDate?: string;
      close?: boolean;
      notes?: string;
    },
    user: User
  ): CurrencyConsultation {
    const idx = this.consultations.findIndex(c => c.id === consultationId);
    if (idx === -1) {
      throw new Error('Consultation introuvable.');
    }

    const current = this.consultations[idx];
    if (current.status === 'ANNULEE') {
      throw new Error('Impossible de modifier une consultation annulée.');
    }

    const now = new Date().toISOString();
    const shouldClose = Boolean(payload.close);

    let normalizedQuotes = current.quotes || [];
    if (Array.isArray(payload.quotes)) {
      normalizedQuotes = payload.quotes
        .filter(q => Number(q.rate) > 0)
        .map(q => {
          const isFull =
            q.isFullAmount !== undefined
              ? Boolean(q.isFullAmount)
              : Math.abs(Number(q.proposedAmount ?? current.totalAmount) - current.totalAmount) < 0.01;
          const proposedAmount = isFull
            ? current.totalAmount
            : Number(Number(q.proposedAmount ?? current.totalAmount).toFixed(2));
          return {
            ...q,
            isFullAmount: isFull,
            proposedAmount,
            rate: Number(Number(q.rate).toFixed(4)),
            feesTnd: Number(q.feesTnd || 0),
            validityMinutes: Number(q.validityMinutes || 10),
            receivedAt: q.receivedAt || now,
          };
        })
        .sort((a, b) => {
          const diff = a.rate - b.rate;
          if (Math.abs(diff) > 1e-6) return diff;
          return (b.proposedAmount || 0) - (a.proposedAmount || 0);
        });
    }

    const confirmationDate =
      payload.confirmationDate || current.confirmationDate || (shouldClose ? current.operationDate : undefined);
    const valueDate =
      payload.valueDate ||
      current.valueDate ||
      (shouldClose && confirmationDate ? computeDefaultValueDate(confirmationDate) : undefined);
    const confirmationRef =
      payload.confirmationRef ||
      current.confirmationRef ||
      (shouldClose ? generateNextConfirmationRef(this.consultations) : undefined);

    const updated: CurrencyConsultation = {
      ...current,
      quotes: normalizedQuotes,
      selectedBankId: payload.selectedBankId ?? current.selectedBankId,
      selectedBankName: payload.selectedBankName ?? current.selectedBankName,
      negotiatedRate:
        payload.negotiatedRate !== undefined ? Number(payload.negotiatedRate) : current.negotiatedRate,
      confirmationRef,
      confirmationDate,
      valueDate,
      notes: payload.notes ?? current.notes,
      status: shouldClose ? 'CLOTUREE' : current.status,
    };

    this.consultations[idx] = updated;

    // Répercuter la cotation retenue et actualiser le statut des ordres rattachés
    updated.orderIds.forEach(oid => {
      const oIdx = this.orders.findIndex(o => o.id === oid);
      if (oIdx !== -1) {
        const currentOrder = this.orders[oIdx];
        const { order: refreshedOrder, statusChanged, workflowEntry } =
          applyConsultationUpdateToOrder(currentOrder, {
            consultationId: updated.id,
            consultationNumber: updated.consultationNumber,
            confirmationRef: updated.confirmationRef,
            confirmationDate: updated.confirmationDate,
            valueDate: updated.valueDate,
            selectedBankId: updated.selectedBankId,
            selectedBankName: updated.selectedBankName,
            negotiatedRate: updated.negotiatedRate,
            quotes: updated.quotes || [],
            closed: shouldClose,
            notes: updated.notes,
            timestamp: now,
            user,
          });

        this.orders[oIdx] = refreshedOrder;

        if (statusChanged && workflowEntry) {
          this.addAuditLog({
            entityType: 'PAYMENT_ORDER',
            entityId: refreshedOrder.id,
            entityRef: refreshedOrder.orderNumber,
            action: 'STATUS_CHANGED_DEPOSE_BANQUE',
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            details: workflowEntry.comment || `Achat de devise confirmé via consultation ${updated.consultationNumber}`,
          });
        }
      }
    });

    this.addAuditLog({
      entityType: 'CONSULTATION',
      entityId: updated.id,
      entityRef: updated.consultationNumber,
      action: shouldClose ? 'CONSULTATION_CLOSED' : 'CONSULTATION_QUOTES_UPDATED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: shouldClose
        ? `Clôture consultation ${updated.consultationNumber} avec ${updated.selectedBankName || 'banque retenue'} au cours ${updated.negotiatedRate || '—'} (${normalizedQuotes.length} offre(s) comparée(s))`
        : `Enregistrement de ${normalizedQuotes.length} offre(s) bancaire(s) pour la consultation ${updated.consultationNumber}`,
    });

    this.saveToDisk();
    return updated;
  }

  public cancelConsultation(consultationId: string, reason: string, user: User): CurrencyConsultation {
    const idx = this.consultations.findIndex(c => c.id === consultationId);
    if (idx === -1) {
      throw new Error('Consultation introuvable.');
    }

    const current = this.consultations[idx];
    if (current.status === 'ANNULEE') {
      return current;
    }

    const now = new Date().toISOString();
    const updated: CurrencyConsultation = {
      ...current,
      status: 'ANNULEE',
      notes: reason || current.notes,
    };
    this.consultations[idx] = updated;

    // Libérer les ordres rattachés pour une nouvelle consultation éventuelle
    current.orderIds.forEach(oid => {
      const oIdx = this.orders.findIndex(o => o.id === oid);
      if (oIdx !== -1 && this.orders[oIdx].status === 'EN_ATTENTE_ACHAT_DEVISE') {
        this.orders[oIdx] = {
          ...this.orders[oIdx],
          updatedAt: now,
          exchangeTransaction: {
            id: 'ex_' + oid,
            orderId: oid,
            status: 'NON_DEMARRE',
          },
        };
      }
    });

    this.addAuditLog({
      entityType: 'CONSULTATION',
      entityId: updated.id,
      entityRef: updated.consultationNumber,
      action: 'CONSULTATION_CANCELLED',
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      details: `Annulation consultation ${updated.consultationNumber}. Motif : ${reason || 'Non précisé'}`,
    });

    this.saveToDisk();
    return updated;
  }

  public resetDemoData() {
    this.orders = [...INITIAL_ORDERS];
    this.suppliers = [...INITIAL_SUPPLIERS];
    this.banks = [...INITIAL_BANKS];
    this.users = [...INITIAL_USERS];
    this.consultations = [];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.saveToDisk();
  }
}

export const db = new Database();
