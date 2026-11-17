import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type {
  BankConfirmationContact,
  BankDeposit,
  ConsultationStatus,
  ExchangeQuote,
  ExchangeTransaction,
  InvoiceDocumentBasis,
  InvoicePaymentScheme,
  OrderDeduction,
  OrderTransferType,
  PaymentDocument,
  PaymentStatus,
  PaymentWorkflow,
  UserRole,
} from '../types/payment.ts';

// Utilisateurs authentifiés via Firebase Auth (UID Firebase)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Profils opérationnels MTK (circuit de validation multi-rôles DFC)
export const mtkProfiles = pgTable('mtk_profiles', {
  id: text('id').primaryKey(),
  userCode: text('user_code'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').$type<UserRole>().notNull(),
  department: text('department').notNull(),
  avatar: text('avatar'),
});

// Référentiel des fournisseurs étrangers
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  address: text('address').notNull(),
  bankName: text('bank_name').notNull(),
  iban: text('iban').notNull(),
  swift: text('swift').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
});

// Référentiel des banques tunisiennes MTK et contacts de confirmation
export const banks = pgTable('banks', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  swiftCode: text('swift_code').notNull(),
  country: text('country').notNull(),
  active: boolean('active').notNull().default(true),
  contactAgency: text('contact_agency'),
  tradingDeskName: text('trading_desk_name'),
  tradingDeskFax: text('trading_desk_fax'),
  tradingDeskPhone: text('trading_desk_phone'),
  tradingDeskAddress: text('trading_desk_address'),
  contactEmails: jsonb('contact_emails').$type<string[]>().notNull().default([]),
  confirmationContacts: jsonb('confirmation_contacts')
    .$type<BankConfirmationContact[]>()
    .notNull()
    .default([]),
});

// Factures fournisseurs (Module 00) - Supporte dossier unique Proforma + Facture Définitive
export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  invoiceDate: text('invoice_date').notNull(),
  proformaNumber: text('proforma_number'),
  proformaDate: text('proforma_date'),
  definitiveInvoiceNumber: text('definitive_invoice_number'),
  definitiveInvoiceDate: text('definitive_invoice_date'),
  paymentScheme: text('payment_scheme').$type<InvoicePaymentScheme>(),
  dueDate: text('due_date'),
  contractNumber: text('contract_number'),
  purpose: text('purpose').notNull(),
  operationNature: text('operation_nature').notNull(),
  supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  supplierName: text('supplier_name').notNull(),
  supplierCountry: text('supplier_country').notNull().default(''),
  supplierAddress: text('supplier_address').notNull().default(''),
  supplierBank: text('supplier_bank').notNull().default(''),
  supplierIban: text('supplier_iban').notNull().default(''),
  supplierSwift: text('supplier_swift').notNull().default(''),
  currency: text('currency')
    .$type<'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND'>()
    .notNull(),
  totalAmount: doublePrecision('total_amount').notNull(),
  notes: text('notes'),
  documents: jsonb('documents')
    .$type<Array<Omit<PaymentDocument, 'id' | 'orderId'> & { id?: string }>>()
    .notNull()
    .default([]),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  createdById: text('created_by_id').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
});

