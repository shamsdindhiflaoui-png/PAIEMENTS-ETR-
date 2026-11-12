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
} from './types/payment';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<NavItem | 'order_detail'>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Core Data State
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(api.getCurrentUser());
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

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

  // Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Initial load
  const loadAllData = useCallback(async () => {
    try {
      const activeFilters: FilterParams = {
        ...filters,
        isDemo: showDemoData ? 'ALL' : false,
      };

      const [ordersRes, statsRes, banksRes, suppliersRes, usersRes, logsRes] = await Promise.all([
        api.getOrders(activeFilters),
        api.getDashboardStats(activeFilters),
        api.getBanks(),
        api.getSuppliers(),
        api.getUsers(),
        api.getAuditLogs(),
      ]);

      setOrders(ordersRes);
      setStats(statsRes);
      setBanks(banksRes);
      setSuppliers(suppliersRes);
      setUsers(usersRes);
      setAuditLogs(logsRes);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      showToast('error', err.message || 'Erreur lors du chargement des données');
    }
  }, [filters, showDemoData]);

  useEffect(() => {
    api.initUser();
    setCurrentUser(api.getCurrentUser());
    loadAllData();
  }, [loadAllData]);

  // User Switcher
  const handleUserChange = (user: User) => {
    api.setCurrentUser(user);
    setCurrentUser(user);
    showToast('info', `Connecté en tant que ${user.name} (${user.role})`);
  };

  // Create Order
  const handleCreateOrder = async (orderData: Partial<PaymentOrder>) => {
    try {
      const created = await api.createOrder(orderData);
      showToast('success', `Ordre de paiement ${created.orderNumber} créé avec succès`);
      await loadAllData();
      setSelectedOrderId(created.id);
      setActiveView('order_detail');
    } catch (err: any) {
      showToast('error', err.message || 'Erreur création');
      throw err;
    }
  };

  // Status Change
  const handleStatusChange = async (targetStatus: PaymentStatus, comment: string) => {
    if (!selectedOrderId) return;
    try {
      const updated = await api.changeOrderStatus(selectedOrderId, targetStatus, comment);
      showToast('success', `Statut mis à jour : ${targetStatus}`);
      await loadAllData();
    } catch (err: any) {
      showToast('error', err.message || 'Erreur transition de statut');
      throw err;
    }
  };

  // Review Decision from Pending Review View
  const handleReviewDecision = async (
    order: PaymentOrder,
    decision: 'VALIDE_CG' | 'RETOURNE_CORRECTION' | 'REJETE',
    comment: string
  ) => {
    try {
      await api.changeOrderStatus(order.id, decision, comment);
      const label =
        decision === 'VALIDE_CG'
          ? 'validé'
          : decision === 'RETOURNE_CORRECTION'
          ? 'retourné pour correction'
          : 'rejeté';
      showToast('success', `Ordre ${order.orderNumber} ${label} par le Contrôle de Gestion`);
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

  // Current selected order
  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Pending count for sidebar badge (Contrôle de Gestion + Dépôts)
  const pendingCount = orders.filter(o => o.status === 'TRANSMIS_CG').length;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView === 'order_detail' ? 'orders_list' : activeView}
        onNavigate={view => {
          setSelectedOrderId(null);
          setActiveView(view);
        }}
        pendingCount={pendingCount}
        currentUser={currentUser}
        onUserChange={handleUserChange}
        users={users}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          activeView={activeView === 'order_detail' ? 'orders_list' : activeView}
          onNavigate={view => {
            setSelectedOrderId(null);
            setActiveView(view);
          }}
          currentUser={currentUser}
          showDemoData={showDemoData}
          onToggleDemoData={val => setShowDemoData(val)}
          onResetDemo={handleResetDemo}
          selectedOrderNumber={activeView === 'order_detail' && selectedOrder ? selectedOrder.orderNumber : undefined}
        />

        {/* Viewport Scroll Container */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* 1. Dashboard View */}
          {activeView === 'dashboard' && (
            <DashboardView
              stats={stats}
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
              onNavigateToOrders={statusFilter => {
                if (statusFilter) {
                  setFilters(prev => ({ ...prev, status: statusFilter as any }));
                }
                setActiveView('orders_list');
              }}
            />
          )}

          {/* 2. New Order View */}
          {activeView === 'new_order' && (
            <NewOrderView
              suppliers={suppliers}
              banks={banks}
              currentUser={currentUser}
              existingCount={orders.length}
              onSubmit={handleCreateOrder}
              onCancel={() => setActiveView('orders_list')}
            />
          )}

          {/* 3. Orders List View */}
          {activeView === 'orders_list' && (
            <OrderListView
              orders={orders}
              banks={banks}
              suppliers={suppliers}
              filters={filters}
              onFilterChange={setFilters}
              onSelectOrder={id => {
                setSelectedOrderId(id);
                setActiveView('order_detail');
              }}
              onPrintOrder={order => setPrintModalOrder(order)}
              onNewOrder={() => setActiveView('new_order')}
            />
          )}

          {/* 4. Order Detail View */}
          {activeView === 'order_detail' && selectedOrder && (
            <OrderDetailView
              order={selectedOrder}
              currentUser={currentUser}
              onBack={() => {
                setSelectedOrderId(null);
                setActiveView('orders_list');
              }}
              onStatusChange={handleStatusChange}
              onOpenDepositModal={() => setDepositModalOrder(selectedOrder)}
              onOpenExecutionModal={() => setExecutionModalOrder(selectedOrder)}
              onOpenReviewModal={() => {
                setActiveView('pending_review');
              }}
              onPrintOrder={() => setPrintModalOrder(selectedOrder)}
              onAddDocument={handleAddDocument}
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
          currentUser={currentUser}
          onClose={() => setExecutionModalOrder(null)}
          onSubmit={handleRecordExecution}
        />
      )}

      {/* Official Print Modal */}
      {printModalOrder && (
        <PrintOfficialOrderModal
          order={printModalOrder}
          onClose={() => setPrintModalOrder(null)}
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
