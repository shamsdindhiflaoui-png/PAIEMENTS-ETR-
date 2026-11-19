import {
  CurrencyConsultation,
  DashboardStats,
  FilterParams,
  Invoice,
  InvoicePaymentStatus,
  PaymentOrder,
  PaymentStatus,
} from '../types/payment';
import { computeInvoicePaymentSummary } from './invoiceUtils';

export interface InvoiceDashboardItem {
  invoice: Invoice;
  allocatedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  paymentStatus: InvoicePaymentStatus;
  linkedOrdersCount: number;
}

export interface InvoiceAxisMetrics {
  totalCount: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  totalByCurrency: Record<string, number>;
  allocatedByCurrency: Record<string, number>;
  remainingByCurrency: Record<string, number>;
  averageProgressPercent: number;
  recentInvoices: InvoiceDashboardItem[];
}

export interface ConsultationBankAward {
  bankName: string;
  winsCount: number;
  volumeByCurrency: Record<string, number>;
  lastRate?: number;
}

export interface ConsultationAxisMetrics {
  totalCount: number;
  openCount: number;
  closedCount: number;
  cancelledCount: number;
  pendingOrdersToConsultCount: number;
  volumeByCurrency: Record<string, number>;
  totalSavingsTnd: number;
  totalCounterValueTnd: number;
  bankAwards: ConsultationBankAward[];
  recentConsultations: CurrencyConsultation[];
}

function matchesDateAndFiscalFilters(
  dateStr: string | undefined,
  filters: FilterParams,
  explicitFiscalYear?: number
): boolean {
  const year = explicitFiscalYear
    ? String(explicitFiscalYear)
    : dateStr
    ? dateStr.slice(0, 4)
    : undefined;

  if (filters.fiscalYear && filters.fiscalYear !== 'ALL' && year !== String(filters.fiscalYear)) {
    return false;
  }

  const normalizedDate = dateStr ? dateStr.slice(0, 10) : '';
  if (filters.startDate && normalizedDate && normalizedDate < filters.startDate) {
    return false;
  }
  if (filters.endDate && normalizedDate && normalizedDate > filters.endDate) {
    return false;
  }
  return true;
}

export function computeInvoiceAxisMetrics(
  invoices: Invoice[],
  orders: PaymentOrder[],
  filters: FilterParams
): InvoiceAxisMetrics {
  const filteredInvoices = invoices.filter(inv => {
    if (filters.currency && filters.currency !== 'ALL' && inv.currency !== filters.currency) {
      return false;
    }
    if (!matchesDateAndFiscalFilters(inv.invoiceDate, filters)) {
      return false;
    }
    if (filters.bank && filters.bank !== 'ALL') {
      const linked = orders.filter(o => o.invoiceId === inv.id && o.status !== 'ANNULE');
      if (!linked.some(o => o.bankId === filters.bank)) {
        return false;
      }
    }
    return true;
  });

  const totalByCurrency: Record<string, number> = {};
  const allocatedByCurrency: Record<string, number> = {};
  const remainingByCurrency: Record<string, number> = {};

  let unpaidCount = 0;
  let partialCount = 0;
  let paidCount = 0;
  let progressSum = 0;

  const items: InvoiceDashboardItem[] = filteredInvoices.map(invoice => {
    const summary = computeInvoicePaymentSummary(invoice, orders);

    if (summary.paymentStatus === 'NON_PAYEE') unpaidCount += 1;
    else if (summary.paymentStatus === 'PARTIELLEMENT_PAYEE') partialCount += 1;
    else paidCount += 1;

    progressSum += summary.progressPercent;

    totalByCurrency[invoice.currency] =
      Number(((totalByCurrency[invoice.currency] || 0) + invoice.totalAmount).toFixed(2));
    allocatedByCurrency[invoice.currency] =
      Number(((allocatedByCurrency[invoice.currency] || 0) + summary.allocatedAmount).toFixed(2));
    remainingByCurrency[invoice.currency] =
      Number(((remainingByCurrency[invoice.currency] || 0) + summary.remainingAmount).toFixed(2));

    return {
      invoice,
      allocatedAmount: summary.allocatedAmount,
      remainingAmount: summary.remainingAmount,
      progressPercent: summary.progressPercent,
      paymentStatus: summary.paymentStatus,
      linkedOrdersCount: summary.linkedOrders.length,
    };
  });

  const sortedRecent = [...items].sort((a, b) =>
    (b.invoice.invoiceDate || b.invoice.createdAt).localeCompare(
      a.invoice.invoiceDate || a.invoice.createdAt
    )
  );

  return {
    totalCount: filteredInvoices.length,
    unpaidCount,
    partialCount,
    paidCount,
    totalByCurrency,
    allocatedByCurrency,
    remainingByCurrency,
    averageProgressPercent:
      filteredInvoices.length > 0 ? Math.round(progressSum / filteredInvoices.length) : 0,
    recentInvoices: sortedRecent.slice(0, 6),
  };
}

