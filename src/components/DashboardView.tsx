import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  Send,
  FileCheck,
  Filter,
  RefreshCcw,
  Landmark,
  FileSpreadsheet,
  ArrowLeftRight,
  Award,
  ArrowRight,
  Layers,
  Wallet,
  Printer,
} from 'lucide-react';
import {
  Bank,
  CurrencyConsultation,
  DashboardStats,
  FilterParams,
  Invoice,
  PaymentOrder,
} from '../types/payment';
import { formatTndCurrency, formatForeignCurrency } from '../utils/workflowRules';
import {
  computeConsultationAxisMetrics,
  computeInvoiceAxisMetrics,
} from '../utils/dashboardMetrics';
import { downloadTablePdf } from '../utils/tablePdf';

export type DashboardAxisFilter = 'ALL' | 'FACTURES' | 'ORDRES' | 'CONSULTATIONS';

interface DashboardViewProps {
  stats: DashboardStats | null;
  invoices: Invoice[];
  orders: PaymentOrder[];
  consultations: CurrencyConsultation[];
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  onResetFilters: () => void;
  banks: Bank[];
  onNavigateToInvoices: () => void;
  onNavigateToOrders: (statusFilter?: string) => void;
  onNavigateToConsultations: () => void;
  onSelectConsultation: (consultationId: string) => void;
}

