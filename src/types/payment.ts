/**
 * Types pour MTK International Payments - Module 01
 * Direction Financière et Comptable (DFC) - Manufacture des Tabacs de Kairouan
 */

export type PaymentStatus =
  | 'SAISI'
  | 'TRANSMIS_SIGNATURE'
  | 'SIGNE'
  | 'DEPOSE_BANQUE'
  | 'EN_ATTENTE_ACHAT_DEVISE'
  | 'EXECUTE'
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

export type OrderTransferType = 'VIREMENT' | 'LC' | 'REMISE' | 'AUTRE';

export interface BankConfirmationContact {
  id?: string;
  name: string;
  role?: string;
  email: string;
  orderTypes?: OrderTransferType[];
}

export interface Bank {
  id: string;
  code: string;
  name: string;
  swiftCode: string;
  country: string;
  active: boolean;
  contactAgency?: string;
  tradingDeskName?: string;
  tradingDeskFax?: string;
  tradingDeskPhone?: string;
  tradingDeskAddress?: string;
  contactEmails?: string[];
  confirmationContacts?: BankConfirmationContact[];
}

export type DocumentType =
  | 'FACTURE'
  | 'DOMICILIATION'
  | 'CONTRAT'
  | 'BORDEREAU_DEPOT'
  | 'AVIS_DEBIT_SWIFT'
  | 'AUTRE';

export type InvoiceDocumentBasis = 'FACTURE_DEFINITIVE' | 'PROFORMA';

export type InvoiceDocumentType = 'FACTURE' | 'PROFORMA';

export type InvoicePaymentScheme = 'STANDARD';

export interface PaymentDocument {
  id: string;
  orderId: string;
  name: string;
  type: DocumentType;
  docRole?: InvoiceDocumentBasis | 'AUTRE';
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  fileUrl?: string;
  dataBase64?: string;
}

export type InvoicePaymentStatus = 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  documentType?: InvoiceDocumentType;
  proformaNumber?: string;
  proformaDate?: string;
  definitiveInvoiceNumber?: string;
  definitiveInvoiceDate?: string;
  paymentScheme?: InvoicePaymentScheme;
  dueDate?: string;
  contractNumber?: string;
  purpose: string;
  operationNature: string;
  supplierId?: string;
  supplierName: string;
  supplierCountry: string;
  supplierAddress: string;
  supplierBank: string;
  supplierIban: string;
  supplierSwift: string;
  currency: 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND';
  totalAmount: number;
  notes?: string;
  documents?: Array<Omit<PaymentDocument, 'id' | 'orderId'> & { id?: string }>;
  createdAt: string;
  createdBy: string;
  createdById: string;
  isDemo: boolean;
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
  bankCode?: string;
  isFullAmount?: boolean;
  proposedAmount?: number;
  rate: number;
  feesTnd?: number;
  validityMinutes?: number;
  receivedAt: string;
  notes?: string;
}

export type ConsultationStatus = 'OUVERTE' | 'CLOTUREE' | 'ANNULEE';

export interface ConsultationPdfTextOverrides {
  headerCompany?: string;
  headerAddress?: string;
  headerRc?: string;
  headerTelFax?: string;
  senderLabel?: string;
  nbPrefix?: string;
  contactPhone?: string;
  contactEmail?: string;
  sectionTitle?: string;
  subjectLabel?: string;
  subjectText?: string;
  introLine?: string;
  amountBulletLabel?: string;
  amountBulletValue?: string;
  operationDateBulletLabel?: string;
  operationDateBulletValue?: string;
  valueDateBulletLabel?: string;
  valueDateBulletValue?: string;
  quoteRequestParagraph?: string;
  faxNumbers?: string;
  validityParagraph?: string;
  closingSalutation?: string;
  signatureLabel?: string;
  bankTableTitle?: string;
  footerTraceability?: string;
}

export interface PurchaseConfirmationLetterTextOverrides {
  destLabel?: string;
  addressLabel?: string;
  faxLabel?: string;
  telLabel?: string;
  dateText?: string;
  confirmationRef?: string;
  senderBoxTitle?: string;
  senderBoxNb?: string;
  sectionTitle?: string;
  introText?: string;
  bulletTexts?: string[];
  closingText?: string;
  signatureLabel?: string;
}

