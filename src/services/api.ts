import {
  PaymentOrder,
  Supplier,
  Bank,
  User,
  AuditLog,
  DashboardStats,
  FilterParams,
  PaymentStatus,
  BankDeposit,
  CurrencyConsultation,
  ExchangeQuote,
  Invoice,
  OrderDeduction,
} from '../types/payment';

class ApiService {
  private authToken: string | null = null;
  private authTokenFetchedAt = 0;
  private tokenPromise: Promise<string | null> | null = null;
  private tokenProvider: (() => Promise<string | null>) | null = null;

  private currentUser: User = {
    id: 'usr_agent1',
    userCode: '001',
    name: 'Monia Ben Salem',
    email: 'm.bensalem@mtk.tn',
    role: 'AGENT_FINANCIER',
    department: 'Service Trésorerie & Règlements Extérieurs',
  };

  public setAuthToken(token: string | null) {
    this.authToken = token;
    this.authTokenFetchedAt = token ? Date.now() : 0;
  }

  public setTokenProvider(provider: (() => Promise<string | null>) | null) {
    this.tokenProvider = provider;
  }

  public getCurrentUser(): User {
    return this.currentUser;
  }

  public setCurrentUser(user: User) {
    this.currentUser = user;
    localStorage.setItem('mtk_current_user', JSON.stringify(user));
  }

  public initUser() {
    try {
      const saved = localStorage.getItem('mtk_current_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch {
      // ignore
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    let token = this.authToken;
    const isTokenFresh = Boolean(token && Date.now() - this.authTokenFetchedAt < 30_000);
    if (!isTokenFresh && this.tokenProvider) {
      try {
        if (!this.tokenPromise) {
          this.tokenPromise = this.tokenProvider().finally(() => {
            this.tokenPromise = null;
          });
        }
        const fresh = await this.tokenPromise;
        if (fresh) {
          token = fresh;
          this.authToken = fresh;
          this.authTokenFetchedAt = Date.now();
        }
      } catch {
        // fallback to in-memory token
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUser.id,
      'x-user-role': this.currentUser.role,
      'x-user-name': encodeURIComponent(this.currentUser.name),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async getBootstrap(isDemo?: boolean | 'ALL'): Promise<{
    invoices: Invoice[];
    orders: PaymentOrder[];
    banks: Bank[];
    suppliers: Supplier[];
    users: User[];
    consultations: CurrencyConsultation[];
  }> {
    const params = new URLSearchParams();
    if (isDemo !== undefined && isDemo !== 'ALL') {
      params.set('isDemo', String(isDemo));
    }
    const qs = params.toString();
    const res = await fetch(`/api/bootstrap${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement initial des données');
    return res.json();
  }

  public async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users', { headers: await this.getHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs');
    return res.json();
  }

  public async getNextOrderNumber(fiscalYear?: number): Promise<{
    orderNumber: string;
    userPart: string;
    yearPart: string;
    seqPart: string;
  }> {
    const qs = fiscalYear ? `?fiscalYear=${fiscalYear}` : '';
    const res = await fetch(`/api/orders/next-number${qs}`, {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du calcul du numéro d’ordre');
    return res.json();
  }

  public async getSuppliers(): Promise<Supplier[]> {
    const res = await fetch('/api/suppliers', { headers: await this.getHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des fournisseurs');
    return res.json();
  }

  public async createSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(supplier),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur création fournisseur');
    }
    return res.json();
  }

  public async getBanks(): Promise<Bank[]> {
    const res = await fetch('/api/banks', { headers: await this.getHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des banques');
    return res.json();
  }

  public async createBank(bank: Omit<Bank, 'id'>): Promise<Bank> {
    const res = await fetch('/api/banks', {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(bank),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur création banque');
    }
    return res.json();
  }

  public async updateBank(id: string, bank: Partial<Bank>): Promise<Bank> {
    const res = await fetch(`/api/banks/${id}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(bank),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur mise à jour banque');
    }
    return res.json();
  }

  public async getInvoices(isDemo?: boolean | 'ALL'): Promise<Invoice[]> {
    const params = new URLSearchParams();
    if (isDemo !== undefined && isDemo !== 'ALL') {
      params.set('isDemo', String(isDemo));
    }
    const qs = params.toString();
    const res = await fetch(`/api/invoices${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des factures');
    return res.json();
  }

  public async createInvoice(invoice: Partial<Invoice>): Promise<Invoice> {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(invoice),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création de la facture');
    }
    return res.json();
  }

  public async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice> {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(invoice),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la modification de la facture');
    }
    return res.json();
  }

  public async attachDefinitiveInvoice(
    id: string,
    payload: {
      definitiveInvoiceNumber: string;
      definitiveInvoiceDate?: string;
      document?: any;
    }
  ): Promise<Invoice> {
    const res = await fetch(`/api/invoices/${id}/definitive`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(
        err.error || 'Erreur lors de l’enregistrement de la facture définitive'
      );
    }
    return res.json();
  }

  public async deleteInvoice(id: string): Promise<void> {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression de la facture');
    }
  }

  public async getOrders(filters: FilterParams = {}): Promise<PaymentOrder[]> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.currency && filters.currency !== 'ALL') params.set('currency', filters.currency);
    if (filters.bank && filters.bank !== 'ALL') params.set('bank', filters.bank);
    if (filters.supplier && filters.supplier !== 'ALL') params.set('supplier', filters.supplier);
    if (filters.fiscalYear && filters.fiscalYear !== 'ALL') params.set('fiscalYear', String(filters.fiscalYear));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.searchQuery) params.set('searchQuery', filters.searchQuery);
    if (filters.isDemo !== undefined && filters.isDemo !== 'ALL') params.set('isDemo', String(filters.isDemo));

    const res = await fetch(`/api/orders?${params.toString()}`, {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement des ordres de paiement');
    return res.json();
  }

  public async getOrderById(id: string): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${id}`, {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Ordre introuvable');
    return res.json();
  }

  public async createOrder(
    order: Partial<PaymentOrder> & {
      definitiveInvoiceNumber?: string;
      definitiveInvoiceDate?: string;
    }
  ): Promise<PaymentOrder> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(order),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création de l’ordre');
    }
    return res.json();
  }

  public async updateOrder(id: string, order: Partial<PaymentOrder>): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(order),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la mise à jour');
    }
    return res.json();
  }

  public async updateOrderDeductions(
    orderId: string,
    payload: { deductions: Array<Partial<OrderDeduction>>; grossAmount?: number }
  ): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${orderId}/deductions`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la mise à jour des déductions');
    }
    return res.json();
  }

  public async deleteOrder(id: string): Promise<void> {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression de l’ordre');
    }
  }

  public async changeOrderStatus(
    orderId: string,
    targetStatus: PaymentStatus,
    comment: string,
    depositData?: Partial<BankDeposit>,
    executionData?: Partial<PaymentOrder>
  ): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ targetStatus, comment, depositData, executionData }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur transition de statut');
    }
    return res.json();
  }

  public async recordDeposit(orderId: string, depositData: Partial<BankDeposit>): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${orderId}/deposit`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(depositData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur enregistrement dépôt bancaire');
    }
    return res.json();
  }

  public async recordExecution(orderId: string, executionData: Partial<PaymentOrder>): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${orderId}/execute`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(executionData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur enregistrement exécution du virement');
    }
    return res.json();
  }

  public async addDocument(orderId: string, doc: any): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${orderId}/documents`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(doc),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur enregistrement du document');
    }
    return res.json();
  }