export function computeConsultationAxisMetrics(
  consultations: CurrencyConsultation[],
  orders: PaymentOrder[],
  filters: FilterParams
): ConsultationAxisMetrics {
  const filteredConsultations = consultations.filter(cons => {
    if (filters.currency && filters.currency !== 'ALL' && cons.currency !== filters.currency) {
      return false;
    }
    if (!matchesDateAndFiscalFilters(cons.operationDate || cons.createdAt, filters)) {
      return false;
    }
    if (filters.bank && filters.bank !== 'ALL') {
      const hasBankInConsulted = cons.consultedBankIds?.includes(filters.bank);
      const isSelectedBank = cons.selectedBankId === filters.bank;
      const hasOrderWithBank = cons.orderIds.some(oid => {
        const ord = orders.find(o => o.id === oid);
        return ord?.bankId === filters.bank;
      });
      if (!hasBankInConsulted && !isSelectedBank && !hasOrderWithBank) {
        return false;
      }
    }
    return true;
  });

  let openCount = 0;
  let closedCount = 0;
  let cancelledCount = 0;
  const volumeByCurrency: Record<string, number> = {};
  let totalSavingsTnd = 0;
  let totalCounterValueTnd = 0;

  const awardMap = new Map<string, ConsultationBankAward>();

  filteredConsultations.forEach(cons => {
    if (cons.status === 'OUVERTE') openCount += 1;
    else if (cons.status === 'CLOTUREE') closedCount += 1;
    else cancelledCount += 1;

    if (cons.status !== 'ANNULEE') {
      volumeByCurrency[cons.currency] = Number(
        ((volumeByCurrency[cons.currency] || 0) + cons.totalAmount).toFixed(2)
      );
    }

    if (cons.status === 'CLOTUREE' && cons.negotiatedRate && cons.negotiatedRate > 0) {
      totalCounterValueTnd += cons.totalAmount * cons.negotiatedRate;

      const quotes = Array.isArray(cons.quotes) ? cons.quotes : [];
      if (quotes.length > 1) {
        const highestRate = Math.max(...quotes.map(q => Number(q.rate) || 0));
        if (highestRate > cons.negotiatedRate) {
          totalSavingsTnd += (highestRate - cons.negotiatedRate) * cons.totalAmount;
        }
      }

      const winnerName = cons.selectedBankName || 'Banque retenue';
      const existing = awardMap.get(winnerName) || {
        bankName: winnerName,
        winsCount: 0,
        volumeByCurrency: {},
        lastRate: cons.negotiatedRate,
      };
      existing.winsCount += 1;
      existing.lastRate = cons.negotiatedRate;
      existing.volumeByCurrency[cons.currency] = Number(
        ((existing.volumeByCurrency[cons.currency] || 0) + cons.totalAmount).toFixed(2)
      );
      awardMap.set(winnerName, existing);
    }
  });

  const activeConsultedOrderIds = new Set(
    consultations.filter(c => c.status !== 'ANNULEE').flatMap(c => c.orderIds)
  );
  const pendingOrdersToConsultCount = orders.filter(o => {
    if (o.status !== 'EN_ATTENTE_ACHAT_DEVISE') return false;
    if (activeConsultedOrderIds.has(o.id)) return false;
    if (filters.currency && filters.currency !== 'ALL' && o.currency !== filters.currency) {
      return false;
    }
    if (filters.bank && filters.bank !== 'ALL' && o.bankId !== filters.bank) {
      return false;
    }
    if (!matchesDateAndFiscalFilters(o.createdAt, filters, o.fiscalYear)) {
      return false;
    }
    return true;
  }).length;

  const bankAwards = Array.from(awardMap.values()).sort((a, b) => b.winsCount - a.winsCount);
  const recentConsultations = [...filteredConsultations]
    .sort((a, b) => (b.operationDate || b.createdAt).localeCompare(a.operationDate || a.createdAt))
    .slice(0, 6);

  return {
    totalCount: filteredConsultations.length,
    openCount,
    closedCount,
    cancelledCount,
    pendingOrdersToConsultCount,
    volumeByCurrency,
    totalSavingsTnd: Number(totalSavingsTnd.toFixed(3)),
    totalCounterValueTnd: Number(totalCounterValueTnd.toFixed(3)),
    bankAwards,
    recentConsultations,
  };
}