export interface CurrencyConsultation {
  id: string;
  consultationNumber: string; // Ex: CONS-2026-0001
  createdAt: string;
  createdBy: string;
  createdById: string;
  orderIds: string[];
  orderNumbers: string[];
  currency: 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND';
  totalAmount: number;
  operationDate: string; // YYYY-MM-DD
  purchaseType: string; // Ex: 'au comptant', 'à terme', etc. (Date valeur)
  submissionDeadlineTime: string; // Ex: '14h20'
  validityDeadlineTime: string; // Ex: '14h30'
  contactPhone?: string;
  contactEmail?: string;
  faxNumbers?: string;
  consultedBankIds?: string[];
  status: ConsultationStatus;
  quotes?: ExchangeQuote[];
  selectedBankId?: string;
  selectedBankName?: string;
  negotiatedRate?: number;
  confirmationRef?: string; // Ex: '101/26', '102/26'
  confirmationDate?: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD (Date valeur)
  notes?: string;
  customPdfText?: ConsultationPdfTextOverrides;
  customConfirmationTexts?: Record<string, PurchaseConfirmationLetterTextOverrides>;
  isDemo: boolean;
}

export type PurchaseConfirmationRole =
  | 'SAME_BANK_PURCHASE'
  | 'DOMICILIARY_BANK'
  | 'PURCHASE_BANK';

export interface PurchaseConfirmationOrderLine {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  rate: number;
  counterValueTnd: number;
  valueDate: string;
  transferType?: OrderTransferType;
  lcNumber?: string;
  domiciliaryBankId: string;
  domiciliaryBankCode: string;
  domiciliaryBankLabel: string;
  beneficiaryName: string;
}

export interface PurchaseConfirmationLetter {
  id: string;
  role: PurchaseConfirmationRole;
  title: string;
  recipientBankId: string;
  recipientBankCode: string;
  recipientBankName: string;
  destLabel: string;
  addressLabel: string;
  faxLabel: string;
  telLabel?: string;
  confirmationDate: string;
  confirmationRef: string;
  valueDate: string;
  purchaseBankCode: string;
  purchaseBankName: string;
  lines: PurchaseConfirmationOrderLine[];
  totalCounterValueTnd: number;
  otherDomiciliaryBankLabels?: string[];
  bctTransferCounterValueTnd?: number;
  footerEmails: string[];
  footerContacts?: BankConfirmationContact[];
  textOverrides?: PurchaseConfirmationLetterTextOverrides;
}

/**
 * Interface prête pour l'intégration du MODULE 02
 * Consultation banques, cours proposés, cours négociés, économies réalisées
 */
export interface ExchangeTransaction {
  id: string;
  orderId: string;
  consultationId?: string;
  consultationNumber?: string;
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

export type OrderDeductionCategory =
  | 'FRAIS_ENREGISTREMENT'
  | 'RETENUE_SOURCE'
  | 'PENALITE_RETARD'
  | 'AVOIR_REMISE'
  | 'FRAIS_BANCAIRES'
  | 'DROITS_TIMBRE'
  | 'AUTRE_DEDUCTION';

export interface OrderDeduction {
  id: string;
  category: OrderDeductionCategory;
  label: string;
  amount: number;
  reference?: string;
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
  invoiceId?: string; // Référence vers la facture source (Module Factures)
  documentBasis?: InvoiceDocumentBasis; // Document support de cet ordre : PROFORMA (ex: LC 50%) ou FACTURE_DEFINITIVE (ex: Virement 50%)
  proformaNumber?: string; // Rappel N° Proforma du dossier associé
  proformaDate?: string; // Rappel Date Proforma
  currency: 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND';
  grossAmount?: number; // Montant brut imputé sur la facture (net + déductions)
  deductions?: OrderDeduction[]; // Déductions, frais d'enregistrement, retenues, avoirs...
  deductionsTotal?: number; // Total des déductions appliquées
  amount: number; // Montant net à transférer
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
  transferType?: OrderTransferType;
  lcNumber?: string; // N° LC ou Remise ou Autre

  // Condition de négociation du cours de change
  requiresRateNegotiation?: boolean; // Si true -> statut dépôt = EN_ATTENTE_ACHAT_DEVISE, sinon DEPOSE_BANQUE

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
  entityType: 'INVOICE' | 'PAYMENT_ORDER' | 'CONSULTATION' | 'SUPPLIER' | 'BANK' | 'USER' | 'SETTINGS';
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
  saisiCount: number;
  transmisSignatureCount: number;
  signeCount: number;
  depositedCount: number;
  pendingExchangeCount: number;
  executedCount: number;
  cancelledCount: number;
  ordersByBank: Record<string, { count: number; totalTnd: number }>;
  monthlyEvolution: Array<{
    month: string;
    count: number;
    amountEur: number;
    amountUsd: number;
    executedTnd: number;
  }>;
}
