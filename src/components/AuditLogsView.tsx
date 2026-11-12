import React, { useState } from 'react';
import { History, Search, ShieldCheck, Download, Filter } from 'lucide-react';
import { AuditLog } from '../types/payment';

interface AuditLogsViewProps {
  logs: AuditLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [search, setSearch] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    if (selectedEntity !== 'ALL' && log.entityType !== selectedEntity) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.entityRef.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportLogsCsv = () => {
    const headers = ['ID', 'Horodatage', 'Entité', 'Référence', 'Action', 'Utilisateur', 'Rôle', 'Détails'];
    const rows = filteredLogs.map(l => [
      l.id,
      l.timestamp,
      l.entityType,
      `"${l.entityRef.replace(/"/g, '""')}"`,
      l.action,
      `"${l.userName.replace(/"/g, '""')}"`,
      l.userRole,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MTK_Journal_Audit_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Journal d’Audit & Historique des Opérations
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Traçabilité réglementaire inaltérable des créations, modifications, visas et exécutions financières.
          </p>
        </div>

        <button
          onClick={exportLogsCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Exporter le journal (.CSV)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par référence d'ordre, utilisateur, action ou détail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Type d'entité :</span>
          <select
            value={selectedEntity}
            onChange={e => setSelectedEntity(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none"
          >
            <option value="ALL">Toutes les entités ({logs.length})</option>
            <option value="PAYMENT_ORDER">Ordres de paiement</option>
            <option value="SUPPLIER">Fournisseurs</option>
            <option value="BANK">Banques</option>
            <option value="USER">Utilisateurs</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Date & Heure</th>
                <th className="py-3 px-4 whitespace-nowrap">Référence</th>
                <th className="py-3 px-4 whitespace-nowrap">Action Réalisée</th>
                <th className="py-3 px-4 whitespace-nowrap">Utilisateur Responsable</th>
                <th className="py-3 px-4 whitespace-nowrap">Détails de l'opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                    {log.entityRef}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{log.userName}</div>
                    <div className="text-[10px] text-slate-500">{log.userRole}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-md">
                    {log.details}
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Aucun enregistrement d'audit trouvé
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
