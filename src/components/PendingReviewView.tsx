import React, { useState } from 'react';
import {
  Clock,
  Building,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { PaymentOrder, User } from '../types/payment';
import { formatForeignCurrency } from '../utils/workflowRules';

interface PendingReviewViewProps {
  orders: PaymentOrder[];
  currentUser: User;
  onSelectOrder: (orderId: string) => void;
  onReviewDecision: (order: PaymentOrder, decision: 'SIGNE' | 'SAISI' | 'ANNULE', comment: string) => Promise<void>;
  onOpenDeposit: (order: PaymentOrder) => void;
}

export const PendingReviewView: React.FC<PendingReviewViewProps> = ({
  orders,
  currentUser,
  onSelectOrder,
  onReviewDecision,
  onOpenDeposit,
}) => {
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<PaymentOrder | null>(null);
  const [decisionType, setDecisionType] = useState<'SIGNE' | 'SAISI' | 'ANNULE'>('SIGNE');
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Group pending orders for Stage 2 (Transmis pour signature) and Stage 3 (Signé -> Dépôt)
  const pendingSignature = orders.filter(o => o.status === 'TRANSMIS_SIGNATURE');
  const pendingDeposit = orders.filter(o => o.status === 'SIGNE');

  const openDecisionModal = (order: PaymentOrder, type: 'SIGNE' | 'SAISI' | 'ANNULE') => {
    setSelectedOrderForModal(order);
    setDecisionType(type);
    setComment(
      type === 'SIGNE'
        ? 'Vérification effectuée. Ordre signé et autorisé pour remise bancaire.'
        : ''
    );
  };

  const handleConfirmDecision = async () => {
    if (!selectedOrderForModal) return;
    if ((decisionType === 'SAISI' || decisionType === 'ANNULE') && !comment.trim()) {
      alert('Le motif est obligatoire pour un retour en Saisi (Brouillon) ou une annulation.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onReviewDecision(selectedOrderForModal, decisionType, comment);
      setSelectedOrderForModal(null);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du traitement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              Espace Signature & Dépôt Bancaire DFC
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Validation et signature des ordres transmis, puis remise en banque (avec ou sans négociation du cours).
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
            <strong>{pendingSignature.length}</strong> en attente de signature
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-medium">
            <strong>{pendingDeposit.length}</strong> signés à déposer en banque
          </div>
        </div>
      </div>

      {/* Section 1: Transmis pour signature */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Ordres transmis en attente de signature ({pendingSignature.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Habilitation requise : Responsable Financier, Contrôle de Gestion ou Administrateur
          </span>
        </div>

        <div className="space-y-3">
          {pendingSignature.map(order => (
            <div
              key={order.id}
              className="p-4 rounded-xl border border-slate-200 hover:border-amber-300 bg-slate-50/50 hover:bg-white transition-all shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono font-bold text-blue-700 text-xs">
                    {order.orderNumber}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {order.beneficiaryName} ({order.beneficiaryCountry})
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {order.createdAt.split('T')[0]}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      order.requiresRateNegotiation
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {order.requiresRateNegotiation ? 'Négociation cours exigée' : 'Dépôt direct'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">{order.purpose}</div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>Facture : <strong className="text-slate-700 font-mono">{order.invoiceNumber}</strong></span>
                  <span>·</span>
                  <span>Contrat : <strong className="text-slate-700 font-mono">{order.contractNumber || '—'}</strong></span>
                  <span>·</span>
                  <span>{order.documents.length} document(s) joint(s)</span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatForeignCurrency(order.amount, order.currency)}
                  </div>
                  <div className="text-[10px] text-blue-700 font-medium">{order.bankName}</div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectOrder(order.id)}
                    className="px-2.5 py-1.5 text-xs text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors font-medium"
                    title="Examiner le dossier complet"
                  >
                    Détails
                  </button>
                  <button
                    onClick={() => openDecisionModal(order, 'SAISI')}
                    className="px-2.5 py-1.5 text-xs text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors font-semibold"
                    title="Renvoyer en Saisi (Brouillon) avec motif"
                  >
                    Retourner (Saisi)
                  </button>
                  <button
                    onClick={() => openDecisionModal(order, 'SIGNE')}
                    className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors font-bold shadow-2xs"
                  >
                    Signer l'ordre
                  </button>
                </div>
              </div>
            </div>
          ))}

          {pendingSignature.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">
              Aucun ordre en attente de signature.
            </p>
          )}
        </div>
      </div>

      {/* Section 2: Signés en attente de Dépôt Bancaire */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Ordres signés en attente de dépôt à la banque ({pendingDeposit.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Orientation automatique : Déposé à la banque ou En attente d'achat devise
          </span>
        </div>

        <div className="space-y-3">
          {pendingDeposit.map(order => (
            <div
              key={order.id}
              className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-white transition-all shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono font-bold text-blue-700 text-xs">
                    {order.orderNumber}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {order.beneficiaryName}
                  </span>
                  <span className="text-blue-700 font-semibold text-[10px] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                    Signé
                  </span>
                  <span
                    className={`font-semibold text-[10px] px-1.5 py-0.2 rounded border ${
                      order.requiresRateNegotiation
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {order.requiresRateNegotiation
                      ? "→ En attente d'achat devise"
                      : '→ Déposé à la banque'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">{order.purpose}</div>
                <div className="text-[11px] text-slate-500">
                  Banque domiciliataire : <strong className="text-slate-800">{order.bankName}</strong> ({order.bankBranch || 'Kairouan'})
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatForeignCurrency(order.amount, order.currency)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectOrder(order.id)}
                    className="px-2.5 py-1.5 text-xs text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors font-medium"
                  >
                    Fiche
                  </button>
                  <button
                    onClick={() => onOpenDeposit(order)}
                    className="px-3.5 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-bold shadow-2xs flex items-center gap-1"
                  >
                    <span>Enregistrer Bordereau Dépôt</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {pendingDeposit.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">
              Aucun ordre signé en attente de dépôt en banque.
            </p>
          )}
        </div>
      </div>

      {/* Decision Modal */}
      {selectedOrderForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {decisionType === 'SIGNE'
                  ? "Signature officielle de l'ordre"
                  : decisionType === 'SAISI'
                  ? 'Retour en Saisi (Brouillon)'
                  : 'Annulation administrative de l’ordre'}
              </h3>
              <span className="font-mono text-xs font-bold text-blue-700">
                {selectedOrderForModal.orderNumber}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700 border border-slate-200">
              <div><strong>Fournisseur :</strong> {selectedOrderForModal.beneficiaryName}</div>
              <div><strong>Montant :</strong> {formatForeignCurrency(selectedOrderForModal.amount, selectedOrderForModal.currency)}</div>
              <div><strong>Contrat / Marché :</strong> {selectedOrderForModal.contractNumber || '—'}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Commentaire ou motif officiel <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder={
                  decisionType === 'SIGNE'
                    ? 'Indiquez la confirmation de signature (ex : Ordre visé et signé par la DFC)'
                    : 'Précisez le motif du retour en brouillon (Saisi)'
                }
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedOrderForModal(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={isSubmitting || !comment.trim()}
                onClick={handleConfirmDecision}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-2xs transition-colors ${
                  decisionType === 'SIGNE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionType === 'SAISI'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {decisionType === 'SIGNE'
                  ? "Confirmer la Signature"
                  : decisionType === 'SAISI'
                  ? 'Renvoyer en Saisi'
                  : "Confirmer l'Annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
