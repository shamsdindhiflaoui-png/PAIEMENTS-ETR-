import React, { useState } from 'react';
import {
  Settings2,
  Building,
  UserCheck,
  Shield,
  Plus,
  RefreshCw,
  Layers,
  Database,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { Supplier, Bank, User } from '../types/payment';

interface SettingsViewProps {
  suppliers: Supplier[];
  banks: Bank[];
  users: User[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
  onAddBank: (bank: Omit<Bank, 'id'>) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  suppliers,
  banks,
  users,
  onAddSupplier,
  onAddBank,
  onResetDemo,
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'banks' | 'users' | 'module02'>('suppliers');

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [newSupName, setNewSupName] = useState<string>('');
  const [newSupCountry, setNewSupCountry] = useState<string>('');
  const [newSupAddress, setNewSupAddress] = useState<string>('');
  const [newSupBank, setNewSupBank] = useState<string>('');
  const [newSupIban, setNewSupIban] = useState<string>('');
  const [newSupSwift, setNewSupSwift] = useState<string>('');
  const [newSupEmail, setNewSupEmail] = useState<string>('');

  // Bank modal
  const [showBankModal, setShowBankModal] = useState<boolean>(false);
  const [newBankCode, setNewBankCode] = useState<string>('');
  const [newBankName, setNewBankName] = useState<string>('');
  const [newBankSwift, setNewBankSwift] = useState<string>('');
  const [newBankAgency, setNewBankAgency] = useState<string>('');

  const [isResetting, setIsResetting] = useState<boolean>(false);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName || !newSupCountry) return;
    const count = suppliers.length + 1;
    await onAddSupplier({
      code: `FOURN-${String(count).padStart(3, '0')}`,
      name: newSupName,
      country: newSupCountry,
      address: newSupAddress,
      bankName: newSupBank,
      iban: newSupIban,
      swift: newSupSwift,
      email: newSupEmail,
      active: true,
    });
    setShowSupplierModal(false);
    setNewSupName('');
    setNewSupCountry('');
    setNewSupAddress('');
    setNewSupBank('');
    setNewSupIban('');
    setNewSupSwift('');
    setNewSupEmail('');
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName || !newBankCode) return;
    await onAddBank({
      code: newBankCode.toUpperCase(),
      name: newBankName,
      swiftCode: newBankSwift.toUpperCase(),
      country: 'Tunisie',
      active: true,
      contactAgency: newBankAgency || 'Agence Kairouan',
    });
    setShowBankModal(false);
    setNewBankCode('');
    setNewBankName('');
    setNewBankSwift('');
    setNewBankAgency('');
  };

  const handleResetDemoData = async () => {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser les données de démonstration ?')) {
      setIsResetting(true);
      try {
        await onResetDemo();
        alert('Données réinitialisées avec succès.');
      } catch (err: any) {
        alert(err.message || 'Erreur réinitialisation');
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Paramètres & Gestion des Référentiels
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestion des banques tunisiennes, fournisseurs internationaux, profils habilités et préparation du Module 02.
          </p>
        </div>

        <button
          onClick={handleResetDemoData}
          disabled={isResetting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Réinitialiser les données démo</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          {[
            { id: 'suppliers', label: `Fournisseurs Internationaux (${suppliers.length})` },
            { id: 'banks', label: `Banques Partenaires (${banks.length})` },
            { id: 'users', label: `Profils & Habilitations (${users.length})` },
            { id: 'module02', label: 'Passerelle Future (Module 02 - Salles des Marchés)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: Fournisseurs */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Répertoire des Fournisseurs Étrangers Agréés MTK
              </h3>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau Fournisseur</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Raison Sociale</th>
                    <th className="py-2.5 px-3">Pays</th>
                    <th className="py-2.5 px-3">Banque Étrangère</th>
                    <th className="py-2.5 px-3 font-mono">IBAN / Compte</th>
                    <th className="py-2.5 px-3 font-mono">SWIFT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{s.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{s.country}</td>
                      <td className="py-2.5 px-3 text-slate-600">{s.bankName}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">{s.iban}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-blue-800">{s.swift}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Banques */}
        {activeTab === 'banks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Établissements Bancaires Tunisiens Domiciliataires
              </h3>
              <button
                onClick={() => setShowBankModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une Banque</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {banks.map(b => (
                <div key={b.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-blue-800">{b.code}</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {b.swiftCode}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">{b.name}</div>
                  <div className="text-[11px] text-slate-500">{b.contactAgency || 'Agence Kairouan'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Profils Utilisateurs & Matrice des Droits */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Matrice des Droits d'Accès et Habilitations Métier
            </h3>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Utilisateur</th>
                    <th className="py-2.5 px-3">Direction / Service</th>
                    <th className="py-2.5 px-3">Profil Système</th>
                    <th className="py-2.5 px-3">Habilitations Autorisées</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{u.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{u.department}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{u.role}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {u.role === 'ADMINISTRATEUR'
                          ? 'Accès total, gestion des utilisateurs, des paramètres et de toutes les opérations.'
                          : u.role === 'CONTROLE_GESTION'
                          ? 'Consultation des ordres transmis, validation budgétaire, retour pour correction, rejet motivé.'
                          : u.role === 'RESPONSABLE_FINANCIER'
                          ? 'Supervision globale, négociation de change, validation de l’exécution et clôture des débits.'
                          : 'Création d’ordres, saisie des informations, transmission au contrôle, dépôt bancaire.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Passerelle Future MODULE 02 */}
        {activeTab === 'module02' && (
          <div className="p-6 rounded-xl border border-blue-200 bg-blue-50/50 space-y-4">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <Layers className="w-5 h-5 text-blue-700" />
              <span>Conception d'Architecture : Préparation du MODULE 02 (Négociation des Devises)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Le présent MODULE 01 a été conçu selon les règles d'architecture les plus rigoureuses afin de s'interconnecter de manière transparente avec le futur <strong>MODULE 02 : Consultation des banques et négociation des taux de change</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-white border border-blue-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-700">1. Déclencheur</span>
                <p className="text-xs font-semibold text-slate-900">Statut DÉPOSÉ À LA BANQUE</p>
                <p className="text-[11px] text-slate-500">
                  Dès qu'un ordre est déposé et visé, il entre automatiquement dans le vivier d'ordres éligibles aux appels d'offres de change.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-blue-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-700">2. Entité Partagée</span>
                <p className="text-xs font-semibold text-slate-900">ExchangeTransactions</p>
                <p className="text-[11px] text-slate-500">
                  La structure de base de données comprend déjà les champs requis : cours BCT de référence, cotations multi-banques reçues, banque retenue et économies en TND.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-blue-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-700">3. Rétro-alimentation</span>
                <p className="text-xs font-semibold text-slate-900">Validation Taux de Change</p>
                <p className="text-[11px] text-slate-500">
                  La validation du cours négocié dans le Module 02 alimentera directement le statut TAUX_VALIDE et pré-remplira l'ordre de transfert SWIFT.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveSupplier} className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Nouveau Fournisseur International</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Raison Sociale *</label>
                <input
                  type="text"
                  required
                  value={newSupName}
                  onChange={e => setNewSupName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pays *</label>
                  <input
                    type="text"
                    required
                    value={newSupCountry}
                    onChange={e => setNewSupCountry(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email Contact</label>
                  <input
                    type="email"
                    value={newSupEmail}
                    onChange={e => setNewSupEmail(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Adresse Siège</label>
                <input
                  type="text"
                  value={newSupAddress}
                  onChange={e => setNewSupAddress(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Banque Bénéficiaire</label>
                  <input
                    type="text"
                    value={newSupBank}
                    onChange={e => setNewSupBank(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code SWIFT/BIC</label>
                  <input
                    type="text"
                    value={newSupSwift}
                    onChange={e => setNewSupSwift(e.target.value)}
                    className="w-full text-xs font-mono uppercase p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">IBAN / Numéro de Compte</label>
                <input
                  type="text"
                  value={newSupIban}
                  onChange={e => setNewSupIban(e.target.value)}
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bank Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveBank} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Ajout d'une Banque Partenaire</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code Banque *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : BIAT, STB"
                    value={newBankCode}
                    onChange={e => setNewBankCode(e.target.value)}
                    className="w-full text-xs font-mono uppercase p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code SWIFT *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : BIATTNTT"
                    value={newBankSwift}
                    onChange={e => setNewBankSwift(e.target.value)}
                    className="w-full text-xs font-mono uppercase p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom Complet de la Banque *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Banque Internationale Arabe de Tunisie"
                  value={newBankName}
                  onChange={e => setNewBankName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Agence de rattachement</label>
                <input
                  type="text"
                  placeholder="Ex : Agence Kairouan République"
                  value={newBankAgency}
                  onChange={e => setNewBankAgency(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs"
              >
                Enregistrer la Banque
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