  public async getDashboardStats(filters: FilterParams = {}): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.currency && filters.currency !== 'ALL') params.set('currency', filters.currency);
    if (filters.bank && filters.bank !== 'ALL') params.set('bank', filters.bank);
    if (filters.fiscalYear && filters.fiscalYear !== 'ALL') params.set('fiscalYear', String(filters.fiscalYear));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.isDemo !== undefined && filters.isDemo !== 'ALL') params.set('isDemo', String(filters.isDemo));

    const res = await fetch(`/api/stats?${params.toString()}`, {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement statistiques');
    return res.json();
  }

  public async getConsultations(): Promise<CurrencyConsultation[]> {
    const res = await fetch('/api/consultations', {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement des consultations de change');
    return res.json();
  }

  public async createConsultation(payload: {
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
  }): Promise<CurrencyConsultation> {
    const res = await fetch('/api/consultations', {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création de la consultation');
    }
    return res.json();
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
    }
  ): Promise<CurrencyConsultation> {
    const res = await fetch(`/api/consultations/${consultationId}/quotes`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur enregistrement des cotations');
    }
    return res.json();
  }

  public async updateConsultation(
    consultationId: string,
    payload: Partial<CurrencyConsultation>
  ): Promise<CurrencyConsultation> {
    const res = await fetch(`/api/consultations/${consultationId}`, {
      method: 'PUT',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la modification de la consultation');
    }
    return res.json();
  }

  public async deleteConsultation(consultationId: string): Promise<void> {
    const res = await fetch(`/api/consultations/${consultationId}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la suppression de la consultation');
    }
  }

  public async cancelConsultation(consultationId: string, reason: string): Promise<CurrencyConsultation> {
    const res = await fetch(`/api/consultations/${consultationId}/cancel`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur annulation consultation');
    }
    return res.json();
  }

  public async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs', {
      cache: 'no-store',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement journal d’audit');
    return res.json();
  }

  public async resetDemoData(): Promise<void> {
    const res = await fetch('/api/reset-demo', {
      method: 'POST',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur réinitialisation');
  }

  public async downloadOrderDocument(
    orderId: string,
    doc: { id?: string; name: string; dataBase64?: string; fileUrl?: string }
  ): Promise<void> {
    let href = doc.dataBase64 || doc.fileUrl;
    if (!href) {
      const docKey = encodeURIComponent(doc.id || doc.name);
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/documents/${docKey}`, {
        headers: await this.getHeaders(),
      });
      if (!res.ok) throw new Error('Impossible de télécharger la pièce justificative');
      const full = await res.json();
      href = full?.dataBase64 || full?.fileUrl;
    }
    if (!href) throw new Error('Aucun contenu fichier disponible pour cette pièce');
    const a = document.createElement('a');
    a.href = href;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  public async downloadInvoiceDocument(
    invoiceId: string,
    doc: { id?: string; name: string; dataBase64?: string; fileUrl?: string }
  ): Promise<void> {
    let href = doc.dataBase64 || doc.fileUrl;
    if (!href) {
      const docKey = encodeURIComponent(doc.id || doc.name);
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/documents/${docKey}`, {
        headers: await this.getHeaders(),
      });
      if (!res.ok) throw new Error('Impossible de télécharger la pièce jointe');
      const full = await res.json();
      href = full?.dataBase64 || full?.fileUrl;
    }
    if (!href) throw new Error('Aucun contenu fichier disponible pour cette pièce');
    const a = document.createElement('a');
    a.href = href;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  public async exportCsv(): Promise<void> {
    const res = await fetch('/api/export-csv', {
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors de l’export Excel / CSV');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MTK_Ordres_Paiement_International.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export const api = new ApiService();