export function filterOrders(
  orders: PaymentOrder[],
  filters: FilterParams = {}
): PaymentOrder[] {
  return orders.filter(order => {
    if (filters.status && filters.status !== 'ALL' && order.status !== filters.status) {
      return false;
    }
    if (filters.currency && filters.currency !== 'ALL' && order.currency !== filters.currency) {
      return false;
    }
    if (
      filters.bank &&
      filters.bank !== 'ALL' &&
      order.bankId !== filters.bank &&
      order.bankName !== filters.bank
    ) {
      return false;
    }
    if (
      filters.supplier &&
      filters.supplier !== 'ALL' &&
      order.supplierId !== filters.supplier &&
      !order.beneficiaryName.toLowerCase().includes(filters.supplier.toLowerCase())
    ) {
      return false;
    }
    if (filters.fiscalYear && filters.fiscalYear !== 'ALL') {
      const orderYear = order.fiscalYear || new Date(order.createdAt).getFullYear();
      if (orderYear !== Number(filters.fiscalYear)) return false;
    }
    if (filters.isDemo !== undefined && filters.isDemo !== 'ALL') {
      if (order.isDemo !== filters.isDemo) return false;
    }
    if (filters.startDate) {
      if (new Date(order.createdAt) < new Date(filters.startDate)) return false;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(order.createdAt) > end) return false;
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const matches =
        order.orderNumber.toLowerCase().includes(q) ||
        order.beneficiaryName.toLowerCase().includes(q) ||
        order.invoiceNumber.toLowerCase().includes(q) ||
        (order.proformaNumber && order.proformaNumber.toLowerCase().includes(q)) ||
        (order.contractNumber && order.contractNumber.toLowerCase().includes(q)) ||
        (order.lcNumber && order.lcNumber.toLowerCase().includes(q)) ||
        (order.domiciliationNumber && order.domiciliationNumber.toLowerCase().includes(q)) ||
        order.bankName.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });
}

export function computeDashboardStatsFromOrders(
  filtered: PaymentOrder[]
): DashboardStats {
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
  const monthlyMap: Record<
    string,
    { count: number; amountEur: number; amountUsd: number; executedTnd: number }
  > = {};

  filtered.forEach(o => {
    if (countByStatus[o.status] !== undefined) {
      countByStatus[o.status]++;
    }

    amountByCurrency[o.currency] = (amountByCurrency[o.currency] || 0) + o.amount;
    if (o.currency === 'EUR') totalEurAmount += o.amount;
    if (o.currency === 'USD') totalUsdAmount += o.amount;

    if (o.status === 'EXECUTE' && o.debitAmountTnd) {
      totalTndExecuted += o.debitAmountTnd;
    }

    const bankName = o.bankName || 'Non assignée';
    if (!ordersByBank[bankName]) {
      ordersByBank[bankName] = { count: 0, totalTnd: 0 };
    }
    ordersByBank[bankName].count++;
    if (o.debitAmountTnd) {
      ordersByBank[bankName].totalTnd += o.debitAmountTnd;
    }

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

