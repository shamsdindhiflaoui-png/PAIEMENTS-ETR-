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
} from '../types/payment';

class ApiService {
  private currentUser: User = {
    id: 'usr_agent1',
    name: 'Monia Ben Salem',
    email: 'm.bensalem@mtk.tn',
    role: 'AGENT_FINANCIER',
    department: 'Service Trésorerie & Règlements Extérieurs',
  };

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

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUser.id,
      'x-user-role': this.currentUser.role,
      'x-user-name': encodeURIComponent(this.currentUser.name),
    };
  }

  public async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users', { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs');
    return res.json();
  }

  public async getSuppliers(): Promise<Supplier[]> {
    const res = await fetch('/api/suppliers', { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des fournisseurs');
    return res.json();
  }

  public async createSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(supplier),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur création fournisseur');
    }
    return res.json();
  }

  public async getBanks(): Promise<Bank[]> {
    const res = await fetch('/api/banks', { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des banques');
    return res.json();
  }

  public async createBank(bank: Omit<Bank, 'id'>): Promise<Bank> {
    const res = await fetch('/api/banks', {
      method: 'POST',
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
      body: JSON.stringify(bank),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur mise à jour banque');
    }
    return res.json();
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
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement des ordres de paiement');
    return res.json();
  }

  public async getOrderById(id: string): Promise<PaymentOrder> {
    const res = await fetch(`/api/orders/${id}`, {
      cache: 'no-store',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Ordre introuvable');
    return res.json();
  }

  public async createOrder(order: Partial<PaymentOrder>): Promise<PaymentOrder> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
      body: JSON.stringify(order),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la mise à jour');
    }
    return res.json();
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement statistiques');
    return res.json();
  }

  public async getConsultations(): Promise<CurrencyConsultation[]> {
    const res = await fetch('/api/consultations', {
      cache: 'no-store',
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur enregistrement des cotations');
    }
    return res.json();
  }

  public async cancelConsultation(consultationId: string, reason: string): Promise<CurrencyConsultation> {
    const res = await fetch(`/api/consultations/${consultationId}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Erreur chargement journal d’audit');
    return res.json();
  }

  public async resetDemoData(): Promise<void> {
    const res = await fetch('/api/reset-demo', { method: 'POST', headers: this.getHeaders() });
    if (!res.ok) throw new Error('Erreur réinitialisation');
  }
}

export const api = new ApiService();
