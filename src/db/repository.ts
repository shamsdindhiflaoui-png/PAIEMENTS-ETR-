import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  banks,
  currencyConsultations,
  invoices,
  mtkProfiles,
  paymentOrders,
  suppliers,
} from './schema.ts';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_BANKS,
  INITIAL_INVOICES,
  INITIAL_ORDERS,
  INITIAL_SUPPLIERS,
  INITIAL_USERS,
} from '../server/seedData.ts';
import type {
  AuditLog,
  Bank,
  BankDeposit,
  CurrencyConsultation,
  DashboardStats,
  ExchangeQuote,
  FilterParams,
  Invoice,
  InvoiceDocumentBasis,
  InvoicePaymentScheme,
  OrderDeduction,
  PaymentDocument,
  PaymentOrder,
  PaymentStatus,
  PaymentWorkflow,
  Supplier,
  User,
} from '../types/payment.ts';
import {
  computeInvoicePaymentSummary,
  doesOrderBelongToInvoice,
  findReferenceConflict,
  getInvoiceDocumentType,
  normalizeOrderDeductions,
  resolveOrderDocumentSnapshot,
  validateExistingOrderDeductionsUpdate,
  validateOrderAgainstInvoice,
} from '../utils/invoiceUtils.ts';
import { numberToFrenchWords } from '../utils/numberToFrenchWords.ts';
import {
  applyConsultationUpdateToOrder,
  canExecuteOrder,
  canUserPerformTransition,
  computeNextStructuredOrderNumber,
  normalizeLegacyStatus,
} from '../utils/workflowRules.ts';
import {
  formatConsultationTime,
  validateConsultationSelection,
} from '../utils/consultationPdf.ts';
import {
  computeDefaultValueDate,
  generateNextConfirmationRef,
  normalizeBankConfirmationContacts,
} from '../utils/purchaseConfirmationPdf.ts';
import {
  canUserManageConsultation,
  canUserManageInvoice,
  canUserManageOrder,
  detachOrderFromConsultations,
  findOrdersToDetachFromInvoice,
  findOrdersToResetFromConsultation,
  isAdministrator,
  syncOrderNumberInConsultations,
  validateAdminConsultationUpdate,
  validateAdminInvoiceUpdate,
  validateAdminOrderUpdate,
} from '../utils/adminRules.ts';
import {
  computeDashboardStatsFromOrders,
  filterOrders,
} from '../utils/dashboardMetrics.ts';

function stripDocBase64<T extends { dataBase64?: string }>(doc: T): T {
  if (!doc || !doc.dataBase64) return doc;
  const { dataBase64: _omitted, ...rest } = doc;
  return rest as T;
}

let seedPromise: Promise<void> | null = null;

function mapBankRow(row: typeof banks.$inferSelect): Bank {
  const seedPreset = INITIAL_BANKS.find(ib => ib.id === row.id || ib.code === row.code);
  const normalizedContacts = normalizeBankConfirmationContacts(
    row.confirmationContacts ?? seedPreset?.confirmationContacts,
    row.contactEmails ?? seedPreset?.contactEmails
  );
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    swiftCode: row.swiftCode,
    country: row.country,
    active: row.active,
    contactAgency: row.contactAgency ?? undefined,
    tradingDeskName: row.tradingDeskName ?? undefined,
    tradingDeskFax: row.tradingDeskFax ?? undefined,
    tradingDeskPhone: row.tradingDeskPhone ?? undefined,
    tradingDeskAddress: row.tradingDeskAddress ?? undefined,
    confirmationContacts: normalizedContacts,
    contactEmails: normalizedContacts.map(c => c.email),
  };
}

function mapInvoiceRow(row: typeof invoices.$inferSelect): Invoice {
  const documentType = getInvoiceDocumentType({
    invoiceNumber: row.invoiceNumber,
    proformaNumber: row.proformaNumber ?? undefined,
    definitiveInvoiceNumber: row.definitiveInvoiceNumber ?? undefined,
  });
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    documentType,
    dueDate: row.dueDate ?? undefined,
    proformaNumber: row.proformaNumber ?? undefined,
    proformaDate: row.proformaDate ?? undefined,
    definitiveInvoiceNumber: row.definitiveInvoiceNumber ?? undefined,
    definitiveInvoiceDate: row.definitiveInvoiceDate ?? undefined,
    paymentScheme: 'STANDARD',
    contractNumber: row.contractNumber ?? undefined,
    purpose: row.purpose,
    operationNature: row.operationNature,
    supplierId: row.supplierId ?? undefined,
    supplierName: row.supplierName,
    supplierCountry: row.supplierCountry,
    supplierAddress: row.supplierAddress,
    supplierBank: row.supplierBank,
    supplierIban: row.supplierIban,
    supplierSwift: row.supplierSwift,
    currency: row.currency,
    totalAmount: row.totalAmount,
    notes: row.notes ?? undefined,
    documents: row.documents ?? [],
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    createdById: row.createdById,
    isDemo: row.isDemo,
  };
}

function mapInvoiceSummaryRow(row: typeof invoices.$inferSelect): Invoice {
  const inv = mapInvoiceRow(row);
  return {
    ...inv,
    documents: (inv.documents ?? []).map(stripDocBase64),
  };
}

function mapOrderRow(row: typeof paymentOrders.$inferSelect): PaymentOrder {
  const isExchangeValidated = row.exchangeTransaction?.status === 'VALIDE';
  const normalizedStatus = normalizeLegacyStatus(
    row.status,
    Boolean(row.requiresRateNegotiation),
    isExchangeValidated
  );
  const history = Array.isArray(row.history)
    ? row.history.map(h => ({
        ...h,
        fromStatus:
          h.fromStatus === 'INITIAL'
            ? ('INITIAL' as const)
            : normalizeLegacyStatus(
                h.fromStatus,
                Boolean(row.requiresRateNegotiation),
                isExchangeValidated
              ),
        toStatus: normalizeLegacyStatus(
          h.toStatus,
          Boolean(row.requiresRateNegotiation),
          isExchangeValidated
        ),
      }))
    : [];

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    userCode: row.userCode ?? undefined,
    yearCode: row.yearCode ?? undefined,
    orderSeq: row.orderSeq ?? undefined,
    contractNumber: row.contractNumber ?? undefined,
    fiscalYear: row.fiscalYear ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    createdById: row.createdById,
    department: row.department ?? undefined,
    purpose: row.purpose,
    supplierId: row.supplierId ?? undefined,
    beneficiaryName: row.beneficiaryName,
    beneficiaryCountry: row.beneficiaryCountry,
    beneficiaryAddress: row.beneficiaryAddress,
    beneficiaryBank: row.beneficiaryBank,
    beneficiaryIban: row.beneficiaryIban,
    beneficiarySwift: row.beneficiarySwift,
    invoiceId: row.invoiceId ?? undefined,
    currency: row.currency,
    grossAmount: row.grossAmount ?? undefined,
    deductionsTotal: row.deductionsTotal ?? undefined,
    deductions: Array.isArray(row.deductions) ? row.deductions : [],
    amount: row.amount,
    amountInWords: row.amountInWords,
    transferPurpose: row.transferPurpose,
    documentBasis: (row.documentBasis as InvoiceDocumentBasis) ?? undefined,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    proformaNumber: row.proformaNumber ?? undefined,
    proformaDate: row.proformaDate ?? undefined,
    domiciliationNumber: row.domiciliationNumber ?? undefined,
    operationNature: row.operationNature,
    bankId: row.bankId,
    bankName: row.bankName,
    bankBranch: row.bankBranch,
    bankFileRef: row.bankFileRef,
    remarks: row.remarks ?? undefined,
    transferType: row.transferType ?? undefined,
    lcNumber: row.lcNumber ?? undefined,
    requiresRateNegotiation: row.requiresRateNegotiation,
    status: normalizedStatus,
    history,
    deposit: row.deposit ?? undefined,
    executionDate: row.executionDate ?? undefined,
    executingBank: row.executingBank ?? undefined,
    executedAmount: row.executedAmount ?? undefined,
    finalExchangeRate: row.finalExchangeRate ?? undefined,
    debitAmountTnd: row.debitAmountTnd ?? undefined,
    accountDebitDate: row.accountDebitDate ?? undefined,
    swiftReference: row.swiftReference ?? undefined,
    bankFees: row.bankFees ?? undefined,
    executionReceiptDocId: row.executionReceiptDocId ?? undefined,
    exchangeTransaction: row.exchangeTransaction ?? undefined,
    documents: row.documents ?? [],
    isDemo: row.isDemo,
  };
}

function mapOrderSummaryRow(row: typeof paymentOrders.$inferSelect): PaymentOrder {
  const order = mapOrderRow(row);
  return {
    ...order,
    documents: (order.documents ?? []).map(stripDocBase64),
  };
}

function mapConsultationRow(
  row: typeof currencyConsultations.$inferSelect
): CurrencyConsultation {
  return {
    id: row.id,
    consultationNumber: row.consultationNumber,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    createdById: row.createdById,
    orderIds: row.orderIds ?? [],
    orderNumbers: row.orderNumbers ?? [],
    currency: row.currency,
    totalAmount: row.totalAmount,
    operationDate: row.operationDate,
    purchaseType: row.purchaseType,
    submissionDeadlineTime: row.submissionDeadlineTime,
    validityDeadlineTime: row.validityDeadlineTime,
    contactPhone: row.contactPhone ?? undefined,
    contactEmail: row.contactEmail ?? undefined,
    faxNumbers: row.faxNumbers ?? undefined,
    consultedBankIds: row.consultedBankIds ?? [],
    status: row.status,
    quotes: row.quotes ?? [],
    selectedBankId: row.selectedBankId ?? undefined,
    selectedBankName: row.selectedBankName ?? undefined,
    negotiatedRate: row.negotiatedRate ?? undefined,
    confirmationRef: row.confirmationRef ?? undefined,
    confirmationDate: row.confirmationDate ?? undefined,
    valueDate: row.valueDate ?? undefined,
    notes: row.notes ?? undefined,
    customPdfText: row.customPdfText ?? undefined,
    customConfirmationTexts: row.customConfirmationTexts ?? undefined,
    isDemo: row.isDemo,
  };
}

function mapSupplierRow(row: typeof suppliers.$inferSelect): Supplier {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    country: row.country,
    address: row.address,
    bankName: row.bankName,
    iban: row.iban,
    swift: row.swift,
    email: row.email,
    phone: row.phone ?? undefined,
    active: row.active,
  };
}

function mapProfileRow(row: typeof mtkProfiles.$inferSelect): User {
  return {
    id: row.id,
    userCode: row.userCode ?? undefined,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    avatar: row.avatar ?? undefined,
  };
}

function mapAuditRow(row: typeof auditLogs.$inferSelect): AuditLog {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    entityRef: row.entityRef,
    action: row.action,
    timestamp: row.timestamp,
    userId: row.userId,
    userName: row.userName,
    userRole: row.userRole,
    details: row.details,
    ipAddress: row.ipAddress ?? undefined,
  };
}

