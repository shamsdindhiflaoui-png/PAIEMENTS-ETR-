import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, AlertCircle, DollarSign, Calculator } from 'lucide-react';
import { PaymentOrder, User } from '../types/payment';
import { formatTndCurrency } from '../utils/workflowRules';

interface ExecutionModalProps {
  order: PaymentOrder;
  currentUser: User;
  onClose: () => void;
  onSubmit: (executionData: Partial<PaymentOrder>) => Promise<void>;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  order,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [executionDate, setExecutionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [executingBank, setExecutingBank] = useState<string>(
    order.exchangeTransaction?.selectedBankName || order.bankName || 'Société Tunisienne de Banque'
  );
  const [executedAmount, setExecutedAmount] = useState<number>(order.amount);
  const defaultRate =
    order.finalExchangeRate ||
    order.exchangeTransaction?.finalNegotiatedRate ||
    (order.currency === 'USD' ? 3.1200 : order.currency === 'EUR' ? 3.3350 : 3.2000);
  const [finalExchangeRate, setFinalExchangeRate] = useState<string>(String(defaultRate));
  const [accountDebitDate, setAccountDebitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [swiftReference, setSwiftReference] = useState<string>(`SWIFT-MT103-${order.orderNumber.replace('OP-', '')}`);
  const [bankFees, setBankFees] = useState<string>('350.000');
  const [debitAmountTnd, setDebitAmountTnd] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto calculate TND debit
  useEffect(() => {
    const rate = parseFloat(finalExchangeRate);
    const fees = parseFloat(bankFees) || 0;
    if (!isNaN(rate) && rate > 0) {
      const calculated = executedAmount * rate + fees;
      setDebitAmountTnd(Number(calculated.toFixed(3)));
    } else {
      setDebitAmountTnd(0);
    }
  }, [executedAmount, finalExchangeRate, bankFees]);

  const handleConfirm = async () => {
    setErrorMsg(null);
    if (!swiftReference.trim()) {
      setErrorMsg('La référence du message SWIFT MT103 est obligatoire pour clôturer le transfert.');
      return;
    }
    const rate = parseFloat(finalExchangeRate);
    if (isNaN(rate) || rate <= 0) {
      setErrorMsg('Le taux de change final négocié est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        executionDate,
        executingBank,
        executedAmount,
        finalExchangeRate: rate,
        debitAmountTnd,
        accountDebitDate,
        swiftReference,
        bankFees: parseFloat(bankFees) || 0,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la clôture');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Enregistrement de l'Exécution du Virement SWIFT
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs grid grid-cols-3 gap-2">
          <div>
            <span className="text-slate-500">Ordre :</span>
            <p className="font-mono font-bold text-blue-800 mt-0.5">{order.orderNumber}</p>
          </div>
          <div>
            <span className="text-slate-500">Bénéficiaire :</span>
            <p className="font-semibold text-slate-900 mt-0.5 truncate">{order.beneficiaryName}</p>
          </div>
          <div>
            <span className="text-slate-500">Montant Initial :</span>
            <p className="font-mono font-bold text-slate-900 mt-0.5">{order.amount} {order.currency}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date d'Exécution SWIFT <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={executionDate}
                onChange={e => setExecutionDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Banque Exécutante
              </label>
              <input
                type="text"
                value={executingBank}
                onChange={e => setExecutingBank(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Référence SWIFT MT103 (Obligatoire) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex : SWIFT-MT103-STB-998124"
                value={swiftReference}
                onChange={e => setSwiftReference(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Taux de Change Final Négocié (TND) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.0001"
                placeholder="Ex : 3.3320"
                value={finalExchangeRate}
                onChange={e => setFinalExchangeRate(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Commissions & Frais Bancaires (TND)
              </label>
              <input
                type="number"
                step="0.001"
                value={bankFees}
                onChange={e => setBankFees(e.target.value)}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date de Débit du Compte
              </label>
              <input
                type="date"
                value={accountDebitDate}
                onChange={e => setAccountDebitDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Auto calculated TND Counter-value */}
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-800">
                Contre-valeur totale débitée du compte MTK :
              </span>
              <p className="text-[11px] text-emerald-700">
                Calcul : ({executedAmount} {order.currency} × {finalExchangeRate || 0}) + {bankFees} TND frais
              </p>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-950 tabular-nums">
              {formatTndCurrency(debitAmountTnd)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
          >
            Clôturer & Marquer EXÉCUTÉ
          </button>
        </div>
      </div>
    </div>
  );
};