function renderCurrencyEntries(
  byCurrency: Record<string, number>
): Array<[string, number]> {
  return Object.entries(byCurrency).filter(([, v]) => v > 0.005);
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  invoices,
  orders,
  consultations,
  filters,
  onFilterChange,
  onResetFilters,
  banks,
  onNavigateToInvoices,
  onNavigateToOrders,
  onNavigateToConsultations,
  onSelectConsultation,
}) => {
  const [activeAxis, setActiveAxis] = useState<DashboardAxisFilter>('ALL');

  const invoiceMetrics = useMemo(
    () => computeInvoiceAxisMetrics(invoices, orders, filters),
    [invoices, orders, filters]
  );

  const consultationMetrics = useMemo(
    () => computeConsultationAxisMetrics(consultations, orders, filters),
    [consultations, orders, filters]
  );

  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            Calcul des indicateurs financiers en cours...
          </p>
        </div>
      </div>
    );
  }

  const showFactures = activeAxis === 'ALL' || activeAxis === 'FACTURES';
  const showOrdres = activeAxis === 'ALL' || activeAxis === 'ORDRES';
  const showConsultations = activeAxis === 'ALL' || activeAxis === 'CONSULTATIONS';

  const billedEntries = renderCurrencyEntries(invoiceMetrics.totalByCurrency);
  const allocatedEntries = renderCurrencyEntries(invoiceMetrics.allocatedByCurrency);
  const remainingEntries = renderCurrencyEntries(invoiceMetrics.remainingByCurrency);
  const consultedVolumeEntries = renderCurrencyEntries(consultationMetrics.volumeByCurrency);

  return (
    <div className="space-y-6 pb-10">
      {/* Top Axis Selector & Dynamic Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Tableau de bord réparti en 3 axes</span>
          </div>

          {/* 3-Axis Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Vue globale (3 axes)' },
                { id: 'FACTURES', label: `1. Les Factures (${invoiceMetrics.totalCount})` },
                { id: 'ORDRES', label: `2. Les Ordres (${stats.totalOrders})` },
                {
                  id: 'CONSULTATIONS',
                  label: `3. Les Consultations (${consultationMetrics.totalCount})`,
                },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveAxis(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeAxis === tab.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              type="button"
              onClick={onResetFilters}
              className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-blue-700 transition-colors font-medium"
              title="Réinitialiser tous les filtres"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Exercice budgétaire
            </label>
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

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Devise</label>
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

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Banque tunisienne MTK
            </label>
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

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Date début</label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={e => onFilterChange({ ...filters, startDate: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

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

      {/* ===================================================================== */}
      {/* AXE 1 : LES FACTURES                                                  */}
      {/* ===================================================================== */}
      {showFactures && (
        <section aria-labelledby="axis-factures-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-blue-600 pl-3.5 py-0.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  Axe 1
                </span>
                <h2
                  id="axis-factures-heading"
                  className="text-sm font-bold text-slate-900 uppercase tracking-wide"
                >
                  Les Factures Fournisseurs
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Suivi des factures enregistrées, montants ordonnancés et soldes restants à régler
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToInvoices}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ouvrir Module Factures</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Axe 1 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={onNavigateToInvoices}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total Factures
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {invoiceMetrics.totalCount}
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <span className="text-amber-700 font-medium">
                  {invoiceMetrics.unpaidCount + invoiceMetrics.partialCount} à solder
                </span>
                <span>·</span>
                <span className="text-emerald-700 font-medium">
                  {invoiceMetrics.paidCount} soldée(s)
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Montant Facturé
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                {billedEntries.length > 0 ? (
                  billedEntries.slice(0, 2).map(([cur, amt]) => (
                    <div key={cur} className="text-lg font-bold font-mono tabular-nums text-slate-900">
                      {formatForeignCurrency(amt, cur)}
                    </div>
                  ))
                ) : (
                  <div className="text-xl font-bold font-mono text-slate-400">0,00</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">Cumul des factures filtrées</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Déjà Ordonnancé
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                {allocatedEntries.length > 0 ? (
                  allocatedEntries.slice(0, 2).map(([cur, amt]) => (
                    <div key={cur} className="text-lg font-bold font-mono tabular-nums text-emerald-800">
                      {formatForeignCurrency(amt, cur)}
                    </div>
                  ))
                ) : (
                  <div className="text-xl font-bold font-mono text-slate-400">0,00</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Couverture moyenne :{' '}
                <strong className="font-mono text-slate-800">
                  {invoiceMetrics.averageProgressPercent}%
                </strong>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-amber-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                  Reste à Ordonnancer
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                {remainingEntries.length > 0 ? (
                  remainingEntries.slice(0, 2).map(([cur, amt]) => (
                    <div key={cur} className="text-lg font-bold font-mono tabular-nums text-amber-800">
                      {formatForeignCurrency(amt, cur)}
                    </div>
                  ))
                ) : (
                  <div className="text-lg font-bold font-mono text-emerald-700">0,00 (Soldé)</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">Disponible pour nouveaux ordres</div>
            </div>
          </div>

          {/* Axe 1 Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Statut des factures */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    État de Règlement des Factures
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    {invoiceMetrics.totalCount} dossier(s)
                  </span>
                </div>
                <div className="space-y-3.5">
                  {[
                    {
                      label: 'Payées (Soldées 100%)',
                      count: invoiceMetrics.paidCount,
                      barClass: 'bg-emerald-600',
                      textClass: 'text-emerald-700',
                    },
                    {
                      label: 'Partiellement payées',
                      count: invoiceMetrics.partialCount,
                      barClass: 'bg-amber-500',
                      textClass: 'text-amber-700',
                    },
                    {
                      label: 'Non payées (Ouvertes)',
                      count: invoiceMetrics.unpaidCount,
                      barClass: 'bg-slate-400',
                      textClass: 'text-slate-700',
                    },
                  ].map(row => {
                    const pct =
                      invoiceMetrics.totalCount > 0
                        ? Math.round((row.count / invoiceMetrics.totalCount) * 100)
                        : 0;
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">{row.label}</span>
                          <span className={`font-mono font-bold ${row.textClass}`}>
                            {row.count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${row.barClass}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Fractionnement multi-ordres pris en charge</span>
                <button
                  type="button"
                  onClick={onNavigateToInvoices}
                  className="text-blue-700 font-semibold hover:underline"
                >
                  Voir tableau complet &rarr;
                </button>
              </div>
            </div>

            {/* Factures récentes */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Factures Récentes
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Cliquez pour consulter le module Factures
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTablePdf({
                        title: 'Tableau de Bord - Axe 1 : Factures Récentes',
                        subtitle: `Exercice : ${
                          filters.fiscalYear && filters.fiscalYear !== 'ALL'
                            ? filters.fiscalYear
                            : 'Tous'
                        } | Devise : ${filters.currency || 'Toutes'}`,
                        filename: `Dashboard_Factures_Recentes_MTK_${new Date().toISOString().split('T')[0]}.pdf`,
                        columns: [
                          { header: 'N° Facture', widthRatio: 1.3 },
                          { header: 'Fournisseur', widthRatio: 2.0 },
                          { header: 'Montant', align: 'right', widthRatio: 1.2 },
                          { header: 'Reste à Payer', align: 'right', widthRatio: 1.2 },
                          { header: 'Statut', align: 'center', widthRatio: 1.1 },
                        ],
                        rows: invoiceMetrics.recentInvoices.map(item => [
                          item.invoice.invoiceNumber,
                          item.invoice.supplierName,
                          formatForeignCurrency(item.invoice.totalAmount, item.invoice.currency),
                          formatForeignCurrency(item.remainingAmount, item.invoice.currency),
                          item.paymentStatus === 'PAYEE'
                            ? 'Soldée'
                            : item.paymentStatus === 'PARTIELLEMENT_PAYEE'
                            ? 'Partielle'
                            : 'Non payée',
                        ]),
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap"
                  >
                    <Printer className="w-3 h-3 text-slate-600" />
                    <span>Imprimer PDF</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                      <th className="py-2 pr-3 font-semibold">N° Facture</th>
                      <th className="py-2 px-2.5 font-semibold">Fournisseur</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Montant</th>
                      <th className="py-2 px-2.5 font-semibold text-right">Reste</th>
                      <th className="py-2 pl-2.5 font-semibold text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceMetrics.recentInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          Aucune facture pour les critères sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      invoiceMetrics.recentInvoices.map(item => (
                        <tr
                          key={item.invoice.id}
                          onClick={onNavigateToInvoices}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 pr-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {item.invoice.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-800 truncate max-w-[180px]">
                            {item.invoice.supplierName}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono text-slate-900 whitespace-nowrap">
                            {formatForeignCurrency(item.invoice.totalAmount, item.invoice.currency)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                            {formatForeignCurrency(item.remainingAmount, item.invoice.currency)}
                          </td>
                          <td className="py-2.5 pl-2.5 text-right whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                item.paymentStatus === 'PAYEE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : item.paymentStatus === 'PARTIELLEMENT_PAYEE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {item.paymentStatus === 'PAYEE'
                                ? 'Soldée'
                                : item.paymentStatus === 'PARTIELLEMENT_PAYEE'
                                ? 'Partielle'
                                : 'Non payée'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* AXE 2 : LES ORDRES DE PAIEMENT                                        */}
      {/* ===================================================================== */}
      {showOrdres && (
        <section aria-labelledby="axis-ordres-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-indigo-600 pl-3.5 py-0.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Axe 2
                </span>
                <h2
                  id="axis-ordres-heading"
                  className="text-sm font-bold text-slate-900 uppercase tracking-wide"
                >
                  Les Ordres de Paiement
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Circuit de validation en 5 étapes, domiciliations bancaires et exécutions SWIFT
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToOrders('ALL')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Ouvrir Registre des Ordres</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Axe 2 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => onNavigateToOrders('ALL')}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Volume des ordres
                </span>
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
                <span className="text-blue-700 font-medium group-hover:underline">
                  Voir liste &rarr;
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Montant total EUR
                </span>
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

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Montant total USD
                </span>
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
                <span className="text-slate-300 font-mono">
                  {stats.executedCount} virements clos
                </span>
              </div>
            </div>
          </div>

          {/* 5-Stage Circuit Grid */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-4">
              Circuit de Traitement Opérationnel (5 Statuts)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

          {/* Bank & Currency Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                    const percentage =
                      stats.totalOrders > 0
                        ? Math.round((data.count / stats.totalOrders) * 100)
                        : 0;
                    return (
                      <div key={bankName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 truncate max-w-[240px]">
                            {bankName}
                          </span>
                          <div className="flex items-center gap-3 text-right">
                            <span className="text-slate-500 font-mono">{data.count} ordre(s)</span>
                            <span className="font-bold text-slate-700 font-mono tabular-nums">
                              {percentage}%
                            </span>
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
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Aucune donnée bancaire disponible
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Domiciliations bancaires actives DFC</span>
                <span className="text-blue-700 font-medium">Contrôle des plafonds de transfert</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Exposition et volumes par devise
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">Devises de facturation</span>
                </div>
                <div className="space-y-4">
                  {Object.entries(stats.amountByCurrency).map(([cur, total]) => (
                    <div
                      key={cur}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm shadow-2xs">
                          {cur}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {cur === 'EUR'
                              ? 'Euro Monnaie Unique'
                              : cur === 'USD'
                              ? 'Dollar des États-Unis'
                              : cur}
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
                          {cur === 'EUR'
                            ? 'Taux indicatif ~3.33 TND'
                            : cur === 'USD'
                            ? 'Taux indicatif ~3.12 TND'
                            : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.amountByCurrency).length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      Aucune transaction enregistrée
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Passerelle vers Module 02</span>
                <span className="text-emerald-700 font-medium">Négociation des marges bancaires</span>
              </div>
            </div>
          </div>

          {/* Monthly Evolution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Évolution mensuelle des ordres de paiement (Exercice{' '}
                  {filters.fiscalYear && filters.fiscalYear !== 'ALL'
                    ? filters.fiscalYear
                    : 'Global'}
                  )
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historique des émissions d’ordres et exécutions effectives en dinars tunisiens
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadTablePdf({
                    title: 'Tableau de Bord - Axe 2 : Évolution Mensuelle des Ordres',
                    subtitle: `Exercice : ${
                      filters.fiscalYear && filters.fiscalYear !== 'ALL'
                        ? filters.fiscalYear
                        : 'Global'
                    } | Devise : ${filters.currency || 'Toutes'}`,
                    filename: `Dashboard_Evolution_Ordres_MTK_${new Date().toISOString().split('T')[0]}.pdf`,
                    columns: [
                      { header: 'Période', widthRatio: 1.2 },
                      { header: "Nombre d'ordres", align: 'center', widthRatio: 1.1 },
                      { header: 'Volume EUR', align: 'right', widthRatio: 1.3 },
                      { header: 'Volume USD', align: 'right', widthRatio: 1.3 },
                      { header: 'Contre-valeur Exécutée (TND)', align: 'right', widthRatio: 1.6 },
                    ],
                    rows: stats.monthlyEvolution.map(m => [
                      m.month,
                      m.count,
                      formatForeignCurrency(m.amountEur, 'EUR'),
                      formatForeignCurrency(m.amountUsd, 'USD'),
                      formatTndCurrency(m.executedTnd),
                    ]),
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Imprimer PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 font-semibold">Période</th>
                    <th className="py-2.5 font-semibold text-center">Nombre d'ordres</th>
                    <th className="py-2.5 font-semibold text-right">Volume EUR</th>
                    <th className="py-2.5 font-semibold text-right">Volume USD</th>
                    <th className="py-2.5 font-semibold text-right">
                      Contre-valeur Exécutée (TND)
                    </th>
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
        </section>
      )}

      {/* ===================================================================== */}
      {/* AXE 3 : LES CONSULTATIONS DE CHANGE                                   */}
      {/* ===================================================================== */}
      {showConsultations && (
        <section aria-labelledby="axis-consultations-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-emerald-600 pl-3.5 py-0.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Axe 3
                </span>
                <h2
                  id="axis-consultations-heading"
                  className="text-sm font-bold text-slate-900 uppercase tracking-wide"
                >
                  Les Consultations de Change
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Appels d’offres devises, classement moins-disant, économies réalisées et confirmations d’achat
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToConsultations}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors self-start sm:self-auto"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Ouvrir Module Consultations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Axe 3 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={onNavigateToConsultations}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Consultations Émises
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {consultationMetrics.totalCount}
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <span className="text-amber-700 font-medium">
                  {consultationMetrics.openCount} ouverte(s)
                </span>
                <span>·</span>
                <span className="text-emerald-700 font-medium">
                  {consultationMetrics.closedCount} clôturée(s)
                </span>
              </div>
            </div>

            <div
              onClick={onNavigateToConsultations}
              className="bg-white p-5 rounded-xl border border-purple-200/80 shadow-2xs hover:border-purple-400 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-900">
                  Ordres à Consulter
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-purple-900">
                {consultationMetrics.pendingOrdersToConsultCount}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Ordres en attente d’achat devise non regroupés
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Volume Consulté
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                {consultedVolumeEntries.length > 0 ? (
                  consultedVolumeEntries.slice(0, 2).map(([cur, amt]) => (
                    <div key={cur} className="text-lg font-bold font-mono tabular-nums text-slate-900">
                      {formatForeignCurrency(amt, cur)}
                    </div>
                  ))
                ) : (
                  <div className="text-xl font-bold font-mono text-slate-400">0,00</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Besoins devises mis en concurrence
              </div>
            </div>

            <div className="bg-emerald-950 text-white p-5 rounded-xl border border-emerald-900 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-200 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Économies Moins-Disant
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-700/60 text-emerald-200 flex items-center justify-center border border-emerald-600/40">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-300">
                {formatTndCurrency(consultationMetrics.totalSavingsTnd)}
              </div>
              <div className="mt-2 text-xs text-emerald-200/80">
                Total acheté :{' '}
                <span className="font-mono text-white">
                  {formatTndCurrency(consultationMetrics.totalCounterValueTnd)}
                </span>
              </div>
            </div>
          </div>

          {/* Axe 3 Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Banques adjudicataires */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Banques Adjudicataires (Offres Retenues)
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {consultationMetrics.closedCount} clôturée(s)
                  </span>
                </div>
                {consultationMetrics.bankAwards.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Aucune consultation clôturée pour la période sélectionnée.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {consultationMetrics.bankAwards.map(award => {
                      const pct =
                        consultationMetrics.closedCount > 0
                          ? Math.round((award.winsCount / consultationMetrics.closedCount) * 100)
                          : 0;
                      const volStr = Object.entries(award.volumeByCurrency)
                        .map(([c, v]) => formatForeignCurrency(v, c))
                        .join(' · ');
                      return (
                        <div key={award.bankName} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 truncate max-w-[210px]">
                              {award.bankName}
                            </span>
                            <span className="font-mono text-emerald-700 font-bold">
                              {award.winsCount} marché(s) · {pct}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono">
                            <span>{volStr}</span>
                            {award.lastRate && <span>Dernier cours : {award.lastRate.toFixed(4)} TND</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Classement automatique moins-disant</span>
                <button
                  type="button"
                  onClick={onNavigateToConsultations}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Créer / gérer consultations &rarr;
                </button>
              </div>
            </div>

            {/* Dernières consultations */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Dernières Consultations de Change
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    Cliquez sur une consultation pour voir les offres
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTablePdf({
                        title: 'Tableau de Bord - Axe 3 : Dernières Consultations de Change',
                        subtitle: `Exercice : ${
                          filters.fiscalYear && filters.fiscalYear !== 'ALL'
                            ? filters.fiscalYear
                            : 'Tous'
                        } | Devise : ${filters.currency || 'Toutes'}`,
                        filename: `Dashboard_Consultations_MTK_${new Date().toISOString().split('T')[0]}.pdf`,
                        columns: [
                          { header: 'N° Consultation', widthRatio: 1.4 },
                          { header: 'Date', widthRatio: 1.0 },
                          { header: 'Montant', align: 'right', widthRatio: 1.2 },
                          { header: 'Offre Retenue', widthRatio: 2.0 },
                          { header: 'Statut', align: 'center', widthRatio: 1.0 },
                        ],
                        rows: consultationMetrics.recentConsultations.map(c => [
                          c.consultationNumber,
                          c.operationDate,
                          formatForeignCurrency(c.totalAmount, c.currency),
                          c.status === 'CLOTUREE' && c.selectedBankName
                            ? `${c.selectedBankName} (${c.negotiatedRate?.toFixed(4) || '-'})`
                            : c.quotes && c.quotes.length > 0
                            ? `${c.quotes.length} offre(s) reçue(s)`
                            : 'En attente de cotations',
                          c.status === 'CLOTUREE'
                            ? 'Clôturée'
                            : c.status === 'ANNULEE'
                            ? 'Annulée'
                            : 'Ouverte',
                        ]),
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap"
                  >
                    <Printer className="w-3 h-3 text-slate-600" />
                    <span>Imprimer PDF</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                      <th className="py-2 pr-3 font-semibold">N° Consultation</th>
                      <th className="py-2 px-2.5 font-semibold">Date</th>
                      <th className="py-2 px-3 font-semibold text-right">Montant</th>
                      <th className="py-2 px-3 font-semibold">Offre Retenue</th>
                      <th className="py-2 pl-2.5 font-semibold text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consultationMetrics.recentConsultations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Aucune consultation enregistrée pour les critères sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      consultationMetrics.recentConsultations.map(c => (
                        <tr
                          key={c.id}
                          onClick={() => onSelectConsultation(c.id)}
                          className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 pr-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {c.consultationNumber}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono text-slate-600 whitespace-nowrap">
                            {c.operationDate}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {formatForeignCurrency(c.totalAmount, c.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 truncate max-w-[180px]">
                            {c.status === 'CLOTUREE' && c.selectedBankName
                              ? `${c.selectedBankName} (${c.negotiatedRate?.toFixed(4) || '—'})`
                              : c.quotes && c.quotes.length > 0
                              ? `${c.quotes.length} offre(s) reçue(s)`
                              : 'En attente de cotations'}
                          </td>
                          <td className="py-2.5 pl-2.5 text-right whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                c.status === 'CLOTUREE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : c.status === 'ANNULEE'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {c.status === 'CLOTUREE'
                                ? 'Clôturée'
                                : c.status === 'ANNULEE'
                                ? 'Annulée'
                                : 'Ouverte'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