async function seedInitialData(txOrDb: typeof db): Promise<void> {
  if (INITIAL_USERS.length > 0) {
    await txOrDb
      .insert(mtkProfiles)
      .values(
        INITIAL_USERS.map(u => ({
          id: u.id,
          userCode: u.userCode ?? null,
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          avatar: u.avatar ?? null,
        }))
      )
      .onConflictDoNothing();
  }

  if (INITIAL_SUPPLIERS.length > 0) {
    await txOrDb
      .insert(suppliers)
      .values(
        INITIAL_SUPPLIERS.map(s => ({
          id: s.id,
          code: s.code,
          name: s.name,
          country: s.country,
          address: s.address,
          bankName: s.bankName,
          iban: s.iban,
          swift: s.swift,
          email: s.email,
          phone: s.phone ?? null,
          active: s.active,
        }))
      )
      .onConflictDoNothing();
  }

  if (INITIAL_BANKS.length > 0) {
    await txOrDb
      .insert(banks)
      .values(
        INITIAL_BANKS.map(b => ({
          id: b.id,
          code: b.code,
          name: b.name,
          swiftCode: b.swiftCode,
          country: b.country,
          active: b.active,
          contactAgency: b.contactAgency ?? null,
          tradingDeskName: b.tradingDeskName ?? null,
          tradingDeskFax: b.tradingDeskFax ?? null,
          tradingDeskPhone: b.tradingDeskPhone ?? null,
          tradingDeskAddress: b.tradingDeskAddress ?? null,
          contactEmails: b.contactEmails ?? [],
          confirmationContacts: b.confirmationContacts ?? [],
        }))
      )
      .onConflictDoNothing();
  }

  if (INITIAL_INVOICES.length > 0) {
    await txOrDb
      .insert(invoices)
      .values(
        INITIAL_INVOICES.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate ?? null,
          proformaNumber: inv.proformaNumber ?? null,
          proformaDate: inv.proformaDate ?? null,
          definitiveInvoiceNumber: inv.definitiveInvoiceNumber ?? null,
          definitiveInvoiceDate: inv.definitiveInvoiceDate ?? null,
          paymentScheme: inv.paymentScheme ?? null,
          contractNumber: inv.contractNumber ?? null,
          purpose: inv.purpose,
          operationNature: inv.operationNature,
          supplierId: inv.supplierId ?? null,
          supplierName: inv.supplierName,
          supplierCountry: inv.supplierCountry,
          supplierAddress: inv.supplierAddress,
          supplierBank: inv.supplierBank,
          supplierIban: inv.supplierIban,
          supplierSwift: inv.supplierSwift,
          currency: inv.currency,
          totalAmount: inv.totalAmount,
          notes: inv.notes ?? null,
          documents: inv.documents ?? [],
          createdAt: inv.createdAt,
          createdBy: inv.createdBy,
          createdById: inv.createdById,
          isDemo: inv.isDemo,
        }))
      )
      .onConflictDoNothing();
  }

  if (INITIAL_ORDERS.length > 0) {
    await txOrDb
      .insert(paymentOrders)
      .values(
        INITIAL_ORDERS.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          userCode: o.userCode ?? null,
          yearCode: o.yearCode ?? null,
          orderSeq: o.orderSeq ?? null,
          contractNumber: o.contractNumber ?? null,
          fiscalYear: o.fiscalYear ?? null,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          createdBy: o.createdBy,
          createdById: o.createdById,
          department: o.department ?? null,
          purpose: o.purpose,
          supplierId: o.supplierId ?? null,
          beneficiaryName: o.beneficiaryName,
          beneficiaryCountry: o.beneficiaryCountry,
          beneficiaryAddress: o.beneficiaryAddress,
          beneficiaryBank: o.beneficiaryBank,
          beneficiaryIban: o.beneficiaryIban,
          beneficiarySwift: o.beneficiarySwift,
          invoiceId: o.invoiceId ?? null,
          currency: o.currency,
          grossAmount: o.grossAmount ?? null,
          deductionsTotal: o.deductionsTotal ?? null,
          deductions: o.deductions ?? [],
          amount: o.amount,
          amountInWords: o.amountInWords,
          transferPurpose: o.transferPurpose,
          documentBasis: o.documentBasis ?? null,
          invoiceNumber: o.invoiceNumber,
          invoiceDate: o.invoiceDate,
          proformaNumber: o.proformaNumber ?? null,
          proformaDate: o.proformaDate ?? null,
          domiciliationNumber: o.domiciliationNumber ?? null,
          operationNature: o.operationNature,
          bankId: o.bankId,
          bankName: o.bankName,
          bankBranch: o.bankBranch,
          bankFileRef: o.bankFileRef,
          remarks: o.remarks ?? null,
          transferType: o.transferType ?? null,
          lcNumber: o.lcNumber ?? null,
          requiresRateNegotiation: Boolean(o.requiresRateNegotiation),
          status: o.status,
          history: o.history ?? [],
          deposit: o.deposit ?? null,
          executionDate: o.executionDate ?? null,
          executingBank: o.executingBank ?? null,
          executedAmount: o.executedAmount ?? null,
          finalExchangeRate: o.finalExchangeRate ?? null,
          debitAmountTnd: o.debitAmountTnd ?? null,
          accountDebitDate: o.accountDebitDate ?? null,
          swiftReference: o.swiftReference ?? null,
          bankFees: o.bankFees ?? null,
          executionReceiptDocId: o.executionReceiptDocId ?? null,
          exchangeTransaction: o.exchangeTransaction ?? null,
          documents: o.documents ?? [],
          isDemo: o.isDemo,
        }))
      )
      .onConflictDoNothing();
  }

  if (INITIAL_AUDIT_LOGS.length > 0) {
    await txOrDb
      .insert(auditLogs)
      .values(
        INITIAL_AUDIT_LOGS.map(l => ({
          id: l.id,
          entityType: l.entityType,
          entityId: l.entityId,
          entityRef: l.entityRef,
          action: l.action,
          timestamp: l.timestamp,
          userId: l.userId,
          userName: l.userName,
          userRole: l.userRole,
          details: l.details,
          ipAddress: l.ipAddress ?? null,
        }))
      )
      .onConflictDoNothing();
  }
}

class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

async function withDbSafety<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DomainError || error instanceof ForbiddenError) {
      throw error;
    }
    console.error('Database operation failed:', error);
    throw new Error('Une erreur de base de données est survenue. Veuillez réessayer.', {
      cause: error,
    });
  }
}

class PostgresRepository {
  private async ensureSeeded(): Promise<void> {
    if (!seedPromise) {
      seedPromise = (async () => {
        const existing = await db.select().from(mtkProfiles).limit(1);
        if (existing.length === 0) {
          await seedInitialData(db);
        }
      })().catch(err => {
        seedPromise = null;
        throw err;
      });
    }
    await seedPromise;
  }

  private async insertAuditLog(
    log: Omit<AuditLog, 'id' | 'timestamp'>,
    txOrDb: typeof db = db
  ): Promise<void> {
    const entry: AuditLog = {
      ...log,
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    };
    await txOrDb.insert(auditLogs).values({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityRef: entry.entityRef,
      action: entry.action,
      timestamp: entry.timestamp,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      details: entry.details,
      ipAddress: entry.ipAddress ?? null,
    });
  }