// Ordres de paiement internationaux (Module 01)
export const paymentOrders = pgTable('payment_orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userCode: text('user_code'),
  yearCode: text('year_code'),
  orderSeq: text('order_seq'),
  contractNumber: text('contract_number'),
  fiscalYear: integer('fiscal_year'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  createdBy: text('created_by').notNull(),
  createdById: text('created_by_id').notNull(),
  department: text('department'),
  purpose: text('purpose').notNull(),
  supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  beneficiaryName: text('beneficiary_name').notNull(),
  beneficiaryCountry: text('beneficiary_country').notNull().default(''),
  beneficiaryAddress: text('beneficiary_address').notNull().default(''),
  beneficiaryBank: text('beneficiary_bank').notNull().default(''),
  beneficiaryIban: text('beneficiary_iban').notNull().default(''),
  beneficiarySwift: text('beneficiary_swift').notNull().default(''),
  invoiceId: text('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  documentBasis: text('document_basis').$type<InvoiceDocumentBasis>(),
  proformaNumber: text('proforma_number'),
  proformaDate: text('proforma_date'),
  currency: text('currency')
    .$type<'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND'>()
    .notNull(),
  grossAmount: doublePrecision('gross_amount'),
  deductionsTotal: doublePrecision('deductions_total'),
  deductions: jsonb('deductions').$type<OrderDeduction[]>().notNull().default([]),
  amount: doublePrecision('amount').notNull(),
  amountInWords: text('amount_in_words').notNull(),
  transferPurpose: text('transfer_purpose').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  invoiceDate: text('invoice_date').notNull(),
  domiciliationNumber: text('domiciliation_number'),
  operationNature: text('operation_nature').notNull(),
  bankId: text('bank_id').notNull(),
  bankName: text('bank_name').notNull(),
  bankBranch: text('bank_branch').notNull().default(''),
  bankFileRef: text('bank_file_ref').notNull().default(''),
  remarks: text('remarks'),
  transferType: text('transfer_type').$type<OrderTransferType>(),
  lcNumber: text('lc_number'),
  requiresRateNegotiation: boolean('requires_rate_negotiation').notNull().default(false),
  status: text('status').$type<PaymentStatus>().notNull(),
  history: jsonb('history').$type<PaymentWorkflow[]>().notNull().default([]),
  deposit: jsonb('deposit').$type<BankDeposit | null>(),
  executionDate: text('execution_date'),
  executingBank: text('executing_bank'),
  executedAmount: doublePrecision('executed_amount'),
  finalExchangeRate: doublePrecision('final_exchange_rate'),
  debitAmountTnd: doublePrecision('debit_amount_tnd'),
  accountDebitDate: text('account_debit_date'),
  swiftReference: text('swift_reference'),
  bankFees: doublePrecision('bank_fees'),
  executionReceiptDocId: text('execution_receipt_doc_id'),
  exchangeTransaction: jsonb('exchange_transaction').$type<ExchangeTransaction | null>(),
  documents: jsonb('documents').$type<PaymentDocument[]>().notNull().default([]),
  isDemo: boolean('is_demo').notNull().default(false),
});

// Consultations d'achat de devises (Module 02)
export const currencyConsultations = pgTable('currency_consultations', {
  id: text('id').primaryKey(),
  consultationNumber: text('consultation_number').notNull().unique(),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by').notNull(),
  createdById: text('created_by_id').notNull(),
  orderIds: jsonb('order_ids').$type<string[]>().notNull().default([]),
  orderNumbers: jsonb('order_numbers').$type<string[]>().notNull().default([]),
  currency: text('currency')
    .$type<'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'JPY' | 'TND'>()
    .notNull(),
  totalAmount: doublePrecision('total_amount').notNull(),
  operationDate: text('operation_date').notNull(),
  purchaseType: text('purchase_type').notNull(),
  submissionDeadlineTime: text('submission_deadline_time').notNull(),
  validityDeadlineTime: text('validity_deadline_time').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  faxNumbers: text('fax_numbers'),
  consultedBankIds: jsonb('consulted_bank_ids').$type<string[]>().notNull().default([]),
  status: text('status').$type<ConsultationStatus>().notNull(),
  quotes: jsonb('quotes').$type<ExchangeQuote[]>().notNull().default([]),
  selectedBankId: text('selected_bank_id'),
  selectedBankName: text('selected_bank_name'),
  negotiatedRate: doublePrecision('negotiated_rate'),
  confirmationRef: text('confirmation_ref'),
  confirmationDate: text('confirmation_date'),
  valueDate: text('value_date'),
  notes: text('notes'),
  isDemo: boolean('is_demo').notNull().default(false),
});

// Journal d'audit & traçabilité
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  entityType: text('entity_type')
    .$type<'INVOICE' | 'PAYMENT_ORDER' | 'CONSULTATION' | 'SUPPLIER' | 'BANK' | 'USER' | 'SETTINGS'>()
    .notNull(),
  entityId: text('entity_id').notNull(),
  entityRef: text('entity_ref').notNull(),
  action: text('action').notNull(),
  timestamp: text('timestamp').notNull(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').$type<UserRole>().notNull(),
  details: text('details').notNull(),
  ipAddress: text('ip_address'),
});

// Relations Drizzle
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  invoices: many(invoices),
  paymentOrders: many(paymentOrders),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [invoices.supplierId],
    references: [suppliers.id],
  }),
  paymentOrders: many(paymentOrders),
}));

export const paymentOrdersRelations = relations(paymentOrders, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [paymentOrders.supplierId],
    references: [suppliers.id],
  }),
  invoice: one(invoices, {
    fields: [paymentOrders.invoiceId],
    references: [invoices.id],
  }),
}));
