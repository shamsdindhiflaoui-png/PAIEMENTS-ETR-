import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Printer,
  Download,
  Calendar,
  Building,
  CreditCard,
  RefreshCw,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { PaymentOrder, PaymentStatus, Bank, Supplier, FilterParams } from '../types/payment';
import { STATUS_META, formatForeignCurrency } from '../utils/workflowRules';

interface OrderListViewProps {
  orders: PaymentOrder[];
  banks: Bank[];
  suppliers: Supplier[];
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  onSelectOrder: (orderId: string) => void;
  onPrintOrder: (order: PaymentOrder) => void;
  onNewOrder: () => void;
}

type SortField = 'createdAt' | 'orderNumber' | 'beneficiaryName' | 'amount' | 'status';
type SortOrder = 'asc' | 'desc';

export const OrderListView: React.FC<OrderListViewProps> = ({
  orders,
  banks,
  suppliers,
  filters,
  onFilterChange,
  onSelectOrder,
  onPrintOrder,
  onNewOrder,
}) => {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Sorting
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'orderNumber') {
        comparison = a.orderNumber.localeCompare(b.orderNumber);
      } else if (sortField === 'beneficiaryName') {
        comparison = a.beneficiaryName.localeCompare(b.beneficiaryName);
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [orders, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Main Filter Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Recherche par N° ordre, fournisseur, objet, n° facture ou domiciliation..."
              value={filters.searchQuery || ''}
              onChange={e => {
                onFilterChange({ ...filters, searchQuery: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
            />
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={filters.status || 'ALL'}
              onChange={e => {
                onFilterChange({ ...filters, status: e.target.value as any });
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none text-slate-800 font-medium"
            >
              <option value="ALL">Tous les statuts ({orders.length})</option>
              <option value="TRANSMIS_CG">Transmis au CG</option>
              <option value="VALIDE_CG">Validés CG</option>
              <option value="DEPOSE_BANQUE">Déposés Banque</option>
              <option value="ATTENTE_NEGOCIATION">Attente Cotation</option>
              <option value="EXECUTE">Exécutés (SWIFT)</option>
              <option value="RETOURNE_CORRECTION">Retourné correction</option>
              <option value="REJETE">Rejetés</option>
              <option value="SAISI">Saisis</option>
              <option value="BROUILLON">Brouillons</option>
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                showAdvancedFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtres avancés</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Bar */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Devise</label>
              <select
                value={filters.currency || 'ALL'}
                onChange={e => onFilterChange({ ...filters, currency: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Toutes devises</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="USD">Dollar US (USD)</option>
                <option value="GBP">Livre Sterling (GBP)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Banque tunisienne</label>
              <select
                value={filters.bank || 'ALL'}
                onChange={e => onFilterChange({ ...filters, bank: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Toutes les banques</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Exercice budgétaire</label>
              <select
                value={filters.fiscalYear || 'ALL'}
                onChange={e => onFilterChange({ ...filters, fiscalYear: e.target.value as any })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Tous exercices</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() =>
                  onFilterChange({
                    status: 'ALL',
                    currency: 'ALL',
                    bank: 'ALL',
                    supplier: 'ALL',
                    fiscalYear: 'ALL',
                    searchQuery: '',
                  })
                }
                className="w-full text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-1.5 rounded-lg transition-colors font-medium text-center"
              >
                Effacer les filtres
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Orders Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <tr>
                <th
                  onClick={() => handleSort('orderNumber')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>N° d'Ordre</span>
                    {renderSortIcon('orderNumber')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('createdAt')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date création</span>
                    {renderSortIcon('createdAt')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('beneficiaryName')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Bénéficiaire / Fournisseur</span>
                    {renderSortIcon('beneficiaryName')}
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Pays</th>
                <th
                  onClick={() => handleSort('amount')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors text-right whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Montant Devise</span>
                    {renderSortIcon('amount')}
                  </div>
                </th>
                <th className="py-3 px-4 whitespace-nowrap">Banque MTK</th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Statut du circuit</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.map(order => {
                const meta = STATUS_META[order.status] || STATUS_META.BROUILLON;
                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder(order.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Order Number */}
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{order.orderNumber}</span>
                        {order.isDemo && (
                          <span
                            className="text-[9px] font-sans font-semibold bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200"
                            title="Donnée de démonstration"
                          >
                            DÉMO
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-mono">
                      {order.createdAt.split('T')[0]}
                    </td>

                    {/* Beneficiary */}
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="font-semibold text-slate-900 truncate">
                        {order.beneficiaryName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {order.purpose}
                      </div>
                    </td>

                    {/* Country */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                      {order.beneficiaryCountry || '—'}
                    </td>

                    {/* Amount & Currency */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      <div>{formatForeignCurrency(order.amount, order.currency)}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Facture {order.invoiceNumber || '—'}
                      </div>
                    </td>

                    {/* Local Bank & Transfer Type */}
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      <div className="truncate max-w-[160px] font-medium">{order.bankName}</div>
                      <div className="text-[10px] text-blue-800 font-mono truncate font-medium">
                        {order.transferType || 'VIREMENT'} {order.contractNumber ? `· ${order.contractNumber}` : ''}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                        <span>{meta.label}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          title="Consulter le dossier"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintOrder(order)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                          title="Imprimer l'ordre officiel de virement"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <AlertCircle className="w-6 h-6 mx-auto text-slate-300" />
                      <p className="text-xs font-medium text-slate-500">Aucun ordre de paiement trouvé</p>
                      <button
                        onClick={onNewOrder}
                        className="text-xs text-blue-700 hover:underline font-semibold"
                      >
                        Créer le premier ordre &rarr;
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Affichage de{' '}
              <strong className="text-slate-800">
                {orders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              à{' '}
              <strong className="text-slate-800">
                {Math.min(currentPage * pageSize, orders.length)}
              </strong>{' '}
              sur <strong className="text-slate-800">{orders.length}</strong> ordres
            </span>

            <div className="flex items-center gap-1">
              <span>Lignes par page :</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <span className="font-mono px-2 font-medium">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