  public async getUsers(): Promise<User[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(mtkProfiles);
      return rows.map(mapProfileRow);
    });
  }

  public async getSuppliers(): Promise<Supplier[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(suppliers);
      return rows.map(mapSupplierRow);
    });
  }

  public async createSupplier(
    supplier: Omit<Supplier, 'id'>,
    user: User
  ): Promise<Supplier> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const newSupplier: Supplier = {
        ...supplier,
        id: 'sup_' + Date.now(),
      };
      await db.insert(suppliers).values({
        id: newSupplier.id,
        code: newSupplier.code,
        name: newSupplier.name,
        country: newSupplier.country,
        address: newSupplier.address,
        bankName: newSupplier.bankName,
        iban: newSupplier.iban,
        swift: newSupplier.swift,
        email: newSupplier.email,
        phone: newSupplier.phone ?? null,
        active: newSupplier.active,
      });
      await this.insertAuditLog({
        entityType: 'SUPPLIER',
        entityId: newSupplier.id,
        entityRef: newSupplier.name,
        action: 'SUPPLIER_CREATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Création du fournisseur international : ${newSupplier.name} (${newSupplier.country})`,
      });
      return newSupplier;
    });
  }

  public async getBanks(): Promise<Bank[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(banks);
      return rows.map(mapBankRow);
    });
  }

  public async createBank(bank: Omit<Bank, 'id'>, user: User): Promise<Bank> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
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
        tradingDeskAddress:
          bank.tradingDeskAddress?.trim() ||
          bank.tradingDeskName?.trim() ||
          `${code} SALLE DE CHANGE`,
        tradingDeskFax: bank.tradingDeskFax?.trim() || undefined,
        tradingDeskPhone: bank.tradingDeskPhone?.trim() || undefined,
        confirmationContacts: normalizedContacts,
        contactEmails: normalizedContacts.map(c => c.email),
      };

      await db.insert(banks).values({
        id: newBank.id,
        code: newBank.code,
        name: newBank.name,
        swiftCode: newBank.swiftCode,
        country: newBank.country,
        active: newBank.active,
        contactAgency: newBank.contactAgency ?? null,
        tradingDeskName: newBank.tradingDeskName ?? null,
        tradingDeskFax: newBank.tradingDeskFax ?? null,
        tradingDeskPhone: newBank.tradingDeskPhone ?? null,
        tradingDeskAddress: newBank.tradingDeskAddress ?? null,
        contactEmails: newBank.contactEmails ?? [],
        confirmationContacts: newBank.confirmationContacts ?? [],
      });

      await this.insertAuditLog({
        entityType: 'BANK',
        entityId: newBank.id,
        entityRef: newBank.name,
        action: 'BANK_CREATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Ajout de la banque tunisienne : ${newBank.name} (${newBank.code}) — ${normalizedContacts.length} contact(s) email de confirmation`,
      });
      return newBank;
    });
  }

  public async updateBank(id: string, bankData: Partial<Bank>, user: User): Promise<Bank> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(banks).where(eq(banks.id, id));
      if (rows.length === 0) {
        throw new DomainError('Banque introuvable');
      }
      const existing = mapBankRow(rows[0]);
      const hasContactsField =
        bankData.confirmationContacts !== undefined || bankData.contactEmails !== undefined;
      const normalizedContacts = hasContactsField
        ? normalizeBankConfirmationContacts(bankData.confirmationContacts, bankData.contactEmails)
        : normalizeBankConfirmationContacts(existing.confirmationContacts, existing.contactEmails);

      const updatedCode = (bankData.code !== undefined ? bankData.code : existing.code)
        .trim()
        .toUpperCase();
      const updatedBank: Bank = {
        ...existing,
        ...bankData,
        id: existing.id,
        code: updatedCode,
        name: (bankData.name !== undefined ? bankData.name : existing.name).trim(),
        swiftCode: (
          bankData.swiftCode !== undefined ? bankData.swiftCode : existing.swiftCode
        )
          .trim()
          .toUpperCase(),
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
            ? bankData.tradingDeskAddress.trim() ||
              bankData.tradingDeskName?.trim() ||
              `${updatedCode} SALLE DE CHANGE`
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

      await db
        .update(banks)
        .set({
          code: updatedBank.code,
          name: updatedBank.name,
          swiftCode: updatedBank.swiftCode,
          country: updatedBank.country,
          active: updatedBank.active,
          contactAgency: updatedBank.contactAgency ?? null,
          tradingDeskName: updatedBank.tradingDeskName ?? null,
          tradingDeskFax: updatedBank.tradingDeskFax ?? null,
          tradingDeskPhone: updatedBank.tradingDeskPhone ?? null,
          tradingDeskAddress: updatedBank.tradingDeskAddress ?? null,
          contactEmails: updatedBank.contactEmails ?? [],
          confirmationContacts: updatedBank.confirmationContacts ?? [],
        })
        .where(eq(banks.id, id));

      await this.insertAuditLog({
        entityType: 'BANK',
        entityId: updatedBank.id,
        entityRef: updatedBank.name,
        action: 'BANK_UPDATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Mise à jour des coordonnées & contacts email (${normalizedContacts.length}) de la banque ${updatedBank.name} (${updatedBank.code})`,
      });
      return updatedBank;
    });
  }

  public async getInvoices(
    filters: { isDemo?: boolean | 'ALL'; includeDocData?: boolean } = {}
  ): Promise<Invoice[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(invoices);
      const mapper = filters.includeDocData ? mapInvoiceRow : mapInvoiceSummaryRow;
      return rows
        .map(mapper)
        .filter(inv => {
          if (filters.isDemo !== undefined && filters.isDemo !== 'ALL') {
            return inv.isDemo === filters.isDemo;
          }
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }

  public async getInvoiceById(id: string): Promise<Invoice | undefined> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(invoices).where(eq(invoices.id, id));
      return rows[0] ? mapInvoiceRow(rows[0]) : undefined;
    });
  }

  public async getInvoiceDocument(invoiceId: string, docId: string) {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (rows.length === 0) return undefined;
      const docs = rows[0].documents ?? [];
      return docs.find((d, idx) => (d.id || `inv_doc_${idx}`) === docId || d.name === docId);
    });
  }

  public async createInvoice(payload: Partial<Invoice>, user: User): Promise<Invoice> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      const explicitDocType = payload.documentType;
      const rawProforma = (payload.proformaNumber || '').trim();
      const rawDefinitive = (payload.definitiveInvoiceNumber || '').trim();
      const rawExplicit = (payload.invoiceNumber || '').trim();

      const isProforma =
        explicitDocType === 'PROFORMA' ||
        (!explicitDocType && Boolean(rawProforma) && !rawDefinitive);

      let proformaNumber: string | undefined;
      let proformaDate: string | undefined;
      let definitiveInvoiceNumber: string | undefined;
      let definitiveInvoiceDate: string | undefined;
      let invoiceNumber: string;
      let invoiceDate: string;

      if (isProforma) {
        proformaNumber = rawProforma || rawExplicit || undefined;
        proformaDate = proformaNumber
          ? (payload.proformaDate || payload.invoiceDate || '').trim() || today
          : undefined;
        definitiveInvoiceNumber = undefined;
        definitiveInvoiceDate = undefined;
        invoiceNumber = proformaNumber || '';
        invoiceDate = proformaDate || today;
      } else {
        definitiveInvoiceNumber = rawDefinitive || rawExplicit || undefined;
        definitiveInvoiceDate = definitiveInvoiceNumber
          ? (payload.definitiveInvoiceDate || payload.invoiceDate || '').trim() || today
          : undefined;
        proformaNumber =
          rawProforma &&
          definitiveInvoiceNumber &&
          rawProforma.toLowerCase() !== definitiveInvoiceNumber.toLowerCase()
            ? rawProforma
            : undefined;
        proformaDate = proformaNumber
          ? (payload.proformaDate || '').trim() || today
          : undefined;
        invoiceNumber = definitiveInvoiceNumber || '';
        invoiceDate = definitiveInvoiceDate || today;
      }

      if (!invoiceNumber) {
        throw new DomainError(
          isProforma
            ? 'Veuillez saisir le numéro de la Proforma.'
            : 'Veuillez saisir le numéro de la Facture.'
        );
      }

      const documentType = isProforma ? ('PROFORMA' as const) : ('FACTURE' as const);

      const allExisting = (await db.select().from(invoices)).map(mapInvoiceRow);
      const candidateRefs = Array.from(
        new Set(
          [invoiceNumber, proformaNumber, definitiveInvoiceNumber].filter((v): v is string =>
            Boolean(v)
          )
        )
      );
      const conflict = findReferenceConflict(candidateRefs, allExisting);
      if (conflict) {
        throw new DomainError(
          `Une fiche portant déjà la référence ${conflict.conflictRef} existe dans le registre.`
        );
      }

      const supplierName = (payload.supplierName || '').trim();
      if (!supplierName) {
        throw new DomainError('Le nom du fournisseur est obligatoire.');
      }

      const totalAmount = Number(payload.totalAmount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new DomainError(
          'Le montant total de la facture doit être strictement supérieur à 0.'
        );
      }

      const newInvoice: Invoice = {
        id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        invoiceNumber,
        invoiceDate,
        documentType,
        dueDate: payload.dueDate || undefined,
        proformaNumber,
        proformaDate,
        definitiveInvoiceNumber,
        definitiveInvoiceDate,
        paymentScheme: 'STANDARD',
        contractNumber: (payload.contractNumber || '').trim() || undefined,
        purpose:
          (payload.purpose || '').trim() ||
          `Règlement ${isProforma ? `Proforma ${invoiceNumber}` : `Facture ${invoiceNumber}`}`,
        operationNature: payload.operationNature || 'Importation tabac brut',
        supplierId: payload.supplierId || undefined,
        supplierName,
        supplierCountry: (payload.supplierCountry || '').trim(),
        supplierAddress: (payload.supplierAddress || '').trim(),
        supplierBank: (payload.supplierBank || '').trim(),
        supplierIban: (payload.supplierIban || '').trim(),
        supplierSwift: (payload.supplierSwift || '').trim().toUpperCase(),
        currency: payload.currency || 'EUR',
        totalAmount: Number(totalAmount.toFixed(2)),
        notes: (payload.notes || '').trim() || undefined,
        documents: Array.isArray(payload.documents) ? payload.documents : [],
        createdAt: now,
        createdBy: user.name,
        createdById: user.id,
        isDemo: payload.isDemo !== undefined ? payload.isDemo : false,
      };

      await db.insert(invoices).values({
        id: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        invoiceDate: newInvoice.invoiceDate,
        dueDate: newInvoice.dueDate ?? null,
        proformaNumber: newInvoice.proformaNumber ?? null,
        proformaDate: newInvoice.proformaDate ?? null,
        definitiveInvoiceNumber: newInvoice.definitiveInvoiceNumber ?? null,
        definitiveInvoiceDate: newInvoice.definitiveInvoiceDate ?? null,
        paymentScheme: 'STANDARD',
        contractNumber: newInvoice.contractNumber ?? null,
        purpose: newInvoice.purpose,
        operationNature: newInvoice.operationNature,
        supplierId: newInvoice.supplierId ?? null,
        supplierName: newInvoice.supplierName,
        supplierCountry: newInvoice.supplierCountry,
        supplierAddress: newInvoice.supplierAddress,
        supplierBank: newInvoice.supplierBank,
        supplierIban: newInvoice.supplierIban,
        supplierSwift: newInvoice.supplierSwift,
        currency: newInvoice.currency,
        totalAmount: newInvoice.totalAmount,
        notes: newInvoice.notes ?? null,
        documents: newInvoice.documents ?? [],
        createdAt: newInvoice.createdAt,
        createdBy: newInvoice.createdBy,
        createdById: newInvoice.createdById,
        isDemo: newInvoice.isDemo,
      });

      await this.insertAuditLog({
        entityType: 'INVOICE',
        entityId: newInvoice.id,
        entityRef: newInvoice.invoiceNumber,
        action: 'INVOICE_CREATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Création ${isProforma ? 'Proforma' : 'Facture'} ${newInvoice.invoiceNumber} (${newInvoice.supplierName} — ${newInvoice.totalAmount} ${newInvoice.currency})`,
      });

      return newInvoice;
    });
  }

  public async updateInvoice(
    id: string,
    payload: Partial<Invoice>,
    user: User
  ): Promise<Invoice> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const existingRows = await db.select().from(invoices);
      const allInvoices = existingRows.map(mapInvoiceRow);
      const current = allInvoices.find(inv => inv.id === id);
      if (!current) {
        throw new DomainError('Facture introuvable.');
      }

      const perm = canUserManageInvoice(user, current);
      if (!perm.allowed) {
        throw new ForbiddenError(
          perm.reason || 'Seul l’Administrateur ou le créateur peut modifier cette facture.'
        );
      }

      const validation = validateAdminInvoiceUpdate({
        current,
        payload,
        existingInvoices: allInvoices,
      });
      if (!validation.valid) {
        throw new DomainError(validation.error || 'Données de facture invalides.');
      }

      let nextProformaNumber =
        payload.proformaNumber !== undefined
          ? payload.proformaNumber.trim() || undefined
          : current.proformaNumber;
      let nextProformaDate =
        payload.proformaDate !== undefined
          ? payload.proformaDate.trim() || undefined
          : current.proformaDate;

      let nextDefinitiveNumber =
        payload.definitiveInvoiceNumber !== undefined
          ? payload.definitiveInvoiceNumber.trim() || undefined
          : current.definitiveInvoiceNumber;
      let nextDefinitiveDate =
        payload.definitiveInvoiceDate !== undefined
          ? payload.definitiveInvoiceDate.trim() || undefined
          : current.definitiveInvoiceDate;

      if (payload.documentType === 'PROFORMA') {
        nextProformaNumber =
          nextProformaNumber || (payload.invoiceNumber || current.invoiceNumber).trim();
        nextProformaDate = nextProformaDate || payload.invoiceDate || current.invoiceDate;
        nextDefinitiveNumber = undefined;
        nextDefinitiveDate = undefined;
      } else if (payload.documentType === 'FACTURE') {
        nextDefinitiveNumber =
          nextDefinitiveNumber || (payload.invoiceNumber || current.invoiceNumber).trim();
        nextDefinitiveDate = nextDefinitiveDate || payload.invoiceDate || current.invoiceDate;
      }

      const nextPaymentScheme: InvoicePaymentScheme = 'STANDARD';

      const syncedInvoiceNumber =
        payload.documentType === 'PROFORMA'
          ? nextProformaNumber || validation.normalizedNumber || current.invoiceNumber
          : nextDefinitiveNumber ||
            validation.normalizedNumber ||
            nextProformaNumber ||
            current.invoiceNumber;
      const syncedInvoiceDate =
        payload.documentType === 'PROFORMA'
          ? nextProformaDate || payload.invoiceDate || current.invoiceDate
          : nextDefinitiveNumber && nextDefinitiveDate
          ? nextDefinitiveDate
          : payload.invoiceDate ?? current.invoiceDate;

      const updated: Invoice = {
        ...current,
        invoiceNumber: syncedInvoiceNumber,
        invoiceDate: syncedInvoiceDate,
        documentType: getInvoiceDocumentType({
          documentType: payload.documentType,
          invoiceNumber: syncedInvoiceNumber,
          proformaNumber: nextProformaNumber,
          definitiveInvoiceNumber: nextDefinitiveNumber,
        }),
        dueDate:
          payload.dueDate !== undefined ? payload.dueDate || undefined : current.dueDate,
        proformaNumber: nextProformaNumber,
        proformaDate: nextProformaNumber ? nextProformaDate : undefined,
        definitiveInvoiceNumber: nextDefinitiveNumber,
        definitiveInvoiceDate: nextDefinitiveNumber ? nextDefinitiveDate : undefined,
        paymentScheme: nextPaymentScheme,
        contractNumber:
          payload.contractNumber !== undefined
            ? payload.contractNumber.trim() || undefined
            : current.contractNumber,
        purpose: payload.purpose !== undefined ? payload.purpose.trim() : current.purpose,
        operationNature: payload.operationNature ?? current.operationNature,
        supplierId:
          payload.supplierId !== undefined
            ? payload.supplierId || undefined
            : current.supplierId,
        supplierName:
          payload.supplierName !== undefined
            ? payload.supplierName.trim()
            : current.supplierName,
        supplierCountry:
          payload.supplierCountry !== undefined
            ? payload.supplierCountry.trim()
            : current.supplierCountry,
        supplierAddress:
          payload.supplierAddress !== undefined
            ? payload.supplierAddress.trim()
            : current.supplierAddress,
        supplierBank:
          payload.supplierBank !== undefined
            ? payload.supplierBank.trim()
            : current.supplierBank,
        supplierIban:
          payload.supplierIban !== undefined
            ? payload.supplierIban.trim()
            : current.supplierIban,
        supplierSwift:
          payload.supplierSwift !== undefined
            ? payload.supplierSwift.trim().toUpperCase()
            : current.supplierSwift,
        currency: payload.currency ?? current.currency,
        totalAmount: validation.totalAmount ?? current.totalAmount,
        notes:
          payload.notes !== undefined ? payload.notes.trim() || undefined : current.notes,
        documents: Array.isArray(payload.documents) ? payload.documents : current.documents,
      };

      await db
        .update(invoices)
        .set({
          invoiceNumber: updated.invoiceNumber,
          invoiceDate: updated.invoiceDate,
          dueDate: updated.dueDate ?? null,
          proformaNumber: updated.proformaNumber ?? null,
          proformaDate: updated.proformaDate ?? null,
          definitiveInvoiceNumber: updated.definitiveInvoiceNumber ?? null,
          definitiveInvoiceDate: updated.definitiveInvoiceDate ?? null,
          paymentScheme: updated.paymentScheme ?? null,
          contractNumber: updated.contractNumber ?? null,
          purpose: updated.purpose,
          operationNature: updated.operationNature,
          supplierId: updated.supplierId ?? null,
          supplierName: updated.supplierName,
          supplierCountry: updated.supplierCountry,
          supplierAddress: updated.supplierAddress,
          supplierBank: updated.supplierBank,
          supplierIban: updated.supplierIban,
          supplierSwift: updated.supplierSwift,
          currency: updated.currency,
          totalAmount: updated.totalAmount,
          notes: updated.notes ?? null,
          documents: updated.documents ?? [],
        })
        .where(eq(invoices.id, id));

      await this.insertAuditLog({
        entityType: 'INVOICE',
        entityId: updated.id,
        entityRef: updated.invoiceNumber,
        action: 'INVOICE_UPDATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Modification de la facture ${updated.invoiceNumber} (${updated.supplierName} — ${updated.totalAmount} ${updated.currency}) par ${
          isAdministrator(user) ? "l'Administrateur" : 'le créateur'
        }`,
      });

      return updated;
    });
  }

  public async attachDefinitiveInvoice(
    id: string,
    payload: {
      definitiveInvoiceNumber: string;
      definitiveInvoiceDate?: string;
      document?: Omit<PaymentDocument, 'id' | 'orderId'>;
    },
    user: User
  ): Promise<Invoice> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allInvoices = (await db.select().from(invoices)).map(mapInvoiceRow);
      const current = allInvoices.find(inv => inv.id === id);
      if (!current) {
        throw new DomainError('Dossier facture introuvable.');
      }

      if (current.definitiveInvoiceNumber) {
        const perm = canUserManageInvoice(user, current);
        if (!perm.allowed) {
          throw new ForbiddenError(
            perm.reason ||
              'La facture définitive est déjà renseignée ; seul l’Administrateur ou le créateur peut la modifier.'
          );
        }
      }

      const defNum = (payload.definitiveInvoiceNumber || '').trim();
      if (!defNum) {
        throw new DomainError('La nouvelle référence de Facture est obligatoire.');
      }

      const sourceProformaRef = (current.proformaNumber || current.invoiceNumber || '').trim();
      if (
        sourceProformaRef &&
        defNum.toLowerCase() === sourceProformaRef.toLowerCase()
      ) {
        throw new DomainError(
          `La nouvelle référence de Facture doit être différente de la référence Proforma (${sourceProformaRef}).`
        );
      }

      const conflict = findReferenceConflict([defNum], allInvoices, current.id);
      if (conflict) {
        throw new DomainError(
          `Une autre fiche facture porte déjà la référence ${conflict.conflictRef}.`
        );
      }

      const today = new Date().toISOString().split('T')[0];
      const defDate = (payload.definitiveInvoiceDate || '').trim() || today;

      let nextDocs = [...(current.documents || [])];
      if (payload.document && payload.document.name) {
        nextDocs.push({
          ...payload.document,
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          type: payload.document.type || 'FACTURE',
          docRole: payload.document.docRole || 'FACTURE_DEFINITIVE',
          uploadedAt: payload.document.uploadedAt || new Date().toISOString(),
          uploadedBy: payload.document.uploadedBy || user.name,
        });
      }

      const updated: Invoice = {
        ...current,
        documentType: 'FACTURE',
        proformaNumber: sourceProformaRef,
        proformaDate: current.proformaDate || current.invoiceDate,
        definitiveInvoiceNumber: defNum,
        definitiveInvoiceDate: defDate,
        invoiceNumber: defNum,
        invoiceDate: defDate,
        paymentScheme: 'STANDARD',
        documents: nextDocs,
      };

      await db
        .update(invoices)
        .set({
          proformaNumber: updated.proformaNumber ?? null,
          proformaDate: updated.proformaDate ?? null,
          definitiveInvoiceNumber: updated.definitiveInvoiceNumber ?? null,
          definitiveInvoiceDate: updated.definitiveInvoiceDate ?? null,
          invoiceNumber: updated.invoiceNumber,
          invoiceDate: updated.invoiceDate,
          paymentScheme: 'STANDARD',
          documents: updated.documents ?? [],
        })
        .where(eq(invoices.id, id));

      await this.insertAuditLog({
        entityType: 'INVOICE',
        entityId: updated.id,
        entityRef: updated.invoiceNumber,
        action: 'INVOICE_DEFINITIVE_ATTACHED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Conversion de la Proforma ${
          updated.proformaNumber || '—'
        } en Facture N° ${defNum} (${defDate}) — montant total inchangé (${updated.totalAmount} ${updated.currency})`,
      });

      return updated;
    });
  }

  public async deleteInvoice(id: string, user: User): Promise<void> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const invRows = await db.select().from(invoices).where(eq(invoices.id, id));
      if (invRows.length === 0) {
        throw new DomainError('Facture introuvable.');
      }
      const invoice = mapInvoiceRow(invRows[0]);
      const perm = canUserManageInvoice(user, invoice);
      if (!perm.allowed) {
        throw new ForbiddenError(
          perm.reason || 'Seul l’Administrateur ou le créateur peut supprimer cette facture.'
        );
      }

      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const ordersToDetach = findOrdersToDetachFromInvoice(allOrders, id);
      await db.transaction(async tx => {
        for (const ord of ordersToDetach) {
          await tx
            .update(paymentOrders)
            .set({ invoiceId: null })
            .where(eq(paymentOrders.id, ord.id));
        }
        await tx.delete(invoices).where(eq(invoices.id, id));
      });

      await this.insertAuditLog({
        entityType: 'INVOICE',
        entityId: invoice.id,
        entityRef: invoice.invoiceNumber,
        action: 'INVOICE_DELETED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Suppression de la facture ${invoice.invoiceNumber} (${invoice.totalAmount} ${invoice.currency}) par ${
          isAdministrator(user) ? "l'Administrateur" : 'le créateur'
        }${ordersToDetach.length > 0 ? ` — ${ordersToDetach.length} ordre(s) détaché(s)` : ''}`,
      });
    });
  }

  public async getOrders(
    filters: FilterParams & { includeDocData?: boolean } = {}
  ): Promise<PaymentOrder[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(paymentOrders)
        .orderBy(desc(paymentOrders.createdAt));
      const mapper = filters.includeDocData ? mapOrderRow : mapOrderSummaryRow;
      const allOrders = rows.map(mapper);
      return filterOrders(allOrders, filters);
    });
  }

  public async getOrderById(id: string): Promise<PaymentOrder | undefined> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(paymentOrders).where(eq(paymentOrders.id, id));
      return rows[0] ? mapOrderRow(rows[0]) : undefined;
    });
  }

  public async getOrderDocument(orderId: string, docId: string) {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db.select().from(paymentOrders).where(eq(paymentOrders.id, orderId));
      if (rows.length === 0) return undefined;
      const docs = rows[0].documents ?? [];
      return docs.find(d => d.id === docId || d.name === docId);
    });
  }

  public async getBootstrapData(isDemo: boolean | 'ALL' = 'ALL') {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const [invRows, orderRows, bankRows, supplierRows, userRows, consultationRows] =
        await Promise.all([
          db.select().from(invoices),
          db.select().from(paymentOrders).orderBy(desc(paymentOrders.createdAt)),
          db.select().from(banks),
          db.select().from(suppliers),
          db.select().from(mtkProfiles),
          db.select().from(currencyConsultations).orderBy(desc(currencyConsultations.createdAt)),
        ]);

      const invoicesList = invRows
        .map(mapInvoiceSummaryRow)
        .filter(inv => (isDemo === 'ALL' ? true : inv.isDemo === isDemo))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const ordersList = filterOrders(
        orderRows.map(mapOrderSummaryRow),
        { isDemo }
      );

      const consultationsList = consultationRows
        .map(mapConsultationRow)
        .filter(c => (isDemo === 'ALL' ? true : c.isDemo === isDemo));

      return {
        invoices: invoicesList,
        orders: ordersList,
        banks: bankRows.map(mapBankRow),
        suppliers: supplierRows.map(mapSupplierRow),
        users: userRows.map(mapProfileRow),
        consultations: consultationsList,
      };
    });
  }

  public async previewNextOrderNumber(
    user: User,
    fiscalYear: number = new Date().getFullYear()
  ) {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const uCode = user.userCode || '001';
      return computeNextStructuredOrderNumber(uCode, fiscalYear, allOrders);
    });
  }

  public async createOrder(
    payload: Partial<PaymentOrder> & {
      definitiveInvoiceNumber?: string;
      definitiveInvoiceDate?: string;
    },
    user: User
  ): Promise<PaymentOrder> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const year = payload.fiscalYear || new Date().getFullYear();
      const uCode = user.userCode || '001';
      const structured = computeNextStructuredOrderNumber(uCode, year, allOrders);
      const orderNumber = structured.orderNumber;
      const now = new Date().toISOString();

      const amount = Number((Number(payload.amount) || 0).toFixed(2));
      const currency = payload.currency || 'EUR';
      const dedCheck = normalizeOrderDeductions(payload.deductions);
      if (dedCheck.error) {
        throw new DomainError(dedCheck.error);
      }
      let normalizedDeductions = dedCheck.items;
      let deductionsTotal = dedCheck.total;
      let grossAmount =
        payload.grossAmount !== undefined && Number.isFinite(Number(payload.grossAmount))
          ? Number(Number(payload.grossAmount).toFixed(2))
          : Number((amount + deductionsTotal).toFixed(2));

      const amountInWords = payload.amountInWords || numberToFrenchWords(amount, currency);

      let linkedInvoice: Invoice | undefined;
      let allInvoices: Invoice[] = [];
      let linkedOrdersCount = 0;
      if (payload.invoiceId) {
        allInvoices = (await db.select().from(invoices)).map(mapInvoiceRow);
        linkedInvoice = allInvoices.find(inv => inv.id === payload.invoiceId);
        if (!linkedInvoice) {
          throw new DomainError('Facture rattachée introuvable.');
        }
        const validation = validateOrderAgainstInvoice(
          linkedInvoice,
          allOrders,
          amount,
          currency,
          payload.deductions,
          payload.grossAmount
        );
        if (!validation.valid) {
          throw new DomainError(
            validation.error || 'Montant invalide par rapport au solde de la facture.'
          );
        }
        linkedOrdersCount = validation.summary.linkedOrders.length;
        normalizedDeductions = validation.normalizedDeductions;
        deductionsTotal = validation.deductionsTotal;
        grossAmount = validation.grossAmount;
      }

      const docSnap = resolveOrderDocumentSnapshot({
        invoice: linkedInvoice,
        documentBasis: payload.documentBasis,
        explicitInvoiceNumber: payload.invoiceNumber,
        explicitInvoiceDate: payload.invoiceDate,
        inlineDefinitiveNumber: payload.definitiveInvoiceNumber,
        inlineDefinitiveDate: payload.definitiveInvoiceDate,
        existingInvoices: allInvoices,
        existingLinkedOrdersCount: linkedOrdersCount,
      });
      if (!docSnap.valid) {
        throw new DomainError(
          docSnap.error || 'Référence document invalide pour cet ordre de paiement.'
        );
      }

      const initialStatus: PaymentStatus =
        payload.status === 'TRANSMIS_SIGNATURE' ? 'TRANSMIS_SIGNATURE' : 'SAISI';

      const orderId = 'ord_' + Date.now();
      const historyEntry: PaymentWorkflow = {
        id: 'wf_' + Date.now(),
        orderId,
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
        id: orderId,
        orderNumber,
        userCode: structured.userPart,
        yearCode: structured.yearPart,
        orderSeq: structured.seqPart,
        contractNumber: payload.contractNumber || linkedInvoice?.contractNumber || '',
        transferType: payload.transferType || 'VIREMENT',
        lcNumber: payload.lcNumber || '',
        requiresRateNegotiation: Boolean(payload.requiresRateNegotiation),
        fiscalYear: year,
        createdAt: now,
        updatedAt: now,
        createdBy: user.name,
        createdById: user.id,
        department: payload.department || 'Direction Financière et Comptable',
        purpose: payload.purpose || linkedInvoice?.purpose || 'Règlement fournisseur étranger',
        supplierId: payload.supplierId || linkedInvoice?.supplierId,
        beneficiaryName: payload.beneficiaryName || linkedInvoice?.supplierName || '',
        beneficiaryCountry: payload.beneficiaryCountry || linkedInvoice?.supplierCountry || '',
        beneficiaryAddress: payload.beneficiaryAddress || linkedInvoice?.supplierAddress || '',
        beneficiaryBank: payload.beneficiaryBank || linkedInvoice?.supplierBank || '',
        beneficiaryIban: payload.beneficiaryIban || linkedInvoice?.supplierIban || '',
        beneficiarySwift: payload.beneficiarySwift || linkedInvoice?.supplierSwift || '',
        currency,
        grossAmount: deductionsTotal > 0 ? grossAmount : amount,
        deductionsTotal,
        deductions: normalizedDeductions,
        amount,
        amountInWords,
        transferPurpose: payload.transferPurpose || payload.purpose || '',
        invoiceId: linkedInvoice?.id,
        documentBasis: docSnap.documentBasis,
        invoiceNumber: docSnap.invoiceNumber,
        invoiceDate: docSnap.invoiceDate,
        proformaNumber: docSnap.proformaNumber,
        proformaDate: docSnap.proformaDate,
        domiciliationNumber: payload.domiciliationNumber || '',
        operationNature:
          payload.operationNature || linkedInvoice?.operationNature || 'Importation industrielle',
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
          orderId,
          status: 'NON_DEMARRE',
        },
      };

      const attachedDefinitive =
        docSnap.invoiceDefinitiveAttach && linkedInvoice
          ? {
              invoiceId: linkedInvoice.id,
              proformaNumber:
                linkedInvoice.proformaNumber || linkedInvoice.invoiceNumber,
              proformaDate: linkedInvoice.proformaDate || linkedInvoice.invoiceDate,
              definitiveInvoiceNumber:
                docSnap.invoiceDefinitiveAttach.definitiveInvoiceNumber,
              definitiveInvoiceDate:
                docSnap.invoiceDefinitiveAttach.definitiveInvoiceDate,
            }
          : null;

      await db.transaction(async tx => {
        if (attachedDefinitive && linkedInvoice) {
          await tx
            .update(invoices)
            .set({
              proformaNumber: attachedDefinitive.proformaNumber,
              proformaDate: attachedDefinitive.proformaDate,
              definitiveInvoiceNumber: attachedDefinitive.definitiveInvoiceNumber,
              definitiveInvoiceDate: attachedDefinitive.definitiveInvoiceDate,
              invoiceNumber: attachedDefinitive.definitiveInvoiceNumber,
              invoiceDate: attachedDefinitive.definitiveInvoiceDate,
            })
            .where(eq(invoices.id, linkedInvoice.id));
        }

        await tx.insert(paymentOrders).values({
          id: newOrder.id,
          orderNumber: newOrder.orderNumber,
          userCode: newOrder.userCode ?? null,
          yearCode: newOrder.yearCode ?? null,
          orderSeq: newOrder.orderSeq ?? null,
          contractNumber: newOrder.contractNumber ?? null,
          fiscalYear: newOrder.fiscalYear ?? null,
          createdAt: newOrder.createdAt,
          updatedAt: newOrder.updatedAt,
          createdBy: newOrder.createdBy,
          createdById: newOrder.createdById,
          department: newOrder.department ?? null,
          purpose: newOrder.purpose,
          supplierId: newOrder.supplierId ?? null,
          beneficiaryName: newOrder.beneficiaryName,
          beneficiaryCountry: newOrder.beneficiaryCountry,
          beneficiaryAddress: newOrder.beneficiaryAddress,
          beneficiaryBank: newOrder.beneficiaryBank,
          beneficiaryIban: newOrder.beneficiaryIban,
          beneficiarySwift: newOrder.beneficiarySwift,
          invoiceId: newOrder.invoiceId ?? null,
          documentBasis: newOrder.documentBasis ?? null,
          currency: newOrder.currency,
          grossAmount: newOrder.grossAmount ?? null,
          deductionsTotal: newOrder.deductionsTotal ?? 0,
          deductions: newOrder.deductions ?? [],
          amount: newOrder.amount,
          amountInWords: newOrder.amountInWords,
          transferPurpose: newOrder.transferPurpose,
          invoiceNumber: newOrder.invoiceNumber,
          invoiceDate: newOrder.invoiceDate,
          proformaNumber: newOrder.proformaNumber ?? null,
          proformaDate: newOrder.proformaDate ?? null,
          domiciliationNumber: newOrder.domiciliationNumber ?? null,
          operationNature: newOrder.operationNature,
          bankId: newOrder.bankId,
          bankName: newOrder.bankName,
          bankBranch: newOrder.bankBranch,
          bankFileRef: newOrder.bankFileRef,
          remarks: newOrder.remarks ?? null,
          transferType: newOrder.transferType ?? null,
          lcNumber: newOrder.lcNumber ?? null,
          requiresRateNegotiation: Boolean(newOrder.requiresRateNegotiation),
          status: newOrder.status,
          history: newOrder.history,
          deposit: null,
          exchangeTransaction: newOrder.exchangeTransaction ?? null,
          documents: newOrder.documents,
          isDemo: newOrder.isDemo,
        });
      });

      if (attachedDefinitive) {
        await this.insertAuditLog({
          entityType: 'INVOICE',
          entityId: attachedDefinitive.invoiceId,
          entityRef: attachedDefinitive.definitiveInvoiceNumber,
          action: 'INVOICE_DEFINITIVE_ATTACHED',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          details: `Conversion de la Proforma ${attachedDefinitive.proformaNumber} en Facture N° ${attachedDefinitive.definitiveInvoiceNumber} (${attachedDefinitive.definitiveInvoiceDate}) lors de la saisie de l'ordre ${newOrder.orderNumber} — montant total du dossier inchangé.`,
        });
      }

      const docMention = linkedInvoice
        ? ` — ${
            newOrder.documentBasis === 'PROFORMA' ? 'Proforma' : 'Facture'
          } ${newOrder.invoiceNumber}${
            newOrder.documentBasis === 'FACTURE_DEFINITIVE' && newOrder.proformaNumber
              ? ` (sur Proforma ${newOrder.proformaNumber})`
              : ''
          }`
        : '';

      await this.insertAuditLog({
        entityType: 'PAYMENT_ORDER',
        entityId: newOrder.id,
        entityRef: newOrder.orderNumber,
        action: 'ORDER_CREATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Création de l'ordre ${newOrder.orderNumber} pour ${newOrder.beneficiaryName} (Net : ${newOrder.amount} ${newOrder.currency}${deductionsTotal > 0 ? `, Brut facture : ${grossAmount} ${newOrder.currency}, Déductions : ${deductionsTotal} ${newOrder.currency}` : ''})${docMention}. Statut: ${newOrder.status}`,
      });

      return newOrder;
    });
  }

  public async updateOrder(
    id: string,
    payload: Partial<PaymentOrder>,
    user: User
  ): Promise<PaymentOrder> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allOrderRows = await db.select().from(paymentOrders);
      const allOrders = allOrderRows.map(mapOrderRow);
      const current = allOrders.find(o => o.id === id);
      if (!current) {
        throw new DomainError(`Ordre introuvable avec l'identifiant ${id}`);
      }

      const perm = canUserManageOrder(user, current);
      if (!perm.allowed) {
        throw new ForbiddenError(
          perm.reason || 'Seul l’Administrateur ou le créateur peut modifier cet ordre.'
        );
      }

      const isAdmin = isAdministrator(user);
      const effectivePayload: Partial<PaymentOrder> = isAdmin
        ? payload
        : {
            ...payload,
            orderNumber: current.orderNumber,
            status: current.status,
          };

      const validation = validateAdminOrderUpdate({
        current,
        payload: effectivePayload,
        existingOrders: allOrders,
      });
      if (!validation.valid) {
        throw new DomainError(validation.error || 'Données de l’ordre invalides.');
      }

      const now = new Date().toISOString();
      const updatedAmount = validation.amount ?? current.amount;
      const updatedCurrency = payload.currency || current.currency;
      const dedCheck = normalizeOrderDeductions(
        payload.deductions !== undefined ? payload.deductions : current.deductions
      );
      if (dedCheck.error) {
        throw new DomainError(dedCheck.error);
      }
      const updatedDeductionsTotal = dedCheck.total;
      const updatedGrossAmount =
        payload.grossAmount !== undefined && Number.isFinite(Number(payload.grossAmount))
          ? Number(Number(payload.grossAmount).toFixed(2))
          : Number((updatedAmount + updatedDeductionsTotal).toFixed(2));
      const amountInWords =
        payload.amountInWords || numberToFrenchWords(updatedAmount, updatedCurrency);

      const nextStatus = isAdmin && payload.status ? payload.status : current.status;
      const nextOrderNumber = isAdmin
        ? validation.normalizedOrderNumber || current.orderNumber
        : current.orderNumber;

      const updatedHistory =
        isAdmin && nextStatus !== current.status
          ? [
              ...current.history,
              {
                id: 'wf_' + Date.now(),
                orderId: current.id,
                fromStatus: current.status,
                toStatus: nextStatus,
                timestamp: now,
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                comment: `Modification administrative (statut : ${current.status} → ${nextStatus})`,
              },
            ]
          : current.history;

      const updated: PaymentOrder = {
        ...current,
        ...effectivePayload,
        id: current.id,
        orderNumber: nextOrderNumber,
        status: nextStatus,
        history: updatedHistory,
        grossAmount: updatedGrossAmount,
        deductionsTotal: updatedDeductionsTotal,
        deductions: dedCheck.items,
        amount: updatedAmount,
        currency: updatedCurrency,
        amountInWords,
        updatedAt: now,
      };

      const allConsultations = (await db.select().from(currencyConsultations)).map(
        mapConsultationRow
      );
      const consultationsToSync = syncOrderNumberInConsultations(allConsultations, updated);

      await db.transaction(async tx => {
        await tx
          .update(paymentOrders)
          .set({
            orderNumber: updated.orderNumber,
            contractNumber: updated.contractNumber ?? null,
            purpose: updated.purpose,
            supplierId: updated.supplierId ?? null,
            beneficiaryName: updated.beneficiaryName,
            beneficiaryCountry: updated.beneficiaryCountry,
            beneficiaryAddress: updated.beneficiaryAddress,
            beneficiaryBank: updated.beneficiaryBank,
            beneficiaryIban: updated.beneficiaryIban,
            beneficiarySwift: updated.beneficiarySwift,
            invoiceId: updated.invoiceId ?? null,
            documentBasis: updated.documentBasis ?? null,
            currency: updated.currency,
            grossAmount: updated.grossAmount ?? null,
            deductionsTotal: updated.deductionsTotal ?? 0,
            deductions: updated.deductions ?? [],
            amount: updated.amount,
            amountInWords: updated.amountInWords,
            transferPurpose: updated.transferPurpose,
            invoiceNumber: updated.invoiceNumber,
            invoiceDate: updated.invoiceDate,
            proformaNumber: updated.proformaNumber ?? null,
            proformaDate: updated.proformaDate ?? null,
            domiciliationNumber: updated.domiciliationNumber ?? null,
            operationNature: updated.operationNature,
            bankId: updated.bankId,
            bankName: updated.bankName,
            bankBranch: updated.bankBranch,
            bankFileRef: updated.bankFileRef,
            remarks: updated.remarks ?? null,
            transferType: updated.transferType ?? null,
            lcNumber: updated.lcNumber ?? null,
            requiresRateNegotiation: Boolean(updated.requiresRateNegotiation),
            status: updated.status,
            history: updated.history,
            updatedAt: updated.updatedAt,
          })
          .where(eq(paymentOrders.id, id));

        for (const cons of consultationsToSync) {
          await tx
            .update(currencyConsultations)
            .set({ orderNumbers: cons.orderNumbers })
            .where(eq(currencyConsultations.id, cons.id));
        }
      });

      await this.insertAuditLog({
        entityType: 'PAYMENT_ORDER',
        entityId: updated.id,
        entityRef: updated.orderNumber,
        action: user.role === 'ADMINISTRATEUR' ? 'ADMIN_ORDER_UPDATED' : 'ORDER_UPDATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Mise à jour des informations de l'ordre ${updated.orderNumber} (${updated.beneficiaryName} — ${updated.amount} ${updated.currency})`,
      });

      return updated;
    });
  }

  public async deleteOrder(id: string, user: User): Promise<void> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const target = allOrders.find(o => o.id === id);
      if (!target) {
        throw new DomainError('Ordre de paiement introuvable.');
      }

      const perm = canUserManageOrder(user, target);
      if (!perm.allowed) {
        throw new ForbiddenError(
          perm.reason || 'Seul l’Administrateur ou le créateur peut supprimer cet ordre.'
        );
      }

      const remainingOrders = allOrders.filter(o => o.id !== id);
      const allConsultations = (await db.select().from(currencyConsultations)).map(
        mapConsultationRow
      );
      const affectedConsultations = detachOrderFromConsultations(
        allConsultations,
        id,
        remainingOrders
      );

      await db.transaction(async tx => {
        for (const cons of affectedConsultations) {
          await tx
            .update(currencyConsultations)
            .set({
              orderIds: cons.orderIds,
              orderNumbers: cons.orderNumbers,
              totalAmount: cons.totalAmount,
            })
            .where(eq(currencyConsultations.id, cons.id));
        }
        await tx.delete(paymentOrders).where(eq(paymentOrders.id, id));
      });

      await this.insertAuditLog({
        entityType: 'PAYMENT_ORDER',
        entityId: target.id,
        entityRef: target.orderNumber,
        action: 'ORDER_DELETED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Suppression de l'ordre ${target.orderNumber} (${target.beneficiaryName} — ${target.amount} ${target.currency}) par ${
          isAdministrator(user) ? "l'Administrateur" : 'le créateur'
        }${
          affectedConsultations.length > 0
            ? ` · Détaché de ${affectedConsultations.length} consultation(s)`
            : ''
        }`,
      });
    });
  }

  public async updateOrderDeductions(
    id: string,
    payload: { deductions?: Array<Partial<OrderDeduction>>; grossAmount?: number },
    user: User
  ): Promise<PaymentOrder> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const current = allOrders.find(o => o.id === id);
      if (!current) {
        throw new DomainError(`Ordre de paiement introuvable (${id})`);
      }

      const allInvoices = (await db.select().from(invoices)).map(mapInvoiceRow);
      const linkedInvoice = allInvoices.find(
        inv =>
          (current.invoiceId && inv.id === current.invoiceId) ||
          doesOrderBelongToInvoice(current, inv)
      );

      const validation = validateExistingOrderDeductionsUpdate({
        order: current,
        invoice: linkedInvoice,
        allOrders,
        deductions: payload?.deductions,
        grossAmount: payload?.grossAmount,
      });

      if (!validation.valid) {
        throw new DomainError(
          validation.error || "Impossible de mettre à jour les déductions sur cet ordre."
        );
      }

      const now = new Date().toISOString();
      const amountInWords = numberToFrenchWords(validation.netAmount, current.currency);
      const historyComment =
        validation.deductionsTotal > 0
          ? `Mise à jour des déductions / frais sur l'ordre : Brut ${validation.grossAmount.toFixed(
              2
            )} ${current.currency} − Déductions ${validation.deductionsTotal.toFixed(2)} ${
              current.currency
            } = Net à transférer ${validation.netAmount.toFixed(2)} ${
              current.currency
            } (${validation.normalizedDeductions
              .map(d => `${d.label}: ${d.amount.toFixed(2)}`)
              .join(', ')})`
          : `Suppression des déductions / frais sur l'ordre : Net à transférer rétabli à ${validation.netAmount.toFixed(
              2
            )} ${current.currency}`;

      const workflowEntry: PaymentWorkflow = {
        id: 'wf_' + Date.now(),
        orderId: current.id,
        fromStatus: current.status,
        toStatus: current.status,
        timestamp: now,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        comment: historyComment,
      };

      const updated: PaymentOrder = {
        ...current,
        invoiceId: current.invoiceId || linkedInvoice?.id,
        grossAmount: validation.grossAmount,
        deductionsTotal: validation.deductionsTotal,
        deductions: validation.normalizedDeductions,
        amount: validation.netAmount,
        amountInWords,
        updatedAt: now,
        history: [...current.history, workflowEntry],
      };

      await db
        .update(paymentOrders)
        .set({
          invoiceId: updated.invoiceId ?? null,
          grossAmount: updated.grossAmount ?? null,
          deductionsTotal: updated.deductionsTotal ?? 0,
          deductions: updated.deductions ?? [],
          amount: updated.amount,
          amountInWords: updated.amountInWords,
          updatedAt: updated.updatedAt,
          history: updated.history,
        })
        .where(eq(paymentOrders.id, id));

      await this.insertAuditLog({
        entityType: 'PAYMENT_ORDER',
        entityId: updated.id,
        entityRef: updated.orderNumber,
        action: 'ORDER_DEDUCTIONS_UPDATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `${historyComment}${
          linkedInvoice ? ` — Facture ${linkedInvoice.invoiceNumber}` : ''
        }`,
      });

      return updated;
    });
  }

  public async changeOrderStatus(
    orderId: string,
    targetStatus: PaymentStatus,
    comment: string,
    user: User,
    depositData?: Partial<BankDeposit>,
    executionData?: Partial<PaymentOrder>
  ): Promise<PaymentOrder> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.id, orderId));
      if (rows.length === 0) {
        throw new DomainError(`Ordre introuvable : ${orderId}`);
      }

      const order = mapOrderRow(rows[0]);
      if (targetStatus === 'EXECUTE') {
        const allConsultations = (await db.select().from(currencyConsultations)).map(
          mapConsultationRow
        );
        const execCheck = canExecuteOrder(order, allConsultations);
        if (!execCheck.allowed) {
          throw new DomainError(
            execCheck.reason ||
              "Exécution impossible : la consultation d'achat de devises doit être clôturée avant l'exécution."
          );
        }
      }

      const check = canUserPerformTransition(order.status, targetStatus, user.role);
      if (!check.allowed) {
        throw new DomainError(check.reason || 'Action non autorisée sur cet ordre de paiement.');
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

      if (
        (targetStatus === 'DEPOSE_BANQUE' || targetStatus === 'EN_ATTENTE_ACHAT_DEVISE') &&
        depositData
      ) {
        updated.deposit = {
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
      }

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

      await db
        .update(paymentOrders)
        .set({
          status: updated.status,
          updatedAt: updated.updatedAt,
          history: updated.history,
          deposit: updated.deposit ?? null,
          executionDate: updated.executionDate ?? null,
          executingBank: updated.executingBank ?? null,
          executedAmount: updated.executedAmount ?? null,
          finalExchangeRate: updated.finalExchangeRate ?? null,
          debitAmountTnd: updated.debitAmountTnd ?? null,
          accountDebitDate: updated.accountDebitDate ?? null,
          swiftReference: updated.swiftReference ?? null,
          bankFees: updated.bankFees ?? null,
        })
        .where(eq(paymentOrders.id, orderId));

      await this.insertAuditLog({
        entityType: 'PAYMENT_ORDER',
        entityId: updated.id,
        entityRef: updated.orderNumber,
        action: `STATUS_CHANGED_${targetStatus}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Changement de statut : ${order.status} -> ${targetStatus}. Motif : ${comment}`,
      });

      return updated;
    });
  }

  public async addDocumentToOrder(
    orderId: string,
    doc: Omit<PaymentOrder['documents'][0], 'id' | 'orderId'>,
    user: User
  ): Promise<PaymentOrder> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.id, orderId));
      if (rows.length === 0) throw new DomainError('Ordre introuvable');
      const order = mapOrderRow(rows[0]);

      const newDoc = {
        ...doc,
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        orderId,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.name,
      };

      const nextDocs = [...order.documents, newDoc];
      const nextUpdatedAt = new Date().toISOString();

      await db
        .update(paymentOrders)
        .set({
          documents: nextDocs,
          updatedAt: nextUpdatedAt,
        })
        .where(eq(paymentOrders.id, orderId));

      await this.insertAuditLog({
        entityType: 'PAYMENT_ORDER',
        entityId: order.id,
        entityRef: order.orderNumber,
        action: 'DOCUMENT_UPLOADED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Ajout de la pièce justificative ${newDoc.name} (${newDoc.type})`,
      });

      return {
        ...order,
        documents: nextDocs,
        updatedAt: nextUpdatedAt,
      };
    });
  }

  public async getDashboardStats(filters: FilterParams = {}): Promise<DashboardStats> {
    const filtered = await this.getOrders(filters);
    return computeDashboardStatsFromOrders(filtered);
  }

  public async getAuditLogs(): Promise<AuditLog[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(2000);
      return rows.map(mapAuditRow);
    });
  }

  public async getConsultations(): Promise<CurrencyConsultation[]> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(currencyConsultations)
        .orderBy(desc(currencyConsultations.createdAt));
      return rows.map(mapConsultationRow);
    });
  }

  public async createConsultation(
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
  ): Promise<CurrencyConsultation> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const orderIds = Array.isArray(payload.orderIds) ? payload.orderIds : [];
      if (orderIds.length === 0) {
        throw new DomainError('Veuillez sélectionner au moins un ordre de paiement.');
      }

      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const selectedOrders = orderIds
        .map(id => allOrders.find(o => o.id === id))
        .filter((o): o is PaymentOrder => Boolean(o));

      if (selectedOrders.length !== orderIds.length) {
        throw new DomainError('Un ou plusieurs ordres sélectionnés sont introuvables.');
      }

      const validation = validateConsultationSelection(selectedOrders);
      if (!validation.valid || !validation.currency) {
        throw new DomainError(
          validation.error || 'Sélection d’ordres invalide pour la consultation.'
        );
      }

      const allConsultations = (await db.select().from(currencyConsultations)).map(
        mapConsultationRow
      );
      const alreadyLinked = allConsultations.find(
        c => c.status !== 'ANNULEE' && c.orderIds.some(oid => orderIds.includes(oid))
      );
      if (alreadyLinked) {
        throw new DomainError(
          `Un des ordres sélectionnés est déjà inclus dans la consultation ${alreadyLinked.consultationNumber}.`
        );
      }

      const now = new Date().toISOString();
      const year = new Date().getFullYear();
      const seq = String(allConsultations.length + 1).padStart(4, '0');
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

      await db.insert(currencyConsultations).values({
        id: consultation.id,
        consultationNumber: consultation.consultationNumber,
        createdAt: consultation.createdAt,
        createdBy: consultation.createdBy,
        createdById: consultation.createdById,
        orderIds: consultation.orderIds,
        orderNumbers: consultation.orderNumbers,
        currency: consultation.currency,
        totalAmount: consultation.totalAmount,
        operationDate: consultation.operationDate,
        purchaseType: consultation.purchaseType,
        submissionDeadlineTime: consultation.submissionDeadlineTime,
        validityDeadlineTime: consultation.validityDeadlineTime,
        contactPhone: consultation.contactPhone ?? null,
        contactEmail: consultation.contactEmail ?? null,
        faxNumbers: consultation.faxNumbers ?? null,
        consultedBankIds: consultation.consultedBankIds ?? [],
        status: consultation.status,
        quotes: consultation.quotes ?? [],
        notes: consultation.notes ?? null,
        isDemo: consultation.isDemo,
      });

      for (const order of selectedOrders) {
        await db
          .update(paymentOrders)
          .set({
            updatedAt: now,
            exchangeTransaction: {
              ...(order.exchangeTransaction || {
                id: 'ex_' + order.id,
                orderId: order.id,
              }),
              consultationId: consultation.id,
              consultationNumber: consultation.consultationNumber,
              status: 'CONSULTATION_EN_COURS',
              consultationDate: consultation.operationDate,
            },
          })
          .where(eq(paymentOrders.id, order.id));
      }

      await this.insertAuditLog({
        entityType: 'CONSULTATION',
        entityId: consultation.id,
        entityRef: consultation.consultationNumber,
        action: 'CONSULTATION_CREATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Création de la consultation ${consultation.consultationNumber} (${consultation.totalAmount} ${consultation.currency}, ${consultation.purchaseType}, limites ${consultation.submissionDeadlineTime} / ${consultation.validityDeadlineTime}) regroupant : ${consultation.orderNumbers.join(', ')}`,
      });

      return consultation;
    });
  }

  public async recordConsultationQuotes(
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
  ): Promise<CurrencyConsultation> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(currencyConsultations)
        .where(eq(currencyConsultations.id, consultationId));
      if (rows.length === 0) {
        throw new DomainError('Consultation introuvable.');
      }

      const current = mapConsultationRow(rows[0]);
      if (current.status === 'ANNULEE') {
        throw new DomainError('Impossible de modifier une consultation annulée.');
      }

      const allConsultations = (await db.select().from(currencyConsultations)).map(
        mapConsultationRow
      );

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
                : Math.abs(
                    Number(q.proposedAmount ?? current.totalAmount) - current.totalAmount
                  ) < 0.01;
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
        payload.confirmationDate ||
        current.confirmationDate ||
        (shouldClose ? current.operationDate : undefined);
      const valueDate =
        payload.valueDate ||
        current.valueDate ||
        (shouldClose && confirmationDate ? computeDefaultValueDate(confirmationDate) : undefined);
      const confirmationRef =
        payload.confirmationRef ||
        current.confirmationRef ||
        (shouldClose ? generateNextConfirmationRef(allConsultations) : undefined);

      const updated: CurrencyConsultation = {
        ...current,
        quotes: normalizedQuotes,
        selectedBankId: payload.selectedBankId ?? current.selectedBankId,
        selectedBankName: payload.selectedBankName ?? current.selectedBankName,
        negotiatedRate:
          payload.negotiatedRate !== undefined
            ? Number(payload.negotiatedRate)
            : current.negotiatedRate,
        confirmationRef,
        confirmationDate,
        valueDate,
        notes: payload.notes ?? current.notes,
        status: shouldClose ? 'CLOTUREE' : current.status,
      };

      await db
        .update(currencyConsultations)
        .set({
          quotes: updated.quotes ?? [],
          selectedBankId: updated.selectedBankId ?? null,
          selectedBankName: updated.selectedBankName ?? null,
          negotiatedRate: updated.negotiatedRate ?? null,
          confirmationRef: updated.confirmationRef ?? null,
          confirmationDate: updated.confirmationDate ?? null,
          valueDate: updated.valueDate ?? null,
          notes: updated.notes ?? null,
          status: updated.status,
        })
        .where(eq(currencyConsultations.id, consultationId));

      for (const oid of updated.orderIds) {
        const orderRows = await db.select().from(paymentOrders).where(eq(paymentOrders.id, oid));
        if (orderRows.length > 0) {
          const currentOrder = mapOrderRow(orderRows[0]);
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

          await db
            .update(paymentOrders)
            .set({
              status: refreshedOrder.status,
              updatedAt: refreshedOrder.updatedAt,
              history: refreshedOrder.history,
              exchangeTransaction: refreshedOrder.exchangeTransaction ?? null,
            })
            .where(eq(paymentOrders.id, oid));

          if (statusChanged && workflowEntry) {
            await this.insertAuditLog({
              entityType: 'PAYMENT_ORDER',
              entityId: refreshedOrder.id,
              entityRef: refreshedOrder.orderNumber,
              action: 'STATUS_CHANGED_DEPOSE_BANQUE',
              userId: user.id,
              userName: user.name,
              userRole: user.role,
              details:
                workflowEntry.comment ||
                `Achat de devise confirmé via consultation ${updated.consultationNumber}`,
            });
          }
        }
      }

      await this.insertAuditLog({
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

      return updated;
    });
  }

  public async cancelConsultation(
    consultationId: string,
    reason: string,
    user: User
  ): Promise<CurrencyConsultation> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(currencyConsultations)
        .where(eq(currencyConsultations.id, consultationId));
      if (rows.length === 0) {
        throw new DomainError('Consultation introuvable.');
      }

      const current = mapConsultationRow(rows[0]);
      if (current.status === 'ANNULEE') {
        return current;
      }

      const now = new Date().toISOString();
      const updated: CurrencyConsultation = {
        ...current,
        status: 'ANNULEE',
        notes: reason || current.notes,
      };

      await db
        .update(currencyConsultations)
        .set({
          status: 'ANNULEE',
          notes: updated.notes ?? null,
        })
        .where(eq(currencyConsultations.id, consultationId));

      for (const oid of current.orderIds) {
        const orderRows = await db.select().from(paymentOrders).where(eq(paymentOrders.id, oid));
        if (orderRows.length > 0 && orderRows[0].status === 'EN_ATTENTE_ACHAT_DEVISE') {
          await db
            .update(paymentOrders)
            .set({
              updatedAt: now,
              exchangeTransaction: {
                id: 'ex_' + oid,
                orderId: oid,
                status: 'NON_DEMARRE',
              },
            })
            .where(eq(paymentOrders.id, oid));
        }
      }

      await this.insertAuditLog({
        entityType: 'CONSULTATION',
        entityId: updated.id,
        entityRef: updated.consultationNumber,
        action: 'CONSULTATION_CANCELLED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Annulation consultation ${updated.consultationNumber}. Motif : ${reason || 'Non précisé'}`,
      });

      return updated;
    });
  }

  public async updateConsultation(
    consultationId: string,
    payload: Partial<CurrencyConsultation>,
    user: User
  ): Promise<CurrencyConsultation> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const allConsultations = (await db.select().from(currencyConsultations)).map(
        mapConsultationRow
      );
      const current = allConsultations.find(c => c.id === consultationId);
      if (!current) {
        throw new DomainError('Consultation introuvable.');
      }

      const perm = canUserManageConsultation(user, current);
      if (!perm.allowed) {
        throw new ForbiddenError(
          perm.reason || 'Seul l’Administrateur ou le créateur peut modifier cette consultation.'
        );
      }

      const isAdmin = isAdministrator(user);
      const effectivePayload: Partial<CurrencyConsultation> = isAdmin
        ? payload
        : {
            ...payload,
            consultationNumber: current.consultationNumber,
            status: current.status,
            selectedBankId: current.selectedBankId,
            selectedBankName: current.selectedBankName,
            negotiatedRate: current.negotiatedRate,
            confirmationRef: current.confirmationRef,
            confirmationDate: current.confirmationDate,
            valueDate: current.valueDate,
          };

      const validation = validateAdminConsultationUpdate({
        current,
        payload: effectivePayload,
        existingConsultations: allConsultations,
      });
      if (!validation.valid) {
        throw new DomainError(validation.error || 'Données de consultation invalides.');
      }

      const nextConsultNum = isAdmin
        ? (validation as any).normalizedNumber || current.consultationNumber
        : current.consultationNumber;

      const updated: CurrencyConsultation = {
        ...current,
        consultationNumber: nextConsultNum,
        operationDate: effectivePayload.operationDate ?? current.operationDate,
        purchaseType:
          effectivePayload.purchaseType !== undefined
            ? effectivePayload.purchaseType.trim()
            : current.purchaseType,
        submissionDeadlineTime:
          effectivePayload.submissionDeadlineTime !== undefined
            ? formatConsultationTime(effectivePayload.submissionDeadlineTime)
            : current.submissionDeadlineTime,
        validityDeadlineTime:
          effectivePayload.validityDeadlineTime !== undefined
            ? formatConsultationTime(effectivePayload.validityDeadlineTime)
            : current.validityDeadlineTime,
        contactPhone:
          effectivePayload.contactPhone !== undefined
            ? effectivePayload.contactPhone.trim() || undefined
            : current.contactPhone,
        contactEmail:
          effectivePayload.contactEmail !== undefined
            ? effectivePayload.contactEmail.trim() || undefined
            : current.contactEmail,
        faxNumbers:
          effectivePayload.faxNumbers !== undefined
            ? effectivePayload.faxNumbers.trim() || undefined
            : current.faxNumbers,
        consultedBankIds: Array.isArray(effectivePayload.consultedBankIds)
          ? effectivePayload.consultedBankIds
          : current.consultedBankIds,
        status: isAdmin ? effectivePayload.status ?? current.status : current.status,
        selectedBankId: isAdmin
          ? effectivePayload.selectedBankId !== undefined
            ? effectivePayload.selectedBankId || undefined
            : current.selectedBankId
          : current.selectedBankId,
        selectedBankName: isAdmin
          ? effectivePayload.selectedBankName !== undefined
            ? effectivePayload.selectedBankName || undefined
            : current.selectedBankName
          : current.selectedBankName,
        negotiatedRate: isAdmin
          ? effectivePayload.negotiatedRate !== undefined
            ? effectivePayload.negotiatedRate === null ||
              Number.isNaN(Number(effectivePayload.negotiatedRate))
              ? undefined
              : Number(effectivePayload.negotiatedRate)
            : current.negotiatedRate
          : current.negotiatedRate,
        confirmationRef: isAdmin
          ? effectivePayload.confirmationRef !== undefined
            ? effectivePayload.confirmationRef.trim() || undefined
            : current.confirmationRef
          : current.confirmationRef,
        confirmationDate: isAdmin
          ? effectivePayload.confirmationDate !== undefined
            ? effectivePayload.confirmationDate || undefined
            : current.confirmationDate
          : current.confirmationDate,
        valueDate: isAdmin
          ? effectivePayload.valueDate !== undefined
            ? effectivePayload.valueDate || undefined
            : current.valueDate
          : current.valueDate,
        notes:
          effectivePayload.notes !== undefined
            ? effectivePayload.notes.trim() || undefined
            : current.notes,
        customPdfText:
          effectivePayload.customPdfText !== undefined
            ? effectivePayload.customPdfText && Object.keys(effectivePayload.customPdfText).length > 0
              ? effectivePayload.customPdfText
              : undefined
            : current.customPdfText,
        customConfirmationTexts:
          effectivePayload.customConfirmationTexts !== undefined
            ? effectivePayload.customConfirmationTexts &&
              Object.keys(effectivePayload.customConfirmationTexts).length > 0
              ? effectivePayload.customConfirmationTexts
              : undefined
            : current.customConfirmationTexts,
      };

      const now = new Date().toISOString();
      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const ordersToSync = allOrders.filter(
        o => o.exchangeTransaction?.consultationId === consultationId
      );

      await db.transaction(async tx => {
        await tx
          .update(currencyConsultations)
          .set({
            consultationNumber: updated.consultationNumber,
            operationDate: updated.operationDate,
            purchaseType: updated.purchaseType,
            submissionDeadlineTime: updated.submissionDeadlineTime,
            validityDeadlineTime: updated.validityDeadlineTime,
            contactPhone: updated.contactPhone ?? null,
            contactEmail: updated.contactEmail ?? null,
            faxNumbers: updated.faxNumbers ?? null,
            consultedBankIds: updated.consultedBankIds ?? [],
            status: updated.status,
            selectedBankId: updated.selectedBankId ?? null,
            selectedBankName: updated.selectedBankName ?? null,
            negotiatedRate: updated.negotiatedRate ?? null,
            confirmationRef: updated.confirmationRef ?? null,
            confirmationDate: updated.confirmationDate ?? null,
            valueDate: updated.valueDate ?? null,
            notes: updated.notes ?? null,
            customPdfText: updated.customPdfText ?? null,
            customConfirmationTexts: updated.customConfirmationTexts ?? null,
          })
          .where(eq(currencyConsultations.id, consultationId));

        if (nextConsultNum !== current.consultationNumber) {
          for (const ord of ordersToSync) {
            await tx
              .update(paymentOrders)
              .set({
                updatedAt: now,
                exchangeTransaction: {
                  ...ord.exchangeTransaction!,
                  consultationNumber: updated.consultationNumber,
                },
              })
              .where(eq(paymentOrders.id, ord.id));
          }
        }
      });

      await this.insertAuditLog({
        entityType: 'CONSULTATION',
        entityId: updated.id,
        entityRef: updated.consultationNumber,
        action: 'CONSULTATION_UPDATED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Modification de la consultation ${updated.consultationNumber} (${updated.operationDate}, ${updated.purchaseType}) par ${
          isAdministrator(user) ? "l'Administrateur" : 'le créateur'
        }`,
      });

      return updated;
    });
  }

  public async deleteConsultation(consultationId: string, user: User): Promise<void> {
    return withDbSafety(async () => {
      await this.ensureSeeded();
      const rows = await db
        .select()
        .from(currencyConsultations)
        .where(eq(currencyConsultations.id, consultationId));
      if (rows.length === 0) {
        throw new DomainError('Consultation introuvable.');
      }
      const target = mapConsultationRow(rows[0]);

      const perm = canUserManageConsultation(user, target);
      if (!perm.allowed) {
        throw new ForbiddenError(
          perm.reason || 'Seul l’Administrateur ou le créateur peut supprimer cette consultation.'
        );
      }

      const allOrders = (await db.select().from(paymentOrders)).map(mapOrderRow);
      const ordersToReset = findOrdersToResetFromConsultation(allOrders, consultationId);
      const now = new Date().toISOString();

      await db.transaction(async tx => {
        for (const ord of ordersToReset) {
          await tx
            .update(paymentOrders)
            .set({
              updatedAt: now,
              exchangeTransaction: ord.exchangeTransaction ?? null,
            })
            .where(eq(paymentOrders.id, ord.id));
        }
        await tx
          .delete(currencyConsultations)
          .where(eq(currencyConsultations.id, consultationId));
      });

      await this.insertAuditLog({
        entityType: 'CONSULTATION',
        entityId: target.id,
        entityRef: target.consultationNumber,
        action: 'CONSULTATION_DELETED',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        details: `Suppression de la consultation ${target.consultationNumber} (${target.totalAmount} ${target.currency}) par ${
          isAdministrator(user) ? "l'Administrateur" : 'le créateur'
        }${
          ordersToReset.length > 0
            ? ` — ${ordersToReset.length} ordre(s) réinitialisé(s)`
            : ''
        }`,
      });
    });
  }

  public async resetDemoData(): Promise<void> {
    return withDbSafety(async () => {
      await db.transaction(async tx => {
        await tx.delete(paymentOrders);
        await tx.delete(invoices);
        await tx.delete(currencyConsultations);
        await tx.delete(auditLogs);
        await tx.delete(banks);
        await tx.delete(suppliers);
        await tx.delete(mtkProfiles);
        await seedInitialData(tx as unknown as typeof db);
      });
      seedPromise = Promise.resolve();
    });
  }
}

export const repository = new PostgresRepository();
