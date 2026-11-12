import React from 'react';
import { FilePlus2, Download, RefreshCw, AlertCircle, Database } from 'lucide-react';
import { NavItem } from './Sidebar';
import { User } from '../types/payment';

interface HeaderProps {
  activeView: NavItem;
  onNavigate: (view: NavItem) => void;
  currentUser: User;
  showDemoData: boolean;
  onToggleDemoData: (value: boolean) => void;
  onResetDemo: () => void;
  selectedOrderNumber?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onNavigate,
  currentUser,
  showDemoData,
  onToggleDemoData,
  onResetDemo,
  selectedOrderNumber,
}) => {
  const getViewTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Tableau de bord de direction';
      case 'new_order':
        return 'Saisie d’un nouvel ordre de paiement';
      case 'orders_list':
        return 'Registre des ordres de paiement internationaux';
      case 'pending_review':
        return 'Ordres en attente de traitement & validation';
      case 'audit_logs':
        return 'Journal d’audit & historique des opérations';
      case 'settings':
        return 'Référentiels banques, fournisseurs & paramètres';
      default:
        return 'MTK International Payments';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0 shadow-xs z-10">
      {/* Zone 1: Breadcrumb & Context */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 whitespace-nowrap">
          MTK · DFC
        </span>
        <span className="text-slate-300">/</span>
        <h2 className="text-sm font-bold text-slate-900 truncate">
          {getViewTitle()}
        </h2>
        {selectedOrderNumber && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {selectedOrderNumber}
            </span>
          </>
        )}
      </div>

      {/* Zone 2: Mode Démo Indicator & Controls */}
      <div className="flex items-center gap-4">
        {/* Demo Data Pill / Switch */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <Database className={`w-3.5 h-3.5 ${showDemoData ? 'text-amber-600' : 'text-slate-400'}`} />
          <span className="text-slate-600 font-medium">Données démo :</span>
          <button
            onClick={() => onToggleDemoData(!showDemoData)}
            className={`text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
              showDemoData
                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
            title="Activer ou masquer les dossiers de démonstration"
          >
            {showDemoData ? 'Actives' : 'Masquées'}
          </button>
          {showDemoData && (
            <button
              onClick={onResetDemo}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Réinitialiser les données de démonstration"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Export CSV Direct Link */}
        <a
          href="/api/export-csv"
          download
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Excel</span>
        </a>

        {/* Primary Action Button */}
        {activeView !== 'new_order' && (
          <button
            onClick={() => onNavigate('new_order')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Nouvel Ordre</span>
          </button>
        )}
      </div>
    </header>
  );
};
