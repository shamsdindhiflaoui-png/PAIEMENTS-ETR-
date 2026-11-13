import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  ReceiptText,
  ClockAlert,
  History,
  Settings2,
  Building2,
  ShieldCheck,
  UserCheck,
  Briefcase,
  FileText,
  BadgeDollarSign,
} from 'lucide-react';
import { User, UserRole } from '../types/payment';

export type NavItem =
  | 'dashboard'
  | 'new_order'
  | 'orders_list'
  | 'pending_review'
  | 'consultations'
  | 'audit_logs'
  | 'settings';

interface SidebarProps {
  activeView: NavItem;
  onNavigate: (view: NavItem) => void;
  pendingCount: number;
  consultationPendingCount?: number;
  currentUser: User;
  onUserChange: (user: User) => void;
  users: User[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  pendingCount,
  consultationPendingCount = 0,
  currentUser,
  onUserChange,
  users,
}) => {
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMINISTRATEUR':
        return { label: 'Administrateur', color: 'bg-rose-900/60 text-rose-200 border-rose-700/50' };
      case 'CONTROLE_GESTION':
        return { label: 'Contrôle Gestion', color: 'bg-amber-900/60 text-amber-200 border-amber-700/50' };
      case 'RESPONSABLE_FINANCIER':
        return { label: 'Resp. Financier', color: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/50' };
      case 'AGENT_FINANCIER':
      default:
        return { label: 'Agent Financier', color: 'bg-blue-900/60 text-blue-200 border-blue-700/50' };
    }
  };

  const navItems = [
    {
      id: 'dashboard' as NavItem,
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'new_order' as NavItem,
      label: 'Nouvel ordre de paiement',
      icon: FilePlus2,
      badge: null,
    },
    {
      id: 'orders_list' as NavItem,
      label: 'Liste des ordres',
      icon: ReceiptText,
      badge: null,
    },
    {
      id: 'pending_review' as NavItem,
      label: 'Ordres en attente',
      icon: ClockAlert,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    {
      id: 'consultations' as NavItem,
      label: 'Consultations de change',
      icon: BadgeDollarSign,
      badge: consultationPendingCount > 0 ? consultationPendingCount : null,
    },
    {
      id: 'audit_logs' as NavItem,
      label: 'Historique & Archivage',
      icon: History,
      badge: null,
    },
    {
      id: 'settings' as NavItem,
      label: 'Paramètres & Référentiels',
      icon: Settings2,
      badge: null,
    },
  ];

  const roleInfo = getRoleBadge(currentUser.role);

  return (
    <aside className="w-68 bg-slate-900 text-slate-200 flex flex-col shrink-0 h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm tracking-wider">
            MTK
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white tracking-tight uppercase leading-tight truncate">
              MTK Payments
            </h1>
            <p className="text-xs text-blue-300 font-medium truncate mt-0.5">
              Direction Financière & Comptable
            </p>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Module 01 · Règlements Extérieurs</span>
          <span className="text-blue-400 font-mono text-[10px] bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/60">
            v1.0 DFC
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Gestion Opérationnelle
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isActive
                      ? 'bg-white text-blue-700'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-5 px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Écosystème Bancaire
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800/60 space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" /> STB, BNA, BIAT, BH
            </span>
            <span className="text-emerald-400 text-[10px] font-mono">En ligne</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Module 02 actif : regroupement d'ordres et consultations pour achat de devises.
          </p>
        </div>
      </nav>

      {/* User Switcher / Simulation & Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Profil Utilisateur
          </span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        </div>

        {/* Quick Role Switcher */}
        <select
          value={currentUser.id}
          onChange={e => {
            const found = users.find(u => u.id === e.target.value);
            if (found) onUserChange(found);
          }}
          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          title="Changer de rôle pour simuler le circuit de validation"
        >
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>

        <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-800/50">
          <div className="w-7 h-7 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center font-bold text-xs border border-slate-700">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-200 truncate">{currentUser.name}</div>
            <div className="text-[10px] text-slate-400 truncate">{currentUser.department}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
