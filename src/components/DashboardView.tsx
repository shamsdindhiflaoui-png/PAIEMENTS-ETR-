import React, { useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  FileCheck,
  XCircle,
  Filter,
  RefreshCcw,
  Landmark,
} from 'lucide-react';
import { DashboardStats, FilterParams, Bank } from '../types/payment';
import { formatTndCurrency, formatForeignCurrency, STATUS_META } from '../utils/workflowRules';

interface DashboardViewProps {
  stats: DashboardStats | null;
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  onResetFilters: () => void;
  banks: Bank[];
  onNavigateToOrders: (statusFilter?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  filters,
  onFilterChange,
  onResetFilters,
  banks,
  onNavigateToOrders,
}) => {
  const [selectedCurrencyView, setSelectedCurrencyView] = useState<'ALL' | 'EUR' | 'USD'>('ALL');

  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Calcul des indicateurs financiers en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filtres dynamiques du tableau de bord</span>
          </div>
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-700 transition-colors font-medium"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser les filtres</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Exercice */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Exercice budgétaire</label>
            <select
              value={filters.fiscalYear || 'ALL'}
              onChange={e => onFilterChange({ ...filters, fiscalYear: e.target.value as any })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">Tous les exercices</option>
              <option value="2026">Exercice 2026</option>
              <option value="2025">Exercice 2025</option>
            </select>
          </div>

          {/* Devise */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Devise du transfert</label>
            <select
              value={filters.currency || 'ALL'}
              onChange={e => onFilterChange({ ...filters, currency: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">Toutes les devises</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="USD">Dollar US (USD)</option>
              <option value="GBP">Livre Sterling (GBP)</option>
              <option value="CHF">Franc Suisse (CHF)</option>
            </select>
          </div>

          {/* Banque */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Banque tunisienne MTK</label>
            <select
              value={filters.bank || 'ALL'}
              onChange={e => onFilterChange({ ...filters, bank: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="ALL">Toutes les banques</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date de début */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Date début</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={e => onFilterChange({ ...filters, startDate: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Date de fin */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Date fin</label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={e => onFilterChange({ ...filters, endDate: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Row 1: Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ordres */}
        <div
          onClick={() => onNavigateToOrders('ALL')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Volume des ordres</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {stats.totalOrders}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span>Dossiers sous gestion</span>
            <span aria-hidden="true">·</span>
            <span className="text-blue-700 font-medium group-hover:underline">Voir liste &rarr;</span>
          </div>
        </div>

        {/* Total EUR */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Montant total EUR</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatForeignCurrency(stats.totalEurAmount, 'EUR')}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span>Fournisseurs zone euro</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-medium">Factures & acomptes</span>
          </div>
        </div>

        {/* Total USD */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Montant total USD</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatForeignCurrency(stats.totalUsdAmount, 'USD')}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span>Tabac brut international</span>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-700 font-medium">Règlements dollars</span>
          </div>
        </div>

        {/* Total Débité TND (Exécutés) */}
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-300 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Contre-valeur TND Exécutée
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-600/40 text-blue-300 flex items-center justify-center border border-blue-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {formatTndCurrency(stats.totalTndExecuted)}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <span>Débits réels confirmés</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-300 font-mono">{stats.executedCount} virements clos</span>
          </div>
        </div>
      </div>

      {/* Row 2: Workflow Stages Status Grid (5-Stage MTK Circuit) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
          Circuit de Traitement Opérationnel (5 Statuts)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Saisi (Brouillon) */}
          <div
            onClick={() => onNavigateToOrders('SAISI')}
            className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-700 mb-1">
              <span className="text-xs font-medium">1. Saisi (Brouillon)</span>
              <FileCheck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {stats.saisiCount}
            </div>
            <div className="text-[11px] text-slate-600 mt-1 font-medium group-hover:underline">
              En cours de saisie &rarr;
            </div>
          </div>

          {/* 2. Transmis pour signature */}
          <div
            onClick={() => onNavigateToOrders('TRANSMIS_SIGNATURE')}
            className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-xs font-medium">2. Transmis signature</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-900 tabular-nums">
              {stats.transmisSignatureCount}
            </div>
            <div className="text-[11px] text-amber-700 mt-1 font-medium group-hover:underline">
              Attente de signature &rarr;
            </div>
          </div>

          {/* 3. Signé */}
          <div
            onClick={() => onNavigateToOrders('SIGNE')}
            className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/60 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between text-blue-800 mb-1">
              <span className="text-xs font-medium">3. Signé</span>
              <Send className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-900 tabular-nums">
              {stats.signeCount}
            </div>
            <div className="text-[11px] text-blue-700 mt-1 font-medium group-hover:underline">
              Prêts pour banque &rarr;
            </div>
          </div>

          {/* 4. Déposé à la banque / En attente d'achat devise */}
          <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-indigo-800 mb-1">
                <span className="text-xs font-medium">4. Dépôt / Achat devise</span>
                <Building className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-bold font-mono text-indigo-900 tabular-nums">
                {stats.depositedCount + stats.pendingExchangeCount}
              </div>
            </div>
            <div className="mt-1.5 flex flex-col gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => onNavigateToOrders('DEPOSE_BANQUE')}
                className="text-left text-indigo-700 hover:underline font-semibold flex items-center justify-between"
              >
                <span>Déposé à la banque</span>
                <span className="font-mono">{stats.depositedCount}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateToOrders('EN_ATTENTE_ACHAT_DEVISE')}
                className="text-left text-purple-700 hover:underline font-semibold flex items-center justify-between"
              >
                <span>Attente achat devise</span>
                <span className="font-mono">{stats.pendingExchangeCount}</span>
              </button>
            </div>
          </div>

          {/* 5. Exécuté */}
          <div
            onClick={() => onNavigateToOrders('EXECUTE')}
            className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-xs font-medium">5. Exécuté</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-900 tabular-nums">
              {stats.executedCount}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 font-medium group-hover:underline">
              Débits confirmés &rarr;
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Dynamic Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Répartition par Banque Tunisienne */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Répartition des ordres par banque tunisienne
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {Object.keys(stats.ordersByBank).length} banques partenaires
              </span>
            </div>
            <div className="space-y-3">
              {Object.entries(stats.ordersByBank).map(([bankName, data]) => {
                const percentage = stats.totalOrders > 0 ? Math.round((data.count / stats.totalOrders) * 100) : 0;
                return (
                  <div key={bankName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-[240px]">{bankName}</span>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-slate-500 font-mono">{data.count} ordre(s)</span>
                        <span className="font-bold text-slate-700 font-mono tabular-nums">{percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(stats.ordersByBank).length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">Aucune donnée bancaire disponible</p>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Domiciliations bancaires actives DFC</span>
            <span className="text-blue-700 font-medium">Contrôle des plafonds de transfert</span>
          </div>
        </div>

        {/* Chart 2: Répartition par Devise & Montants */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Exposition et volumes par devise
              </h3>
              <span className="text-xs text-slate-500 font-mono">Devises de facturation</span>
            </div>
            <div className="space-y-4">
              {Object.entries(stats.amountByCurrency).map(([cur, total]) => {
                return (
                  <div key={cur} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm shadow-2xs">
                        {cur}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {cur === 'EUR' ? 'Euro Monnaie Unique' : cur === 'USD' ? 'Dollar des États-Unis' : cur}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Paiements internationaux MTK
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                        {formatForeignCurrency(total, cur)}
                      </div>
                      <div className="text-[11px] text-blue-700 font-medium">
                        {cur === 'EUR' ? 'Taux indicatif ~3.33 TND' : cur === 'USD' ? 'Taux indicatif ~3.12 TND' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(stats.amountByCurrency).length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">Aucune transaction enregistrée</p>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Passerelle prête pour Module 02</span>
            <span className="text-emerald-700 font-medium">Négociation des marges bancaires</span>
          </div>
        </div>
      </div>

      {/* Row 4: Chronological Monthly Evolution Visualizer */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Évolution mensuelle des ordres de paiement (Exercice {filters.fiscalYear || '2026'})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historique des émissions d’ordres et exécutions effectives en dinars tunisiens
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" /> Ordres émis
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" /> Débits TND
            </span>
          </div>
        </div>

        {/* Visual Monthly Table / Bars */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 font-semibold">Période</th>
                <th className="py-2.5 font-semibold text-center">Nombre d'ordres</th>
                <th className="py-2.5 font-semibold text-right">Volume EUR</th>
                <th className="py-2.5 font-semibold text-right">Volume USD</th>
                <th className="py-2.5 font-semibold text-right">Contre-valeur Exécutée (TND)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.monthlyEvolution.map(m => (
                <tr key={m.month} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 font-medium font-mono text-slate-900">{m.month}</td>
                  <td className="py-2.5 text-center">
                    <span className="font-mono px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">
                      {m.count}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {formatForeignCurrency(m.amountEur, 'EUR')}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {formatForeignCurrency(m.amountUsd, 'USD')}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-bold text-emerald-700">
                    {formatTndCurrency(m.executedTnd)}
                  </td>
                </tr>
              ))}
              {stats.monthlyEvolution.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Aucun ordre enregistré pour la période sélectionnée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
