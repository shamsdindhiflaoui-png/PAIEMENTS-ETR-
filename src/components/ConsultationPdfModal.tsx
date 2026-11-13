import React from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import { CurrencyConsultation } from '../types/payment';
import {
  formatConsultationAmount,
  formatConsultationDate,
  formatConsultationTime,
  downloadConsultationPdf,
} from '../utils/consultationPdf';

interface ConsultationPdfModalProps {
  consultation: CurrencyConsultation;
  onClose: () => void;
}

export const ConsultationPdfModal: React.FC<ConsultationPdfModalProps> = ({
  consultation,
  onClose,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownloadPdf = () => {
    downloadConsultationPdf(consultation);
  };

  const handlePrint = () => {
    window.print();
  };

  const formattedAmount = formatConsultationAmount(consultation.totalAmount, consultation.currency);
  const formattedDate = formatConsultationDate(consultation.operationDate);
  const submissionTime = formatConsultationTime(consultation.submissionDeadlineTime);
  const validityTime = formatConsultationTime(consultation.validityDeadlineTime);
  const contactEmail = consultation.contactEmail || 'mtk.tn@mtk.tn';
  const contactPhone = consultation.contactPhone || '(77) 281 699';
  const faxNumbers = consultation.faxNumbers || '(77).287.200   (77).283.130';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl max-w-3xl w-full my-6 shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Top Control Bar (hidden on print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <div>
              <span className="text-xs font-bold block">
                Consultation {consultation.consultationNumber} · Document Officiel PDF
              </span>
              <span className="text-[11px] text-slate-300">
                Ordres inclus : {consultation.orderNumbers.join(', ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger le PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              aria-label="Fermer l'aperçu PDF"
            >
              <X className="w-4 h-4" />
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* Printable / Faithful MTK Consultation Letter Preview */}
        <div className="p-8 sm:p-14 bg-white text-black font-serif print:p-8">
          <div className="max-w-[600px] mx-auto space-y-6">
            {/* Header Gray Box */}
            <div className="border border-neutral-600 bg-neutral-200/90 text-center">
              <div className="px-4 py-2.5 border-b border-neutral-600 space-y-0.5 italic">
                <div className="text-[19px] tracking-wide leading-tight font-normal">
                  <span className="text-[22px]">M</span>ANUFACTURE DES{' '}
                  <span className="text-[22px]">T</span>ABACS DE{' '}
                  <span className="text-[22px]">K</span>AIROUAN
                </div>
                <div className="text-[12.5px]">B.P. 106 – 3100 KAIROUAN – TUNISIE</div>
                <div className="text-[12.5px]">R.C. N° : B4141995</div>
                <div className="text-[12.5px]">
                  TEL : (77) 281.309 – (77) 282.824 &nbsp; * &nbsp; FAX : (77) 283.130 - (77) 287.200
                </div>
              </div>
              <div className="px-4 py-2 font-bold italic text-[12.5px] space-y-0.5">
                <div>Expéditeur : Direction Financière</div>
                <div>
                  N.B. : En cas d’illisibilité du message, Veuillez nous contacter au {contactPhone}
                </div>
                <div>
                  E-mail :{' '}
                  <span className="text-blue-700 underline">{contactEmail}</span>
                </div>
              </div>
            </div>

            {/* TEXTE */}
            <div className="text-center font-bold italic text-[15px] pt-2">TEXTE</div>

            {/* Objet */}
            <div className="text-[15px] italic">
              <span className="font-bold underline">Objet :</span>{' '}
              <span>Consultation pour achat de devises.</span>
            </div>

            {/* Body */}
            <div className="text-[15px] italic space-y-3 pt-1">
              <p>
                La <strong className="font-bold">M.T.K.</strong> envisage d’acheter :
              </p>

              <ul className="pl-8 space-y-1.5 list-none">
                <li>
                  - &nbsp; Montant en devise :{' '}
                  <strong className="font-bold not-italic font-serif italic ml-1">
                    {formattedAmount}
                  </strong>
                </li>
                <li>
                  - &nbsp; Date d’opération : <span className="ml-1">{formattedDate}</span>
                </li>
                <li>
                  - &nbsp; Date valeur : <span className="ml-1">{consultation.purchaseType}</span>
                </li>
              </ul>

              <p className="leading-relaxed pt-1">
                A cet effet nous vous prions de nous communiquer par Email (
                <span className="text-blue-700 underline">{contactEmail}</span>) ou par fax, (en
                remplissant le tableau ci-après) votre meilleure cotation du jour de l’opération avant{' '}
                <strong className="font-bold underline">{submissionTime}</strong> (heure limite) aux
                numéros suivants :
              </p>

              <div className="text-center font-bold italic text-[15px] tracking-wide py-1.5">
                {faxNumbers}
              </div>

              <p className="leading-relaxed">
                Votre cotation demeure valable jusqu’à{' '}
                <strong className="font-bold underline">{validityTime}</strong>, heure limite de
                confirmation de l’achat par la M.T.K. par téléphone en attendant l’expédition du fax
                de confirmation.
              </p>

              <div className="pt-3 text-right space-y-3 pr-2">
                <p>Meilleures salutations.</p>
                <p className="font-bold">La Direction Financière</p>
              </div>
            </div>

            {/* Bottom Divider & Bank Table */}
            <div className="pt-10 space-y-3">
              <div className="h-1.5 bg-neutral-600 w-full" />
              <div className="text-center font-bold italic text-[14px]">
                A REMPLIR PAR LA BANQUE
              </div>

              <table className="w-full border-collapse border border-neutral-800 text-[14px] italic">
                <thead>
                  <tr>
                    <th className="border border-neutral-800 py-1.5 px-3 font-bold text-center w-1/3">
                      Banque
                    </th>
                    <th className="border border-neutral-800 py-1.5 px-3 font-bold text-center w-1/3">
                      Montant
                    </th>
                    <th className="border border-neutral-800 py-1.5 px-3 font-bold text-center w-1/3">
                      Cours
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-neutral-800 h-7" />
                    <td className="border border-neutral-800 h-7" />
                    <td className="border border-neutral-800 h-7" />
                  </tr>
                  <tr>
                    <td className="border border-neutral-800 h-7" />
                    <td className="border border-neutral-800 h-7" />
                    <td className="border border-neutral-800 h-7" />
                  </tr>
                </tbody>
              </table>

              <div className="text-center font-sans text-[10px] text-neutral-500 pt-2">
                Réf. Consultation : {consultation.consultationNumber} · Ordres :{' '}
                {consultation.orderNumbers.join(', ')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
