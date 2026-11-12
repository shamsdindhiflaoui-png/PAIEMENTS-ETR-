import React, { useState } from 'react';
import {
  FileText,
  UserCheck,
  CreditCard,
  Paperclip,
  GitBranch,
  Building2,
  Printer,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Send,
  Building,
  Upload,
  Calendar,
  Lock,
  Download,
  Eye,
  Info,
  DollarSign,
  Ban,
} from 'lucide-react';
import { PaymentOrder, User, PaymentStatus, DocumentType } from '../types/payment';
import { STATUS_META, formatForeignCurrency, formatTndCurrency } from '../utils/workflowRules';

interface OrderDetailViewProps {
  order: PaymentOrder;
  currentUser: User;
  onBack: () => void;
  onStatusChange: (targetStatus: PaymentStatus, comment: string) => Promise<void>;
  onOpenDepositModal: () => void;
  onOpenExecutionModal: () => void;
  onOpenReviewModal: () => void;
  onPrintOrder: () => void;
  onAddDocument: (doc: any) => Promise<void>;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  currentUser,
  onBack,
  onStatusChange,
  onOpenDepositModal,
  onOpenExecutionModal,
  onOpenReviewModal,
  onPrintOrder,
  onAddDocument,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('AUTRE');

  const meta = STATUS_META[order.status] || STATUS_META.BROUILLON;

