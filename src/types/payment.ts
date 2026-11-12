/**
 * Types pour MTK International Payments - Module 01
 * Direction Financière et Comptable (DFC) - Manufacture des Tabacs de Kairouan
 */

export type PaymentStatus =
  | 'BROUILLON'
  | 'SAISI'
  | 'TRANSMIS_CG'
  | 'VALIDE_CG'
  | 'RETOURNE_CORRECTION'
  | 'DEPOSE_BANQUE'
  | 'ATTENTE_NEGOCIATION'
  | 'TAUX_VALIDE'
  | 'EN_COURS_EXECUTION'
  | 'EXECUTE'
  | 'REJETE'
  | 'ANNULE';

export type UserRole =
  | 'ADMINISTRATEUR'
  | 'AGENT_FINANCIER'
  | 'CONTROLE_GESTION'
  | 'RESPONSABLE_FINANCIER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
  userCode?: string; // Code utilisateur 3 chiffres (ex: 001)
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  country: string;
  address: string;
  bankName: string;
  iban: string;
  swift: string;
  email: string;
  phone?: string;
  active: boolean;
}

export interface Bank {
  id: string;
  code: string;
  name: string;
  swiftCode: string;
  country: string;
  active: boolean;
  contactAgency?: string;
}

export type DocumentType =
  | 'FACTURE'
  | 'DOMICILIATION'
  | 'CONTRAT'
  | 'BORDEREAU_DEPOT'
  | 'AVIS_DEBIT_SWIFT'
  | 'AUTRE';

export interface PaymentDocument {
  id: string;
  orderId: string;
  name: string;
  type: DocumentType;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  fileUrl?: string;
  dataBase64?: string;
}

export interface PaymentWorkflow {
  id: string;
  orderId: string;
  fromStatus: PaymentStatus | 'INITIAL';
  toStatus: PaymentStatus;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  comment?: string;
  justificationRef?: string;
}

export interface BankDeposit {
  id: string;
  orderId: string;
  bankId: string;
  bankName: string;
  depositDate: string;
  slipNumber: string;
  bankReference: string;
  depositedBy: string;
  notes?: string;
  depositReceiptDocId?: string;
}

export interface ExchangeQuote {
  bankId: string;
  bankName: string;
  rate: number;
  feesTnd: number;
  validityMinutes: number;
  receivedAt: string;
}

/**
 * Interface prête pour l'intégration future du MODULE 02
 * Consultation banques, cours proposés, cours négociés, économies réalisées
 */
export interface ExchangeTransaction {
  id: string;
  orderId: string;
  status: 'NON_DEMARRE' | 'CONSULTATION_EN_COURS' | 'NEGOCIE' | 'VALIDE';
  consultationDate?: string;
  quotes?: ExchangeQuote[];
  selectedBankId?: string;
  selectedBankName?: string;
  referenceCentralBankRate?: number;
  finalNegotiatedRate?: number;
  savingsTnd?: number;
  validatedAt?: string;
  validatedBy?: string;
  notes?: string;
}

export interface PaymentOrder {
  id: string;
  orderNumber: string; // Structure: 000 UTILISATEUR 000 ANNEE 0000 ORDRE (ex: 001-026-0001)
  userCode?: string;
  yearCode?: string;
  orderSeq?: string;
  contractNumber?: string; // Contrat (nouveau champ à saisir)
  fiscalYear?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdById: string;
  department?: string;
  purpose: string;

  // Bénéficiaire / Fournisseur
  supplierId?: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  beneficiaryAddress: string;
  beneficiaryBank: string;
  beneficiaryIban: string;
  beneficiarySwift: string;

  // Données financières
  currency: 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND';
  amount: number;
  amountInWords: string;
  transferPurpose: string;
  invoiceNumber: string;
  invoiceDate: string;
  domiciliationNumber?: string; // Facultatif suite à demande
  operationNature: string;

  // Informations bancaires locales (Banque tunisienne MTK)
  bankId: string;
  bankName: string;
  bankBranch: string;
  bankFileRef: string;
  remarks?: string;

  // Type de transfert : VIREMENT ou LC (avec N° LC / Remise / Autre)
  transferType?: 'VIREMENT' | 'LC' | 'REMISE' | 'AUTRE';
  lcNumber?: string; // N° LC ou Remise ou Autre

  // Statut & Circuit
  status: PaymentStatus;
  history: PaymentWorkflow[];

  // Dépôt bancaire
  deposit?: BankDeposit;

  // Exécution du transfert
  executionDate?: string;
  executingBank?: string;
  executedAmount?: number;
  finalExchangeRate?: number;
  debitAmountTnd?: number;
  accountDebitDate?: string;
  swiftReference?: string;
  bankFees?: number;
  executionReceiptDocId?: string;

  // Module 02 Link
  exchangeTransaction?: ExchangeTransaction;

  // Pièces jointes
  documents: PaymentDocument[];

  // Traçabilité & Démonstration
  isDemo: boolean;
}

export interface AuditLog {
  id: string;
  entityType: 'PAYMENT_ORDER' | 'SUPPLIER' | 'BANK' | 'USER' | 'SETTINGS';
  entityId: string;
  entityRef: string;
  action: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  details: string;
  ipAddress?: string;
}

export interface FilterParams {
  startDate?: string;
  endDate?: string;
  fiscalYear?: number | 'ALL';
  currency?: string | 'ALL';
  bank?: string | 'ALL';
  supplier?: string | 'ALL';
  status?: PaymentStatus | 'ALL';
  searchQuery?: string;
  isDemo?: boolean | 'ALL';
}

export interface DashboardStats {
  totalOrders: number;
  totalEurAmount: number;
  totalUsdAmount: number;
  totalTndExecuted: number;
  amountByCurrency: Record<string, number>;
  countByStatus: Record<PaymentStatus, number>;
  pendingValidationCount: number;
  validatedCount: number;
  depositedCount: number;
  pendingNegotiationCount: number;
  executedCount: number;
  rejectedCount: number;
  ordersByBank: Record<string, { count: number; totalTnd: number }>;
  monthlyEvolution: Array<{
    month: string;
    count: number;
    amountEur: number;
    amountUsd: number;
    executedTnd: number;
  }>;
}
