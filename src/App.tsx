import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavItem } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { NewOrderView } from './components/NewOrderView';
import { OrderListView } from './components/OrderListView';
import { OrderDetailView } from './components/OrderDetailView';
import { PendingReviewView } from './components/PendingReviewView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsView } from './components/SettingsView';
import { BankDepositModal } from './components/BankDepositModal';
import { ExecutionModal } from './components/ExecutionModal';
import { PrintOfficialOrderModal } from './components/PrintOfficialOrderModal';
import { ConsultationsView } from './components/ConsultationsView';
import { ConsultationDetailView } from './components/ConsultationDetailView';
import { ConsultationPdfModal } from './components/ConsultationPdfModal';
import { PurchaseConfirmationPdfModal } from './components/PurchaseConfirmationPdfModal';
import { InvoicesView } from './components/InvoicesView';
import { api } from './services/api';
import {
  PaymentOrder,
  Bank,
  Supplier,
  User,
  DashboardStats,
  FilterParams,
  PaymentStatus,
  BankDeposit,
  AuditLog,
  CurrencyConsultation,
  ExchangeQuote,
  Invoice,
  OrderDeduction,
} from './types/payment';
import { CheckCircle2, AlertCircle, Info, X, LogIn, ShieldCheck } from 'lucide-react';
import { STATUS_META } from './utils/workflowRules';
import { doesOrderBelongToInvoice, getAvailableInvoicesForOrder } from './utils/invoiceUtils';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { firebaseUser, authLoading, authError, signInWithGoogle, signOutUser } = useAuth();
  const [activeView, setActiveView] = useState<NavItem | 'order_detail' | 'consultation_detail'>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [preselectedInvoiceId, setPreselectedInvoiceId] = useState<string | null>(null);

  // Core Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(api.getCurrentUser());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [consultations, setConsultations] = useState<CurrencyConsultation[]>([]);

  // Filtering
  const [showDemoData, setShowDemoData] = useState<boolean>(true);
  const [filters, setFilters] = useState<FilterParams>({
    status: 'ALL',
    currency: 'ALL',
    bank: 'ALL',
    supplier: 'ALL',
    fiscalYear: 'ALL',
    isDemo: 'ALL',
  });

  // Modals
  const [depositModalOrder, setDepositModalOrder] = useState<PaymentOrder | null>(null);
  const [executionModalOrder, setExecutionModalOrder] = useState<PaymentOrder | null>(null);
  const [printModalOrder, setPrintModalOrder] = useState<PaymentOrder | null>(null);
  const [pdfModalConsultation, setPdfModalConsultation] = useState<CurrencyConsultation | null>(null);
  const [confirmationModalState, setConfirmationModalState] = useState<{
    consultation: CurrencyConsultation;
    initialTab?: 'recap' | number;
  } | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Initial load (only after Firebase Auth is ready & authenticated)
  const loadAllData = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const activeFilters: FilterParams = {
        ...filters,
        isDemo: showDemoData ? 'ALL' : false,
      };

      const [invoicesRes, ordersRes, statsRes, banksRes, suppliersRes, usersRes, logsRes, consultationsRes] = await Promise.all([
        api.getInvoices(showDemoData ? 'ALL' : false),
        api.getOrders(activeFilters),
        api.getDashboardStats(activeFilters),
        api.getBanks(),
        api.getSuppliers(),
        api.getUsers(),
        api.getAuditLogs(),
        api.getConsultations(),
      ]);

      setInvoices(invoicesRes);
      setOrders(ordersRes);
      setStats(statsRes);
      setBanks(banksRes);
      setSuppliers(suppliersRes);
      setUsers(usersRes);
      setCurrentUser(prev => {
        const matched = usersRes.find(u => u.id === prev.id);
        if (matched && matched.userCode && matched.userCode !== prev.userCode) {
          api.setCurrentUser(matched);
          return matched;
        }
        return prev;
      });
      setAuditLogs(logsRes);
      setConsultations(
        showDemoData ? consultationsRes : consultationsRes.filter(c => !c.isDemo)
      );
    } catch (err: any) {
      console.error('Error fetching data:', err);
      showToast('error', err.message || 'Erreur lors du chargement des données');
    }
  }, [filters, showDemoData, firebaseUser]);

  useEffect(() => {
    api.initUser();
    setCurrentUser(api.getCurrentUser());
    if (firebaseUser) {
      loadAllData();
    }
  }, [loadAllData, firebaseUser]);

  // User Switcher
  const handleUserChange = (user: User) => {
    api.setCurrentUser(user);
    setCurrentUser(user);
    showToast('info', `Connecté en tant que ${user.name} (${user.role})`);
  };

  // Module 00 Factures Handlers
  const handleCreateInvoice = async (payload: Partial<Invoice>) => {
    try {
      const created = await api.createInvoice(payload);
      showToast('success', `Facture ${created.invoiceNumber} enregistrée avec succès`);
      await loadAllData();
      return created;
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la création de la facture');
      throw err;
    }
  };

  const handleUpdateInvoice = async (id: string, payload: Partial<Invoice>) => {
    try {
      const updated = await api.updateInvoice(id, payload);
      showToast('success', `Facture ${updated.invoiceNumber} modifiée avec succès`);
      await loadAllData();
      return updated;
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la modification de la facture');
      throw err;
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      await api.deleteInvoice(id);
      showToast('info', 'Facture supprimée avec succès');
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la suppression de la facture');
      throw err;
    }
  };

  const handleAttachDefinitiveInvoice = async (
    id: string,
    payload: {
      definitiveInvoiceNumber: string;
      definitiveInvoiceDate?: string;
      document?: any;
    }
  ) => {
    try {
      const updated = await api.attachDefinitiveInvoice(id, payload);
      showToast(
        'success',
        `Facture définitive ${updated.definitiveInvoiceNumber || updated.invoiceNumber} rattachée au dossier`
      );
      await loadAllData();
      return updated;
    } catch (err: any) {
      showToast(
        'error',
        err.message || 'Erreur lors de l’enregistrement de la facture définitive'
      );
      throw err;
    }
  };

  const handleCreateOrderFromInvoice = (invoiceId: string) => {
    setPreselectedInvoiceId(invoiceId);
    setSelectedOrderId(null);
    setSelectedConsultationId(null);
    setActiveView('new_order');
  };

  // Create Order
  const handleCreateOrder = async (
    orderData: Partial<PaymentOrder> & {
      definitiveInvoiceNumber?: string;
      definitiveInvoiceDate?: string;
    }
  ) => {
    try {
      const created = await api.createOrder(orderData);
      showToast('success', `Ordre de paiement ${created.orderNumber} créé avec succès`);
      setPreselectedInvoiceId(null);
      await loadAllData();
      setSelectedOrderId(created.id);
      setActiveView('order_detail');
    } catch (err: any) {
      showToast('error', err.message || 'Erreur création');
      throw err;
    }
  };

  // Admin Update & Delete Order
  const handleUpdateOrder = async (id: string, payload: Partial<PaymentOrder>) => {
    try {
      const updated = await api.updateOrder(id, payload);
      showToast('success', `Ordre de paiement ${updated.orderNumber} modifié avec succès`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la modification de l’ordre');
      throw err;
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await api.deleteOrder(id);
      if (selectedOrderId === id) {
        setSelectedOrderId(null);
        setActiveView('orders_list');
      }
      showToast('info', 'Ordre de paiement supprimé avec succès');
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la suppression de l’ordre');
      throw err;
    }
  };

  // Status Change
  const handleStatusChange = async (targetStatus: PaymentStatus, comment: string) => {
    if (!selectedOrderId) return;
    try {
      await api.changeOrderStatus(selectedOrderId, targetStatus, comment);
      showToast('success', `Statut mis à jour : ${STATUS_META[targetStatus]?.label || targetStatus}`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur transition de statut');
      throw err;
    }
  };

  // Review Decision from Pending Review View
  const handleReviewDecision = async (
    order: PaymentOrder,
    decision: 'SIGNE' | 'SAISI' | 'ANNULE',
    comment: string
  ) => {
    try {
      await api.changeOrderStatus(order.id, decision, comment);
      const label =
        decision === 'SIGNE'
          ? 'signé et prêt pour dépôt bancaire'
          : decision === 'SAISI'
          ? 'retourné en Saisi (Brouillon)'
          : 'annulé';
      showToast('success', `Ordre ${order.orderNumber} ${label}`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur décision');
      throw err;
    }
  };

  // Record Deposit
  const handleRecordDeposit = async (depositData: Partial<BankDeposit>) => {
    if (!depositModalOrder) return;
    try {
      const updated = await api.recordDeposit(depositModalOrder.id, depositData);
      showToast('success', `Bordereau de dépôt ${depositData.slipNumber} enregistré avec succès`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur dépôt');
      throw err;
    }
  };

  // Record Execution
  const handleRecordExecution = async (executionData: Partial<PaymentOrder>) => {
    if (!executionModalOrder) return;
    try {
      const updated = await api.recordExecution(executionModalOrder.id, executionData);
      showToast('success', `Transfert ${updated.orderNumber} exécuté avec succès (Réf SWIFT: ${executionData.swiftReference})`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur exécution');
      throw err;
    }
  };

  // Add Document
  const handleAddDocument = async (doc: any) => {
    if (!selectedOrderId) return;
    try {
      await api.addDocument(selectedOrderId, doc);
      showToast('success', `Document ${doc.name} joint avec succès`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur ajout pièce');
    }
  };

  // Update Deductions directly on an existing single order
  const handleUpdateOrderDeductions = async (payload: {
    deductions: OrderDeduction[];
    grossAmount?: number;
  }) => {
    if (!selectedOrderId) return;
    try {
      const updated = await api.updateOrderDeductions(selectedOrderId, payload);
      showToast(
        'success',
        `Déductions mises à jour sur l'ordre ${updated.orderNumber} — Net à transférer : ${updated.amount.toLocaleString(
          'fr-FR',
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )} ${updated.currency}`
      );
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la mise à jour des déductions');
      throw err;
    }
  };

  // Add Supplier
  const handleAddSupplier = async (supplier: Omit<Supplier, 'id'>) => {
    try {
      await api.createSupplier(supplier);
      showToast('success', `Fournisseur ${supplier.name} ajouté au référentiel`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur ajout fournisseur');
    }
  };

  // Add Bank
  const handleAddBank = async (bank: Omit<Bank, 'id'>) => {
    try {
      await api.createBank(bank);
      showToast('success', `Banque ${bank.name} ajoutée au référentiel`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur ajout banque');
      throw err;
    }
  };

  // Update Bank
  const handleUpdateBank = async (id: string, bank: Partial<Bank>) => {
    try {
      const updated = await api.updateBank(id, bank);
      showToast('success', `Banque ${updated.name} mise à jour avec succès`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur mise à jour banque');
      throw err;
    }
  };

  // Reset Demo Data
  const handleResetDemo = async () => {
    try {
      await api.resetDemoData();
      showToast('info', 'Données de démonstration réinitialisées');
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur réinitialisation');
    }
  };

  // Module 02 Consultations Handlers
  const handleCreateConsultation = async (payload: {
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
  }) => {
    try {
      const created = await api.createConsultation(payload);
      showToast('success', `Consultation ${created.consultationNumber} créée — document PDF prêt`);
      await loadAllData();
      setSelectedConsultationId(created.id);
      setActiveView('consultation_detail');
      setPdfModalConsultation(created);
      return created;
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la création de la consultation');
      throw err;
    }
  };

  const handleRecordConsultationQuotes = async (
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
  ) => {
    try {
      const updated = await api.recordConsultationQuotes(consultationId, payload);
      showToast(
        'success',
        payload.close
          ? `Consultation ${updated.consultationNumber} clôturée — confirmation(s) générée(s) et liste des ordres actualisée`
          : `Cotations enregistrées pour ${updated.consultationNumber}`
      );
      await loadAllData();
      if (payload.close && updated.status === 'CLOTUREE') {
        setConfirmationModalState({ consultation: updated, initialTab: 0 });
      }
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de l’enregistrement des cotations');
      throw err;
    }
  };

  const handleCancelConsultation = async (consultationId: string, reason: string) => {
    try {
      const updated = await api.cancelConsultation(consultationId, reason);
      showToast('info', `Consultation ${updated.consultationNumber} annulée`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de l’annulation');
      throw err;
    }
  };

  const handleUpdateConsultation = async (
    consultationId: string,
    payload: Partial<CurrencyConsultation>
  ) => {
    try {
      const updated = await api.updateConsultation(consultationId, payload);
      showToast('success', `Consultation ${updated.consultationNumber} modifiée avec succès`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la modification de la consultation');
      throw err;
    }
  };

  const handleDeleteConsultation = async (consultationId: string) => {
    try {
      await api.deleteConsultation(consultationId);
      if (selectedConsultationId === consultationId) {
        setSelectedConsultationId(null);
        setActiveView('consultations');
      }
      showToast('info', 'Consultation supprimée avec succès');
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de la suppression de la consultation');
      throw err;
    }
  };

  // Current selected order / consultation
  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const selectedConsultation = consultations.find(c => c.id === selectedConsultationId);

  // Pending count for sidebar badge (Transmis pour signature + Signés à déposer)
  const pendingCount = orders.filter(
    o => o.status === 'TRANSMIS_SIGNATURE' || o.status === 'SIGNE'
  ).length;

  // Orders awaiting currency purchase consultation that are not yet attached to an active consultation
  const activeConsultedOrderIds = new Set(
    consultations
      .filter(c => c.status !== 'ANNULEE')
      .flatMap(c => c.orderIds)
  );
  const consultationPendingCount = orders.filter(
    o => o.status === 'EN_ATTENTE_ACHAT_DEVISE' && !activeConsultedOrderIds.has(o.id)
  ).length;

  const unpaidInvoicesCount = getAvailableInvoicesForOrder(invoices, orders).length;

  const sidebarActiveView: NavItem =
    activeView === 'order_detail'
      ? 'orders_list'
      : activeView === 'consultation_detail'
      ? 'consultations'
      : activeView;

  const hasActivePrintModal = Boolean(
    printModalOrder || pdfModalConsultation || confirmationModalState
  );

  const handleExportCsv = async () => {
    try {
      await api.exportCsv();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur lors de l’export Excel');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-3 max-w-sm w-full">
          <img
            src="/assets/aistudio/Logo_MTK_737e87ca.png"
            alt="Logo Manufacture des Tabacs de Kairouan (MTK)"
            className="w-12 h-12 object-contain"
          />
          <p className="text-xs font-semibold text-slate-700">
            Initialisation de la session sécurisée MTK...
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm max-w-md w-full space-y-6">
          <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0">
              <img
                src="/assets/aistudio/Logo_MTK_737e87ca.png"
                alt="Logo Manufacture des Tabacs de Kairouan (MTK)"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                MTK International Payments
              </h1>
              <p className="text-xs text-slate-500">
                Manufacture des Tabacs de Kairouan · Direction Financière & Comptable
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Accès DFC Authentifié
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Connectez-vous avec votre compte Google professionnel pour accéder aux factures fournisseurs, ordres de paiement internationaux et consultations de change.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Se connecter avec Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-900 font-sans print:block print:h-auto print:bg-white print:overflow-visible">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={sidebarActiveView}
        onNavigate={view => {
          setSelectedOrderId(null);
          setSelectedConsultationId(null);
          if (view !== 'new_order') setPreselectedInvoiceId(null);
          setActiveView(view);
        }}
        pendingCount={pendingCount}
        unpaidInvoicesCount={unpaidInvoicesCount}
        consultationPendingCount={consultationPendingCount}
        currentUser={currentUser}
        onUserChange={handleUserChange}
        users={users}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 overflow-hidden ${
          hasActivePrintModal
            ? 'print:hidden'
            : 'print:block print:overflow-visible'
        }`}
      >
        {/* Top Header */}
        <Header
          activeView={sidebarActiveView}
          onNavigate={view => {
            setSelectedOrderId(null);
            setSelectedConsultationId(null);
            if (view !== 'new_order') setPreselectedInvoiceId(null);
            setActiveView(view);
          }}
          currentUser={currentUser}
          showDemoData={showDemoData}
          onToggleDemoData={val => setShowDemoData(val)}
          onResetDemo={handleResetDemo}
          onExportCsv={handleExportCsv}
          onSignOut={signOutUser}
          selectedOrderNumber={
            activeView === 'order_detail' && selectedOrder
              ? selectedOrder.orderNumber
              : activeView === 'consultation_detail' && selectedConsultation
              ? selectedConsultation.consultationNumber
              : undefined
          }
        />

        {/* Viewport Scroll Container */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* 1. Dashboard View */}
          {activeView === 'dashboard' && (
            <DashboardView
              stats={stats}
              invoices={invoices}
              orders={orders}
              consultations={consultations}
              filters={filters}
              onFilterChange={setFilters}
              onResetFilters={() =>
                setFilters({
                  status: 'ALL',
                  currency: 'ALL',
                  bank: 'ALL',
                  supplier: 'ALL',
                  fiscalYear: 'ALL',
                  isDemo: 'ALL',
                })
              }
              banks={banks}
              onNavigateToInvoices={() => {
                setSelectedOrderId(null);
                setSelectedConsultationId(null);
                setActiveView('invoices');
              }}
              onNavigateToOrders={statusFilter => {
                if (statusFilter) {
                  setFilters(prev => ({ ...prev, status: statusFilter as any }));
                }
                setActiveView('orders_list');
              }}
              onNavigateToConsultations={() => {
                setSelectedOrderId(null);
                setSelectedConsultationId(null);
                setActiveView('consultations');
              }}
              onSelectConsultation={id => {
                setSelectedOrderId(null);
                setSelectedConsultationId(id);
                setActiveView('consultation_detail');
              }}
            />
          )}

          {/* 1b. Module 00 - Factures View */}
          {activeView === 'invoices' && (
            <InvoicesView
              invoices={invoices}
              orders={orders}
              suppliers={suppliers}
              currentUser={currentUser}
              onCreateInvoice={handleCreateInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onAttachDefinitiveInvoice={handleAttachDefinitiveInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onCreateOrderFromInvoice={handleCreateOrderFromInvoice}
              onSelectOrder={id => {
                setSelectedOrderId(id);
                setActiveView('order_detail');
              }}
            />
          )}

          {/* 2. New Order View */}
          {activeView === 'new_order' && (
            <NewOrderView
              suppliers={suppliers}
              banks={banks}
              invoices={invoices}
              orders={orders}
              initialInvoiceId={preselectedInvoiceId}
              currentUser={currentUser}
              existingCount={orders.length}
              onSubmit={handleCreateOrder}
              onCancel={() => {
                setPreselectedInvoiceId(null);
                setActiveView('orders_list');
              }}
            />
          )}

          {/* 3. Orders List View */}
          {activeView === 'orders_list' && (
            <OrderListView
              orders={orders}
              banks={banks}
              suppliers={suppliers}
              currentUser={currentUser}
              filters={filters}
              onFilterChange={setFilters}
              onSelectOrder={id => {
                setSelectedOrderId(id);
                setActiveView('order_detail');
              }}
              onPrintOrder={order => setPrintModalOrder(order)}
              onNewOrder={() => setActiveView('new_order')}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              onRefresh={loadAllData}
            />
          )}

          {/* 4. Order Detail View */}
          {activeView === 'order_detail' && selectedOrder && (
            <OrderDetailView
              order={selectedOrder}
              allOrders={orders}
              banks={banks}
              linkedInvoice={invoices.find(
                inv =>
                  (selectedOrder.invoiceId && inv.id === selectedOrder.invoiceId) ||
                  doesOrderBelongToInvoice(selectedOrder, inv)
              )}
              consultations={consultations}
              currentUser={currentUser}
              onBack={() => {
                setSelectedOrderId(null);
                setActiveView('orders_list');
              }}
              onStatusChange={handleStatusChange}
              onOpenDepositModal={() => setDepositModalOrder(selectedOrder)}
              onOpenExecutionModal={() => setExecutionModalOrder(selectedOrder)}
              onOpenConsultations={consultationId => {
                setSelectedOrderId(null);
                if (consultationId) {
                  setSelectedConsultationId(consultationId);
                  setActiveView('consultation_detail');
                } else {
                  setActiveView('consultations');
                }
              }}
              onPrintOrder={() => setPrintModalOrder(selectedOrder)}
              onAddDocument={handleAddDocument}
              onUpdateDeductions={handleUpdateOrderDeductions}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
            />
          )}

          {/* 5. Pending Review Inbox */}
          {activeView === 'pending_review' && (
            <PendingReviewView
              orders={orders}
              currentUser={currentUser}
              onSelectOrder={id => {
                setSelectedOrderId(id);
                setActiveView('order_detail');
              }}
              onReviewDecision={handleReviewDecision}
              onOpenDeposit={order => setDepositModalOrder(order)}
            />
          )}

          {/* 5b. Module 02 - Consultations pour achat de devises */}
          {activeView === 'consultations' && (
            <ConsultationsView
              orders={orders}
              consultations={consultations}
              banks={banks}
              currentUser={currentUser}
              onCreateConsultation={handleCreateConsultation}
              onRecordQuotes={handleRecordConsultationQuotes}
              onCancelConsultation={handleCancelConsultation}
              onUpdateConsultation={handleUpdateConsultation}
              onDeleteConsultation={handleDeleteConsultation}
              onOpenPdfModal={consultation => setPdfModalConsultation(consultation)}
              onOpenConfirmationModal={(consultation, initialTab) =>
                setConfirmationModalState({ consultation, initialTab })
              }
              onSelectOrder={id => {
                setSelectedOrderId(id);
                setActiveView('order_detail');
              }}
              onSelectConsultation={id => {
                setSelectedConsultationId(id);
                setActiveView('consultation_detail');
              }}
            />
          )}

          {/* 5c. Module 02 - Détail Consultation & Classement Moins-Disant / Plus-Disant */}
          {activeView === 'consultation_detail' && selectedConsultation && (
            <ConsultationDetailView
              consultation={selectedConsultation}
              orders={orders}
              consultations={consultations}
              banks={banks}
              currentUser={currentUser}
              onBack={() => {
                setSelectedConsultationId(null);
                setActiveView('consultations');
              }}
              onOpenPdfModal={consultation => setPdfModalConsultation(consultation)}
              onOpenConfirmationModal={(consultation, initialTab) =>
                setConfirmationModalState({ consultation, initialTab })
              }
              onSelectOrder={id => {
                setSelectedOrderId(id);
                setActiveView('order_detail');
              }}
              onNavigateToOrders={() => {
                if (filters.status === 'EN_ATTENTE_ACHAT_DEVISE') {
                  setFilters(prev => ({ ...prev, status: 'ALL' }));
                }
                setSelectedConsultationId(null);
                setActiveView('orders_list');
              }}
              onRecordQuotes={handleRecordConsultationQuotes}
              onCancelConsultation={handleCancelConsultation}
              onUpdateConsultation={handleUpdateConsultation}
              onDeleteConsultation={handleDeleteConsultation}
            />
          )}

          {/* 6. Audit Logs View */}
          {activeView === 'audit_logs' && <AuditLogsView logs={auditLogs} />}

          {/* 7. Settings & Referentials View */}
          {activeView === 'settings' && (
            <SettingsView
              suppliers={suppliers}
              banks={banks}
              users={users}
              onAddSupplier={handleAddSupplier}
              onAddBank={handleAddBank}
              onUpdateBank={handleUpdateBank}
              onResetDemo={handleResetDemo}
            />
          )}
        </main>
      </div>

      {/* MODALS */}

      {/* Bank Deposit Modal */}
      {depositModalOrder && (
        <BankDepositModal
          order={depositModalOrder}
          banks={banks}
          currentUser={currentUser}
          onClose={() => setDepositModalOrder(null)}
          onSubmit={handleRecordDeposit}
        />
      )}

      {/* Transfer Execution Modal */}
      {executionModalOrder && (
        <ExecutionModal
          order={executionModalOrder}
          consultations={consultations}
          currentUser={currentUser}
          onClose={() => setExecutionModalOrder(null)}
          onSubmit={handleRecordExecution}
        />
      )}

      {/* Official Print Modal (Demi-feuille A4) */}
      {printModalOrder && (
        <PrintOfficialOrderModal
          order={printModalOrder}
          linkedInvoice={invoices.find(
            inv =>
              (printModalOrder.invoiceId && inv.id === printModalOrder.invoiceId) ||
              doesOrderBelongToInvoice(printModalOrder, inv)
          )}
          allOrders={orders}
          onClose={() => setPrintModalOrder(null)}
        />
      )}

      {/* Module 02 Consultation PDF Preview & Download Modal */}
      {pdfModalConsultation && (
        <ConsultationPdfModal
          consultation={pdfModalConsultation}
          onClose={() => setPdfModalConsultation(null)}
        />
      )}

      {/* Module 02 Purchase Confirmation(s) + Récap PDF Modal */}
      {confirmationModalState && (
        <PurchaseConfirmationPdfModal
          consultation={confirmationModalState.consultation}
          orders={orders}
          banks={banks}
          initialTab={confirmationModalState.initialTab}
          onClose={() => setConfirmationModalState(null)}
        />
      )}

      {/* Toast Floating Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : toast.type === 'error'
              ? 'bg-rose-950 text-rose-100 border-rose-800'
              : 'bg-blue-950 text-blue-100 border-blue-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 hover:opacity-70 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