  // Handle direct file upload in tab 4
  const handleUploadDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      await onAddDocument({
        name: file.name,
        type: uploadDocType,
        size: file.size,
        mimeType: file.type || 'application/pdf',
        dataBase64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) return;
    await onStatusChange('ANNULE', cancelReason);
    setCancelModalOpen(false);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Retour à la liste"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-mono text-blue-700">
                {order.orderNumber}
              </span>
              {order.isDemo && (
                <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                  DONNÉE DE DÉMO
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                <span>{meta.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{order.purpose}</p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <button
            onClick={onPrintOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimer Ordre</span>
          </button>

          {/* Action 1: Transmit to CG if SAISI or BROUILLON */}
          {(order.status === 'BROUILLON' || order.status === 'SAISI' || order.status === 'RETOURNE_CORRECTION') && (
            <button
              onClick={() => onStatusChange('TRANSMIS_CG', 'Transmission au Contrôle de Gestion pour validation')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span>Transmettre au Contrôle</span>
            </button>
          )}

          {/* Action 2: Review by Contrôle de Gestion */}
          {order.status === 'TRANSMIS_CG' && (
            <button
              onClick={onOpenReviewModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Décision Contrôle de Gestion</span>
            </button>
          )}

          {/* Action 3: Record Bank Deposit after CG validation */}
          {order.status === 'VALIDE_CG' && (
            <button
              onClick={onOpenDepositModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            >
              <Building className="w-4 h-4" />
              <span>Enregistrer Dépôt Banque</span>
            </button>
          )}

          {/* Action 4: Record Transfer Execution */}
          {(order.status === 'DEPOSE_BANQUE' || order.status === 'ATTENTE_NEGOCIATION' || order.status === 'TAUX_VALIDE' || order.status === 'EN_COURS_EXECUTION') && (
            <button
              onClick={onOpenExecutionModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Enregistrer Exécution SWIFT</span>
            </button>
          )}

          {/* Action 5: Administrative Cancellation (Traceable, non-destructive) */}
          {order.status !== 'EXECUTE' && order.status !== 'ANNULE' && order.status !== 'REJETE' && (
            <button
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              title="Annuler l'ordre avec motif obligatoire"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Annuler</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 Tabs Navigation Header */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 pt-2 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200">
          {[
            { id: 1, label: 'Général', icon: FileText },
            { id: 2, label: 'Bénéficiaire', icon: UserCheck },
            { id: 3, label: 'Financier & Banque', icon: CreditCard },
            { id: 4, label: `Documents (${order.documents.length})`, icon: Paperclip },
            { id: 5, label: `Circuit & Historique (${order.history.length})`, icon: GitBranch },
            { id: 6, label: 'Dépôt & Exécution SWIFT', icon: Building2 },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {/* TAB 1: Informations Générales */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Numéro d'Ordre</div>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">{order.orderNumber}</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Contrat / Marché</div>
                  <div className="text-sm font-bold font-mono text-blue-900 mt-1">{order.contractNumber || '—'}</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Type Transfert</div>
                  <div className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-semibold">
                      {order.transferType || 'VIREMENT'}
                    </span>
                    {order.lcNumber && (
                      <span className="text-[11px] font-mono text-slate-600">N° {order.lcNumber}</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Statut Actuel</div>
                  <div className="text-xs font-bold text-slate-900 mt-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>{meta.label}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Initiateur du dossier
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{order.createdBy}</div>
                  <div className="text-xs text-blue-700 font-medium">{order.department}</div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Dernière mise à jour
                  </div>
                  <div className="text-sm font-mono text-slate-900">
                    {new Date(order.updatedAt).toLocaleString('fr-FR')}
                  </div>
                  <div className="text-xs text-slate-500">Horodatage certifié sur le serveur MTK</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Objet Détaillé du Règlement
                </div>
                <div className="text-xs text-slate-700 leading-relaxed font-medium">
                  {order.purpose}
                </div>
                {order.remarks && (
                  <div className="pt-2 mt-2 border-t border-slate-100 text-xs text-slate-500">
                    <strong>Observations :</strong> {order.remarks}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Bénéficiaire */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Raison Sociale / Fournisseur
                  </div>
                  <div className="text-sm font-bold text-slate-900">{order.beneficiaryName}</div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Pays de Destination
                  </div>
                  <div className="text-sm font-bold text-slate-900">{order.beneficiaryCountry}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                <div className="text-[11px] font-medium text-slate-500 uppercase">
                  Adresse Complète du Siège
                </div>
                <div className="text-xs text-slate-800 font-medium">
                  {order.beneficiaryAddress || 'Non spécifiée'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Banque Bénéficiaire
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {order.beneficiaryBank || '—'}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    IBAN / Numéro de Compte
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 break-all">
                    {order.beneficiaryIban || '—'}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">
                    Code SWIFT / BIC
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-700">
                    {order.beneficiarySwift || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Financier & Domiciliation */}
          {activeTab === 3 && (
            <div className="space-y-6">
              {/* Highlight Amount Box */}
              <div className="p-6 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                    Montant du Virement International
                  </div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-blue-950 mt-1">
                    {formatForeignCurrency(order.amount, order.currency)}
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-xs text-slate-500">Devise de règlement</div>
                  <div className="text-sm font-bold text-slate-800">{order.currency}</div>
                </div>
              </div>

              {/* Amount in Words */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  Montant en toutes lettres :
                </div>
                <div className="text-sm font-medium italic text-slate-900">
                  « {order.amountInWords || '—'} »
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Contrat / Marché</div>
                  <div className="text-xs font-mono font-bold text-blue-900">{order.contractNumber || '—'}</div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Réf Facture</div>
                  <div className="text-xs font-mono font-bold text-slate-900">{order.invoiceNumber}</div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Type Transfert & N° LC</div>
                  <div className="text-xs font-mono font-bold text-blue-700">
                    {order.transferType || 'VIREMENT'} {order.lcNumber ? `(${order.lcNumber})` : ''}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Nature de l'Opération</div>
                  <div className="text-xs font-semibold text-slate-800">{order.operationNature}</div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Banque Tunisienne MTK (Domiciliataire)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Établissement :</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{order.bankName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Agence :</span>
                    <p className="font-medium text-slate-800 mt-0.5">{order.bankBranch || 'Agence Kairouan'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Réf Dossier :</span>
                    <p className="font-mono text-slate-800 mt-0.5">{order.bankFileRef || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Documents Justificatifs */}
          {activeTab === 4 && (
            <div className="space-y-6">
              {/* Upload bar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    Joindre une pièce :
                  </span>
                  <select
                    value={uploadDocType}
                    onChange={e => setUploadDocType(e.target.value as any)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="FACTURE">Facture</option>
                    <option value="DOMICILIATION">Fiche Domiciliation</option>
                    <option value="CONTRAT">Contrat / Bon Commande</option>
                    <option value="BORDEREAU_DEPOT">Bordereau Dépôt</option>
                    <option value="AVIS_DEBIT_SWIFT">Avis Débit SWIFT</option>
                    <option value="AUTRE">Autre Justificatif</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-4 h-4" />
                  <span>Téléverser un document</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleUploadDoc}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Document List */}
              <div className="space-y-3">
                {order.documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{doc.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-blue-700">{doc.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{(doc.size / 1024).toFixed(1)} Ko</span>
                          <span aria-hidden="true">·</span>
                          <span>Déposé par {doc.uploadedBy} le {doc.uploadedAt.split('T')[0]}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {doc.dataBase64 ? (
                        <a
                          href={doc.dataBase64}
                          download={doc.name}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => alert(`Téléchargement de la pièce : ${doc.name}`)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {order.documents.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">
                    Aucune pièce justificative jointe à cet ordre
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Circuit de Traitement et Historique */}
          {activeTab === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Traçabilité & Historique Chronologique Inaltérable
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chaque transition de statut est journalisée avec date, heure, utilisateur et commentaire.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  {order.history.length} événement(s)
                </div>
              </div>

              {/* Chronological Timeline */}
              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                {order.history.map((h, i) => {
                  const toMeta = STATUS_META[h.toStatus] || STATUS_META.BROUILLON;
                  return (
                    <div key={h.id || i} className="relative flex items-start gap-4">
                      {/* Timeline dot */}
                      <div className="w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shrink-0 -ml-[23px] shadow-2xs">
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                      </div>

                      <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${toMeta.badgeBg} ${toMeta.badgeText} ${toMeta.badgeBorder}`}
                            >
                              {toMeta.label}
                            </span>
                            {h.fromStatus !== 'INITIAL' && (
                              <span className="text-[11px] text-slate-400">
                                (ex: {STATUS_META[h.fromStatus]?.label})
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {new Date(h.timestamp).toLocaleString('fr-FR')}
                          </div>
                        </div>

                        <div className="text-xs text-slate-800 font-medium">
                          {h.comment || 'Transition effectuée'}
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center gap-2">
                          <span className="font-semibold text-slate-700">{h.userName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{h.userRole}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: Dépôt Bancaire & Exécution SWIFT */}
          {activeTab === 6 && (
            <div className="space-y-6">
              {/* Sub-section 1: Dépôt Bancaire */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Suivi du Dépôt Bancaire
                    </h4>
                  </div>
                  {order.deposit ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Dépôt Enregistré
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Non déposé</span>
                  )}
                </div>

                {order.deposit ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Banque de dépôt :</span>
                      <p className="font-bold text-slate-900 mt-0.5">{order.deposit.bankName}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Date du dépôt physique :</span>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">{order.deposit.depositDate}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">N° de Bordereau :</span>
                      <p className="font-mono font-bold text-blue-700 mt-0.5">{order.deposit.slipNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Réf bancaire attribuée :</span>
                      <p className="font-mono text-slate-900 mt-0.5">{order.deposit.bankReference || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Agent dépositaire :</span>
                      <p className="font-medium text-slate-900 mt-0.5">{order.deposit.depositedBy}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Notes de remise :</span>
                      <p className="text-slate-700 mt-0.5">{order.deposit.notes || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 flex items-center justify-between">
                    <span>Le dossier n'a pas encore fait l'objet d'un dépôt physique en agence bancaire.</span>
                    {order.status === 'VALIDE_CG' && (
                      <button
                        onClick={onOpenDepositModal}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                      >
                        Enregistrer maintenant
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-section 2: Exécution du Virement SWIFT */}
              <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      2. Exécution du Transfert & Débit Compte
                    </h4>
                  </div>
                  {order.status === 'EXECUTE' ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Transfert Exécuté & Clôturé
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">En attente d'exécution</span>
                  )}
                </div>

                {order.status === 'EXECUTE' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] uppercase">Réf SWIFT MT103</span>
                      <p className="font-mono font-bold text-blue-800 mt-1">{order.swiftReference}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] uppercase">Taux de Change Négocié</span>
                      <p className="font-mono font-bold text-slate-900 mt-1">
                        {order.finalExchangeRate ? order.finalExchangeRate.toFixed(4) : '—'} TND
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-emerald-800 text-[11px] uppercase font-semibold">
                        Contre-valeur Débitée TND
                      </span>
                      <p className="font-mono font-bold text-emerald-950 text-sm mt-1">
                        {order.debitAmountTnd ? formatTndCurrency(order.debitAmountTnd) : '—'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] uppercase">Date de Débit Compte</span>
                      <p className="font-mono text-slate-900 mt-1">{order.accountDebitDate || order.executionDate}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 flex items-center justify-between">
                    <span>
                      Les informations de dénouement (message SWIFT, cours négocié et commissions) seront renseignées lors de la clôture.
                    </span>
                    {(order.status === 'DEPOSE_BANQUE' || order.status === 'TAUX_VALIDE' || order.status === 'EN_COURS_EXECUTION') && (
                      <button
                        onClick={onOpenExecutionModal}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700"
                      >
                        Saisir exécution
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sub-section 3: Préparation pour Module 02 */}
              <div className="p-5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs uppercase tracking-wider">
                  <DollarSign className="w-4 h-4 text-purple-700" />
                  <span>Passerelle Module 02 : Consultation & Négociation de Change</span>
                </div>
                <p className="text-xs text-purple-950 leading-relaxed">
                  Cet ordre de paiement est structuré pour s'interconnecter avec le module de cotations multi-banques (salle des marchés).
                  {order.exchangeTransaction?.savingsTnd ? (
                    <span className="font-semibold block mt-1 text-emerald-800">
                      Économie estimée réalisée sur la négociation : {formatTndCurrency(order.exchangeTransaction.savingsTnd)}
                    </span>
                  ) : (
                    <span className="block mt-1 text-slate-600">
                      Dès le dépôt bancaire, l'ordre est disponible pour la mise en concurrence des devises.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Annulation administrative de l'ordre</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conformément à la réglementation DFC, un ordre engagé ne peut être supprimé. L'annulation sera tracée dans le journal d'audit.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif obligatoire de l'annulation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex : Annulation de la commande par le fournisseur, erreur de domiciliation, etc."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Retour
              </button>
              <button
                disabled={!cancelReason.trim()}
                onClick={handleCancelOrder}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg disabled:opacity-50"
              >
                Confirmer l'Annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
