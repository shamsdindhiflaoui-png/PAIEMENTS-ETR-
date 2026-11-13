import React, { useState } from 'react';
import {
  Settings2,
  Plus,
  RefreshCw,
  Layers,
  Mail,
  UserPlus,
  Trash2,
  Edit3,
  Phone,
  Printer,
  AlertCircle,
  X,
} from 'lucide-react';
import { Supplier, Bank, User, BankConfirmationContact, OrderTransferType } from '../types/payment';
import {
  ALL_ORDER_TRANSFER_TYPES,
  ORDER_TRANSFER_TYPE_SHORT_LABELS,
  formatContactOrderTypesTag,
  normalizeBankConfirmationContacts,
} from '../utils/purchaseConfirmationPdf';

interface SettingsViewProps {
  suppliers: Supplier[];
  banks: Bank[];
  users: User[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<void>;
  onAddBank: (bank: Omit<Bank, 'id'>) => Promise<void>;
  onUpdateBank?: (id: string, bank: Partial<Bank>) => Promise<void>;
  onResetDemo: () => Promise<void>;
}

interface EditableContactRow {
  id: string;
  name: string;
  role: string;
  email: string;
  orderTypes: OrderTransferType[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createEmptyContactRow = (): EditableContactRow => ({
  id: 'cnt_' + Math.random().toString(36).slice(2, 9),
  name: '',
  role: '',
  email: '',
  orderTypes: [...ALL_ORDER_TRANSFER_TYPES],
});

export const SettingsView: React.FC<SettingsViewProps> = ({
  suppliers,
  banks,
  users,
  onAddSupplier,
  onAddBank,
  onUpdateBank,
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

  // Bank modal (Create & Edit)
  const [showBankModal, setShowBankModal] = useState<boolean>(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankCode, setBankCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankSwift, setBankSwift] = useState<string>('');
  const [bankAgency, setBankAgency] = useState<string>('');
  const [bankTradingDeskName, setBankTradingDeskName] = useState<string>('');
  const [bankTradingDeskFax, setBankTradingDeskFax] = useState<string>('');
  const [bankTradingDeskPhone, setBankTradingDeskPhone] = useState<string>('');
  const [bankContacts, setBankContacts] = useState<EditableContactRow[]>([createEmptyContactRow()]);
  const [bankFormError, setBankFormError] = useState<string | null>(null);
  const [isSavingBank, setIsSavingBank] = useState<boolean>(false);

  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [confirmResetPending, setConfirmResetPending] = useState<boolean>(false);

  const openAddBankModal = () => {
    setEditingBank(null);
    setBankCode('');
    setBankName('');
    setBankSwift('');
    setBankAgency('');
    setBankTradingDeskName('');
    setBankTradingDeskFax('');
    setBankTradingDeskPhone('');
    setBankContacts([createEmptyContactRow()]);
    setBankFormError(null);
    setShowBankModal(true);
  };

  const openEditBankModal = (bank: Bank) => {
    const existingContacts = normalizeBankConfirmationContacts(
      bank.confirmationContacts,
      bank.contactEmails
    );
    setEditingBank(bank);
    setBankCode(bank.code || '');
    setBankName(bank.name || '');
    setBankSwift(bank.swiftCode || '');
    setBankAgency(bank.contactAgency || '');
    setBankTradingDeskName(bank.tradingDeskName || '');
    setBankTradingDeskFax(bank.tradingDeskFax || '');
    setBankTradingDeskPhone(bank.tradingDeskPhone || '');
    setBankContacts(
      existingContacts.length > 0
        ? existingContacts.map((c, idx) => ({
            id: c.id || `cnt_${idx}_${Date.now()}`,
            name: c.name || '',
            role: c.role || '',
            email: c.email || '',
            orderTypes:
              c.orderTypes && c.orderTypes.length > 0
                ? [...c.orderTypes]
                : [...ALL_ORDER_TRANSFER_TYPES],
          }))
        : [createEmptyContactRow()]
    );
    setBankFormError(null);
    setShowBankModal(true);
  };

  const handleAddContactRow = () => {
    setBankContacts(prev => [...prev, createEmptyContactRow()]);
  };

  const handleRemoveContactRow = (rowId: string) => {
    setBankContacts(prev => {
      const next = prev.filter(r => r.id !== rowId);
      return next.length > 0 ? next : [createEmptyContactRow()];
    });
  };

  const handleUpdateContactRow = (
    rowId: string,
    field: 'name' | 'role' | 'email',
    value: string
  ) => {
    setBankContacts(prev =>
      prev.map(row => (row.id === rowId ? { ...row, [field]: value } : row))
    );
    if (bankFormError) setBankFormError(null);
  };

  const handleToggleContactOrderType = (rowId: string, orderType: OrderTransferType) => {
    setBankContacts(prev =>
      prev.map(row => {
        if (row.id !== rowId) return row;
        const exists = row.orderTypes.includes(orderType);
        const nextTypes = exists
          ? row.orderTypes.filter(t => t !== orderType)
          : ALL_ORDER_TRANSFER_TYPES.filter(t => t === orderType || row.orderTypes.includes(t));
        return { ...row, orderTypes: nextTypes };
      })
    );
    if (bankFormError) setBankFormError(null);
  };

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
    setBankFormError(null);

    const trimmedCode = bankCode.trim().toUpperCase();
    const trimmedName = bankName.trim();
    const trimmedSwift = bankSwift.trim().toUpperCase();

    if (!trimmedCode || !trimmedName || !trimmedSwift) {
      setBankFormError('Veuillez renseigner le code banque, le code SWIFT et le nom complet.');
      return;
    }

    const parsedContacts: BankConfirmationContact[] = [];
    const seenEmails = new Set<string>();

    for (const row of bankContacts) {
      const name = row.name.trim();
      const role = row.role.trim();
      const email = row.email.trim();

      if (!name && !role && !email) {
        continue;
      }

      if (!email) {
        setBankFormError(
          `Veuillez saisir une adresse email pour "${name || role || 'le contact'}" ou supprimer la ligne.`
        );
        return;
      }

      if (!EMAIL_REGEX.test(email)) {
        setBankFormError(`Adresse email invalide : "${email}".`);
        return;
      }

      const lower = email.toLowerCase();
      if (seenEmails.has(lower)) {
        setBankFormError(`L’adresse email "${email}" est saisie en double.`);
        return;
      }
      seenEmails.add(lower);

      if (row.orderTypes.length === 0) {
        setBankFormError(
          `Veuillez sélectionner au moins un type d'ordre (LC, VIR, REMISE ou AUTRE) pour "${name || email}".`
        );
        return;
      }

      parsedContacts.push({
        id: row.id,
        name,
        role: role || undefined,
        email,
        orderTypes: [...row.orderTypes],
      });
    }

    const normalizedContacts = normalizeBankConfirmationContacts(parsedContacts);
    const contactEmails = normalizedContacts.map(c => c.email);
    const trimmedDeskName = bankTradingDeskName.trim() || `${trimmedCode} SALLE DE CHANGE`;

    const payload: Omit<Bank, 'id'> = {
      code: trimmedCode,
      name: trimmedName,
      swiftCode: trimmedSwift,
      country: 'Tunisie',
      active: editingBank ? editingBank.active : true,
      contactAgency: bankAgency.trim() || 'Agence Kairouan',
      tradingDeskName: trimmedDeskName,
      tradingDeskAddress:
        editingBank?.tradingDeskAddress && editingBank.tradingDeskAddress !== editingBank.tradingDeskName
          ? editingBank.tradingDeskAddress
          : trimmedDeskName,
      tradingDeskFax: bankTradingDeskFax.trim() || undefined,
      tradingDeskPhone: bankTradingDeskPhone.trim() || undefined,
      confirmationContacts: normalizedContacts,
      contactEmails,
    };

    setIsSavingBank(true);
    try {
      if (editingBank && onUpdateBank) {
        await onUpdateBank(editingBank.id, payload);
      } else {
        await onAddBank(payload);
      }
      setShowBankModal(false);
      setEditingBank(null);
    } catch (err: any) {
      setBankFormError(err?.message || 'Erreur lors de l’enregistrement de la banque.');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleResetDemoData = async () => {
    if (!confirmResetPending) {
      setConfirmResetPending(true);
      return;
    }
    setIsResetting(true);
    try {
      await onResetDemo();
      setConfirmResetPending(false);
    } finally {
      setIsResetting(false);
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
            Gestion des banques tunisiennes, contacts de confirmation d'achat de devises, fournisseurs internationaux et profils habilités.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {confirmResetPending && (
            <button
              type="button"
              onClick={() => setConfirmResetPending(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            onClick={handleResetDemoData}
            disabled={isResetting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${
              confirmResetPending
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                : 'text-amber-800 bg-amber-50 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>
              {confirmResetPending ? 'Confirmer la réinitialisation ?' : 'Réinitialiser les données démo'}
            </span>
          </button>
        </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Établissements Bancaires Tunisiens & Contacts de Confirmation
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Les personnes concernées et adresses email configurées ici apparaissent automatiquement sur les lettres et PDF de confirmation d'achat de devises.
                </p>
              </div>
              <button
                type="button"
                onClick={openAddBankModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une Banque</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {banks.map(b => {
                const contacts = normalizeBankConfirmationContacts(
                  b.confirmationContacts,
                  b.contactEmails
                );
                return (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-sm text-blue-800">{b.code}</span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {b.swiftCode}
                          </span>
                        </div>
                        {onUpdateBank && (
                          <button
                            type="button"
                            onClick={() => openEditBankModal(b)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-md transition-colors"
                            title="Modifier la banque et ses contacts confirmation"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modifier</span>
                          </button>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-900">{b.name}</div>
                        <div className="text-[11px] text-slate-500">{b.contactAgency || 'Agence Kairouan'}</div>
                      </div>

                      {(b.tradingDeskName || b.tradingDeskFax || b.tradingDeskPhone) && (
                        <div className="text-[11px] text-slate-600 bg-white/80 border border-slate-200/80 rounded-lg px-2.5 py-1.5 space-y-0.5">
                          {b.tradingDeskName && (
                            <div className="font-semibold text-slate-700 truncate">{b.tradingDeskName}</div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                            {b.tradingDeskFax && (
                              <span className="inline-flex items-center gap-1">
                                <Printer className="w-3 h-3 text-slate-400" />
                                Fax: {b.tradingDeskFax}
                              </span>
                            )}
                            {b.tradingDeskPhone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                Tél: {b.tradingDeskPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-1 border-t border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-blue-600" />
                            Contacts Confirmation ({contacts.length})
                          </span>
                        </div>
                        {contacts.length > 0 ? (
                          <ul className="space-y-1">
                            {contacts.map((c, idx) => (
                              <li
                                key={c.id || `${c.email}_${idx}`}
                                className="text-[11px] bg-white rounded-md border border-slate-200/80 px-2 py-1.5 space-y-0.5"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                                    {formatContactOrderTypesTag(c.orderTypes)}
                                  </span>
                                  {c.name && (
                                    <span className="font-semibold text-slate-800 truncate">
                                      {c.name}
                                      {c.role && (
                                        <span className="font-normal text-slate-500"> — {c.role}</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="text-blue-700 underline break-all font-mono text-[10px]">
                                  {c.email}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-[11px] italic text-slate-400">
                            Aucun contact email configuré
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <p className="text-xs font-semibold text-slate-900">Statut En attente d'achat devise</p>
                <p className="text-[11px] text-slate-500">
                  Lorsque la négociation du cours est exigée, le dépôt bancaire oriente automatiquement l'ordre vers le vivier d'appels d'offres de change.
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
                <p className="text-xs font-semibold text-slate-900">Exécution SWIFT (Statut Exécuté)</p>
                <p className="text-[11px] text-slate-500">
                  La validation du cours négocié dans le Module 02 alimentera directement le taux final retenu et pré-remplira la clôture SWIFT de l'ordre.
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

      {/* Bank Modal (Create or Edit + Concerned Persons & Confirmation Emails) */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveBank}
            className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 my-6"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingBank
                    ? `Modifier la Banque : ${editingBank.name} (${editingBank.code})`
                    : "Ajout d'une Banque Partenaire"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configurez les coordonnées de la salle de change et les personnes concernées par les lettres de confirmation d'achat de devises.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBankModal(false);
                  setEditingBank(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bankFormError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{bankFormError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code Banque *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : BIAT, STB"
                    value={bankCode}
                    onChange={e => setBankCode(e.target.value)}
                    className="w-full text-xs font-mono uppercase p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code SWIFT *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : BIATTNTT"
                    value={bankSwift}
                    onChange={e => setBankSwift(e.target.value)}
                    className="w-full text-xs font-mono uppercase p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nom Complet de la Banque *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex : Banque Internationale Arabe de Tunisie"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Agence de rattachement</label>
                  <input
                    type="text"
                    placeholder="Ex : Agence Kairouan République"
                    value={bankAgency}
                    onChange={e => setBankAgency(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Coordonnées Salle de Change */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Salle de change / Destinataire
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : BNA SALLE DE CHANGE"
                    value={bankTradingDeskName}
                    onChange={e => setBankTradingDeskName(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Fax Salle de change</label>
                  <input
                    type="text"
                    placeholder="Ex : 70.257.362"
                    value={bankTradingDeskFax}
                    onChange={e => setBankTradingDeskFax(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    placeholder="Ex : 71.336.472"
                    value={bankTradingDeskPhone}
                    onChange={e => setBankTradingDeskPhone(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Personnes concernées & Emails pour la Confirmation */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>Personnes concernées & Emails pour la Confirmation</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ces destinataires figureront en pied de page des confirmations d'achat de devises générées pour cette banque.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddContactRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Ajouter une personne / email</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {bankContacts.map((row, idx) => (
                    <div
                      key={row.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                    >
                      {/* Types d'ordres concernés AVANT la personne concernée */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Types d'ordres reçus #{idx + 1} :
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ALL_ORDER_TRANSFER_TYPES.map(orderType => {
                            const checked = row.orderTypes.includes(orderType);
                            return (
                              <label
                                key={orderType}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer select-none transition-colors ${
                                  checked
                                    ? 'bg-blue-50 border-blue-400 text-blue-800'
                                    : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleContactOrderType(row.id, orderType)}
                                  aria-label={`${ORDER_TRANSFER_TYPE_SHORT_LABELS[orderType]} pour le contact ${idx + 1}`}
                                  className="w-3 h-3 rounded accent-blue-600"
                                />
                                <span>{ORDER_TRANSFER_TYPE_SHORT_LABELS[orderType]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-4">
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Personne concernée #{idx + 1}
                          </label>
                          <input
                            type="text"
                            placeholder="Ex : Wassim Attia"
                            value={row.name}
                            onChange={e => handleUpdateContactRow(row.id, 'name', e.target.value)}
                            className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-3">
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Fonction / Service
                          </label>
                          <input
                            type="text"
                            placeholder="Ex : Salle de change"
                            value={row.role}
                            onChange={e => handleUpdateContactRow(row.id, 'role', e.target.value)}
                            className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                        <div className="col-span-10 sm:col-span-4">
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Email *
                          </label>
                          <input
                            type="email"
                            placeholder="prenom.nom@banque.tn"
                            value={row.email}
                            onChange={e => handleUpdateContactRow(row.id, 'email', e.target.value)}
                            className="w-full text-xs font-mono p-1.5 bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveContactRow(row.id)}
                            aria-label={`Supprimer le contact ${idx + 1}`}
                            title="Supprimer cette ligne"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowBankModal(false);
                  setEditingBank(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSavingBank}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs disabled:opacity-60"
              >
                {isSavingBank
                  ? 'Enregistrement...'
                  : editingBank
                  ? 'Mettre à jour la Banque'
                  : 'Enregistrer la Banque'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

