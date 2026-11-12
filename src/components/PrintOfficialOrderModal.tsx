import React from 'react';
import { X, Printer, Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { PaymentOrder } from '../types/payment';
import { formatForeignCurrency } from '../utils/workflowRules';

interface PrintOfficialOrderModalProps {
  order: PaymentOrder;
  onClose: () => void;
}

export const PrintOfficialOrderModal: React.FC<PrintOfficialOrderModalProps> = ({
  order,
  onClose,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl max-w-3xl w-full my-8 shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Top Control Bar (hidden on print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold">Aperçu avant impression · Ordre de Virement MTK</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer le document officiel</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-4 h-4" />
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE PAGE CONTENT */}
        <div className="p-8 sm:p-12 text-slate-900 space-y-6 print:p-0 print:m-0 bg-white">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-slate-900">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                RÉPUBLIQUE TUNISIENNE
              </div>
              <h1 className="text-base font-extrabold uppercase tracking-tight text-slate-950 mt-0.5">
                Manufacture des Tabacs de Kairouan (MTK)
              </h1>
              <div className="text-xs font-semibold text-blue-900 mt-0.5">
                Direction Financière et Comptable · Service Règlements Extérieurs
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Route de Mansoura, B.P. 106 - 3100 Kairouan · MF : 0012345/P/A/M/000
              </div>
            </div>

            <div className="text-right border border-slate-900 p-3 rounded-sm bg-slate-50 min-w-[200px]">
              <div className="text-[10px] font-bold text-slate-500 uppercase">ORDRE DE PAIEMENT N°</div>
              <div className="text-sm font-black font-mono text-slate-900 mt-0.5">{order.orderNumber}</div>
              <div className="text-[10px] text-slate-600 mt-1 font-mono">
                Date : {order.createdAt.split('T')[0]} {order.contractNumber ? `· Contrat : ${order.contractNumber}` : ''}
              </div>
            </div>
          </div>

          <div className="text-center py-2 bg-slate-100 border-y border-slate-300">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              ORDRE DE VIREMENT BANCAIRE INTERNATIONAL (TRANSFERT À L'ÉTRANGER)
            </h2>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Émis conformément aux dispositions de la Réglementation des Changes de la Banque Centrale de Tunisie (BCT)
            </p>
          </div>

          {/* Destinataire Bancaire Local & Mode de Transfert */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 border border-slate-300 rounded-sm space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">À l'attention de la banque :</span>
              <p className="font-bold text-slate-900 text-xs">{order.bankName}</p>
              <p className="text-[11px] text-slate-700">{order.bankBranch || 'Agence Kairouan'}</p>
              <p className="text-[11px] font-mono text-blue-900 font-semibold">
                Transfert : {order.transferType || 'VIREMENT'} {order.lcNumber ? `(N° LC/Remise: ${order.lcNumber})` : ''}
              </p>
            </div>

            <div className="p-3 border border-slate-300 rounded-sm space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Donneur d'ordre (Débit) :</span>
              <p className="font-bold text-slate-900 text-xs">Manufacture des Tabacs de Kairouan (MTK)</p>
              <p className="text-[11px] text-slate-700">Compte MTK en devises / convertibles</p>
              <p className="text-[11px] font-mono text-slate-600">
                {order.contractNumber ? `Réf. Contrat : ${order.contractNumber}` : `Initiateur : ${order.createdBy}`}
              </p>
            </div>
          </div>

          {/* Bénéficiaire & Coordonnées Bancaires Étrangères */}
          <div className="p-3 border border-slate-300 rounded-sm text-xs space-y-2">
            <div className="text-[10px] font-bold uppercase text-slate-500 pb-1 border-b border-slate-200">
              Bénéficiaire du Transfert & Coordonnées Bancaires Internationales
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400">Raison Sociale Fournisseur :</span>
                <p className="font-bold text-slate-900 text-xs">{order.beneficiaryName}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{order.beneficiaryAddress}</p>
                <p className="text-[11px] font-medium text-slate-800">{order.beneficiaryCountry}</p>
              </div>

              <div className="space-y-1 font-mono">
                <div>
                  <span className="text-[10px] font-sans text-slate-400">Banque Bénéficiaire : </span>
                  <strong className="text-slate-900">{order.beneficiaryBank || '—'}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-400">Code BIC / SWIFT : </span>
                  <strong className="text-blue-900 font-bold">{order.beneficiarySwift || '—'}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-sans text-slate-400">IBAN / N° Compte : </span>
                  <strong className="text-slate-900 break-all">{order.beneficiaryIban || '—'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Données Financières */}
          <div className="p-4 border-2 border-slate-900 rounded-sm bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-600">Montant en chiffres :</span>
                <div className="text-xl font-black font-mono text-slate-950">
                  {formatForeignCurrency(order.amount, order.currency)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-600">Devise :</span>
                <div className="text-lg font-bold font-mono text-slate-950">{order.currency}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-300">
              <span className="text-[10px] font-bold uppercase text-slate-600">Montant en toutes lettres :</span>
              <div className="text-xs font-bold text-slate-900 italic mt-0.5">
                « {order.amountInWords} »
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500">Facture de Référence : </span>
                <strong className="font-mono">{order.invoiceNumber}</strong> du {order.invoiceDate}
              </div>
              <div>
                <span className="text-slate-500">Nature de l'opération : </span>
                <strong>{order.operationNature}</strong>
              </div>
            </div>
          </div>

          {/* Objet & Instructions */}
          <div className="text-xs p-3 border border-slate-300 rounded-sm space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Motif du transfert SWIFT :</span>
            <p className="font-medium text-slate-800">{order.transferPurpose || order.purpose}</p>
          </div>

          {/* Visas et Signatures */}
          <div className="grid grid-cols-4 gap-2 pt-4 border-t-2 border-slate-900 text-center text-xs">
            <div className="p-2 border border-slate-300 rounded-sm min-h-[110px] flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-600">1. Agent Comptable</span>
              <div className="text-[10px] text-slate-400 font-mono">Visa & Date</div>
            </div>

            <div className="p-2 border border-slate-300 rounded-sm min-h-[110px] flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-600">2. Contrôle de Gestion</span>
              <div className="text-[10px] text-slate-400 font-mono">Visa Budgétaire</div>
            </div>

            <div className="p-2 border border-slate-300 rounded-sm min-h-[110px] flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-600">3. Directeur Financier</span>
              <div className="text-[10px] text-slate-400 font-mono">Bon à Exécuter</div>
            </div>

            <div className="p-2 border border-slate-300 rounded-sm min-h-[110px] flex flex-col justify-between bg-slate-50">
              <span className="text-[10px] font-bold uppercase text-slate-600">4. Banque Tunisienne</span>
              <div className="text-[10px] text-slate-400 font-mono">Cachet & Réf SWIFT</div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-[9px] text-slate-400 text-center pt-2 border-t border-slate-200">
            Document généré par l'application MTK International Payments · Direction Financière et Comptable · DFC
          </div>
        </div>
      </div>
    </div>
  );
};
