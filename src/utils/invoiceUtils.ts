import { Invoice, InvoicePaymentStatus, PaymentOrder } from '../types/payment';

export interface InvoicePaymentSummary {
  linkedOrders: PaymentOrder[];
  allocatedAmount: number;
  executedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  paymentStatus: InvoicePaymentStatus;
}

export function doesOrderBelongToInvoice(order: PaymentOrder, invoice: Invoice): boolean {
  if (order.invoiceId) {
    return order.invoiceId === invoice.id;
  }
  const orderInv = (order.invoiceNumber || '').trim().toLowerCase();
  const invNum = (invoice.invoiceNumber || '').trim().toLowerCase();
  return Boolean(orderInv && invNum && orderInv === invNum);
}

export function computeInvoicePaymentSummary(
  invoice: Invoice,
  orders: PaymentOrder[]
): InvoicePaymentSummary {
  const linkedOrders = orders.filter(
    o => o.status !== 'ANNULE' && doesOrderBelongToInvoice(o, invoice)
  );

  const allocatedAmount = Number(
    linkedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0).toFixed(2)
  );
  const executedAmount = Number(
    linkedOrders
      .filter(o => o.status === 'EXECUTE')
      .reduce((sum, o) => sum + (Number(o.amount) || 0), 0)
      .toFixed(2)
  );

  const totalAmount = Number(invoice.totalAmount) || 0;
  const remainingAmount = Math.max(0, Number((totalAmount - allocatedAmount).toFixed(2)));
  const progressPercent =
    totalAmount > 0 ? Math.min(100, Math.round((allocatedAmount / totalAmount) * 100)) : 0;

  let paymentStatus: InvoicePaymentStatus = 'NON_PAYEE';
  if (allocatedAmount > 0.005) {
    paymentStatus = remainingAmount <= 0.005 ? 'PAYEE' : 'PARTIELLEMENT_PAYEE';
  }

  return {
    linkedOrders,
    allocatedAmount,
    executedAmount,
    remainingAmount,
    progressPercent,
    paymentStatus,
  };
}

export function validateOrderAgainstInvoice(
  invoice: Invoice,
  orders: PaymentOrder[],
  requestedAmount: number,
  requestedCurrency: string
): { valid: boolean; error?: string; summary: InvoicePaymentSummary } {
  const summary = computeInvoicePaymentSummary(invoice, orders);

  if (requestedCurrency !== invoice.currency) {
    return {
      valid: false,
      error: `La devise de l’ordre (${requestedCurrency}) doit correspondre à la devise de la facture (${invoice.currency}).`,
      summary,
    };
  }

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return {
      valid: false,
      error: 'Le montant à payer sur la facture doit être strictement supérieur à 0.',
      summary,
    };
  }

  if (summary.remainingAmount <= 0.005) {
    return {
      valid: false,
      error: `La facture ${invoice.invoiceNumber} est déjà intégralement ordonnancée (${invoice.totalAmount} ${invoice.currency}).`,
      summary,
    };
  }

  if (requestedAmount > summary.remainingAmount + 0.005) {
    return {
      valid: false,
      error: `Le montant saisi (${requestedAmount.toFixed(2)} ${invoice.currency}) dépasse le solde restant de la facture (${summary.remainingAmount.toFixed(2)} ${invoice.currency}).`,
      summary,
    };
  }

  return { valid: true, summary };
}

export function getAvailableInvoicesForOrder(
  invoices: Invoice[],
  orders: PaymentOrder[]
): Array<{ invoice: Invoice; summary: InvoicePaymentSummary }> {
  return invoices
    .map(invoice => ({
      invoice,
      summary: computeInvoicePaymentSummary(invoice, orders),
    }))
    .filter(item => item.summary.remainingAmount > 0.005);
}
