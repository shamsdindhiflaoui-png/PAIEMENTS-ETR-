import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  FileText,
  Pencil,
  RotateCcw,
  Save,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  ConsultationPdfTextOverrides,
  CurrencyConsultation,
  Invoice,
  PaymentOrder,
} from '../types/payment';
import {
  downloadConsultationPdf,
  extractConsultationOverridesForSave,
  getDefaultConsultationPdfContent,
  resolveConsultationPdfContent,
  ResolvedConsultationPdfContent,
} from '../utils/consultationPdf';
import { buildConsultationQrPayload } from '../utils/consultationQr';
import { QrCodeSvg } from './QrCodeSvg';

interface ConsultationPdfModalProps {
  consultation: CurrencyConsultation;
  orders?: PaymentOrder[];
  invoices?: Invoice[];
  canSave?: boolean;
  onSavePdfText?: (
    consultationId: string,
    customPdfText: ConsultationPdfTextOverrides | null
  ) => Promise<void>;
  onClose: () => void;
}

export const ConsultationPdfModal: React.FC<ConsultationPdfModalProps> = ({
  consultation,
  orders = [],
  invoices = [],
  canSave = false,
  onSavePdfText,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showHeaderFields, setShowHeaderFields] = useState(false);
  const [draftContent, setDraftContent] = useState<ResolvedConsultationPdfContent>(() =>
    resolveConsultationPdfContent(consultation)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDraftContent(resolveConsultationPdfContent(consultation));
    setSaveError(null);
  }, [consultation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activeOverrides = useMemo(
    () => extractConsultationOverridesForSave(draftContent, consultation) ?? {},
    [draftContent, consultation]
  );

  const hasCustomText = Object.keys(activeOverrides).length > 0;

  const liveContent = useMemo(
    () => resolveConsultationPdfContent(consultation, activeOverrides),
    [consultation, activeOverrides]
  );

  const qrPayload = useMemo(
    () => buildConsultationQrPayload(consultation, orders, invoices),
    [consultation, orders, invoices]
  );

  const updateField = <K extends keyof ResolvedConsultationPdfContent>(
    key: K,
    value: ResolvedConsultationPdfContent[K]
  ) => {
    setSavedNotice(false);
    setSaveError(null);
    setDraftContent(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSavedNotice(false);
    setSaveError(null);
    setDraftContent(getDefaultConsultationPdfContent(consultation));
  };

  const handleSave = async () => {
    if (!onSavePdfText) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      const toSave = extractConsultationOverridesForSave(draftContent, consultation) ?? null;
      await onSavePdfText(consultation.id, toSave);
      setSavedNotice(true);
    } catch (err: any) {
      setSaveError(err?.message || 'Erreur lors de la sauvegarde du texte.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    downloadConsultationPdf(consultation, activeOverrides, orders, invoices);
  };

  const handlePrint = () => {
    window.print();
  };

  const renderIntroPreview = (introLine: string) => {
    const marker = 'M.T.K.';
    if (!introLine.includes(marker)) {
      return <span>{introLine}</span>;
    }
    const idx = introLine.indexOf(marker);
    return (
      <>
        {introLine.slice(0, idx)}
        <strong className="font-bold">{marker}</strong>
        {introLine.slice(idx + marker.length)}
      </>
    );
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto print:bg-white print:p-0"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-white rounded-xl w-full my-4 shadow-2xl overflow-hidden border border-slate-200 transition-all print:shadow-none print:border-0 print:my-0 ${
          isEditing ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        {/* Top Control Bar (hidden on print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold">
                  Consultation {consultation.consultationNumber} · Document Officiel PDF
                </span>
                {hasCustomText && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/40">
                    Texte modifié
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-300 block">
                Ordres inclus : {consultation.orderNumbers.join(', ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsEditing(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border ${
                isEditing
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Masquer l’éditeur' : 'Modifier le texte'}</span>
            </button>
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

        <div className={isEditing ? 'grid grid-cols-1 lg:grid-cols-12' : ''}>
          {/* Interactive Text Editor Panel (hidden on print) */}
          {isEditing && (
            <div className="no-print lg:col-span-5 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 space-y-3 max-h-[78vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Édition du texte du PDF
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Les modifications s’appliquent en direct à l’aperçu et au PDF téléchargé.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!hasCustomText}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-rose-700 bg-white border border-slate-300 rounded-md disabled:opacity-40"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Réinitialiser</span>
                </button>
              </div>

              {saveError && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                  {saveError}
                </div>
              )}

              {/* Collapsible Header Section */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHeaderFields(prev => !prev)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-slate-100/70 hover:bg-slate-100"
                >
                  <span>En-tête & Coordonnées MTK</span>
                  {showHeaderFields ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
                {showHeaderFields && (
                  <div className="p-3 space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Société
                      </label>
                      <input
                        type="text"
                        value={draftContent.headerCompany}
                        onChange={e => updateField('headerCompany', e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Adresse
                      </label>
                      <input
                        type="text"
                        value={draftContent.headerAddress}
                        onChange={e => updateField('headerAddress', e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          R.C.
                        </label>
                        <input
                          type="text"
                          value={draftContent.headerRc}
                          onChange={e => updateField('headerRc', e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Expéditeur
                        </label>
                        <input
                          type="text"
                          value={draftContent.senderLabel}
                          onChange={e => updateField('senderLabel', e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Tél / Fax en-tête
                      </label>
                      <input
                        type="text"
                        value={draftContent.headerTelFax}
                        onChange={e => updateField('headerTelFax', e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Mention N.B.
                      </label>
                      <input
                        type="text"
                        value={draftContent.nbPrefix}
                        onChange={e => updateField('nbPrefix', e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Téléphone N.B.
                        </label>
                        <input
                          type="text"
                          value={draftContent.contactPhone}
                          onChange={e => updateField('contactPhone', e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          E-mail
                        </label>
                        <input
                          type="text"
                          value={draftContent.contactEmail}
                          onChange={e => updateField('contactEmail', e.target.value)}
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Body Text Fields */}
              <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2.5">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Corps du document
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Titre
                    </label>
                    <input
                      type="text"
                      value={draftContent.sectionTitle}
                      onChange={e => updateField('sectionTitle', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1 font-semibold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Objet
                    </label>
                    <input
                      type="text"
                      value={draftContent.subjectText}
                      onChange={e => updateField('subjectText', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Phrase d’introduction
                  </label>
                  <input
                    type="text"
                    value={draftContent.introLine}
                    onChange={e => updateField('introLine', e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Libellé montant
                    </label>
                    <input
                      type="text"
                      value={draftContent.amountBulletLabel}
                      onChange={e => updateField('amountBulletLabel', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Valeur montant
                    </label>
                    <input
                      type="text"
                      value={draftContent.amountBulletValue}
                      onChange={e => updateField('amountBulletValue', e.target.value)}
                      className="w-full text-xs font-mono font-bold border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Libellé date opération
                    </label>
                    <input
                      type="text"
                      value={draftContent.operationDateBulletLabel}
                      onChange={e => updateField('operationDateBulletLabel', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Date d’opération
                    </label>
                    <input
                      type="text"
                      value={draftContent.operationDateBulletValue}
                      onChange={e => updateField('operationDateBulletValue', e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Libellé date valeur
                    </label>
                    <input
                      type="text"
                      value={draftContent.valueDateBulletLabel}
                      onChange={e => updateField('valueDateBulletLabel', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Date valeur / Type
                    </label>
                    <input
                      type="text"
                      value={draftContent.valueDateBulletValue}
                      onChange={e => updateField('valueDateBulletValue', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Paragraphe demande de cotation
                  </label>
                  <textarea
                    rows={3}
                    value={draftContent.quoteRequestParagraph}
                    onChange={e => updateField('quoteRequestParagraph', e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Numéros de Fax affichés
                  </label>
                  <input
                    type="text"
                    value={draftContent.faxNumbers}
                    onChange={e => updateField('faxNumbers', e.target.value)}
                    className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Paragraphe validité de l’offre
                  </label>
                  <textarea
                    rows={3}
                    value={draftContent.validityParagraph}
                    onChange={e => updateField('validityParagraph', e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2 py-1.5 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Formule de politesse
                    </label>
                    <input
                      type="text"
                      value={draftContent.closingSalutation}
                      onChange={e => updateField('closingSalutation', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Signataire
                    </label>
                    <input
                      type="text"
                      value={draftContent.signatureLabel}
                      onChange={e => updateField('signatureLabel', e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Titre tableau banque
                    </label>
                    <input
                      type="text"
                      value={draftContent.bankTableTitle}
                      onChange={e => updateField('bankTableTitle', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Ligne pied de page
                    </label>
                    <input
                      type="text"
                      value={draftContent.footerTraceability}
                      onChange={e => updateField('footerTraceability', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                    />
                  </div>
                </div>
              </div>

              {canSave && onSavePdfText && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    {savedNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Texte enregistré dans la consultation</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>
                          {isSaving
                            ? 'Enregistrement...'
                            : 'Enregistrer le texte dans la consultation'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Printable / Faithful MTK Consultation Letter Preview */}
          <div
            className={`${
              isEditing ? 'lg:col-span-7 max-h-[78vh] overflow-y-auto print:max-h-none' : ''
            } p-8 sm:p-14 bg-white text-black font-serif print:p-8`}
          >
            <div className="max-w-[600px] mx-auto space-y-6">
              {/* Header Gray Box */}
              <div className="border border-neutral-600 bg-neutral-200/90 text-center">
                <div className="px-4 py-2.5 border-b border-neutral-600 space-y-0.5 italic">
                  <div className="text-[19px] tracking-wide leading-tight font-normal">
                    {liveContent.headerCompany}
                  </div>
                  <div className="text-[12.5px]">{liveContent.headerAddress}</div>
                  <div className="text-[12.5px]">{liveContent.headerRc}</div>
                  <div className="text-[12.5px]">{liveContent.headerTelFax}</div>
                </div>
                <div className="px-4 py-2 font-bold italic text-[12.5px] space-y-0.5">
                  <div>{liveContent.senderLabel}</div>
                  <div>
                    {liveContent.nbPrefix} {liveContent.contactPhone}
                  </div>
                  <div>
                    E-mail :{' '}
                    <span className="text-blue-700 underline">{liveContent.contactEmail}</span>
                  </div>
                </div>
              </div>

              {/* TEXTE */}
              <div className="text-center font-bold italic text-[15px] pt-2">
                {liveContent.sectionTitle}
              </div>

              {/* Objet */}
              <div className="text-[15px] italic">
                <span className="font-bold underline">{liveContent.subjectLabel}</span>{' '}
                <span>{liveContent.subjectText}</span>
              </div>

              {/* Body */}
              <div className="text-[15px] italic space-y-3 pt-1">
                <p>{renderIntroPreview(liveContent.introLine)}</p>

                <ul className="pl-8 space-y-1.5 list-none">
                  <li>
                    - &nbsp; {liveContent.amountBulletLabel}{' '}
                    <strong className="font-bold not-italic font-serif italic ml-1">
                      {liveContent.amountBulletValue}
                    </strong>
                  </li>
                  <li>
                    - &nbsp; {liveContent.operationDateBulletLabel}{' '}
                    <span className="ml-1">{liveContent.operationDateBulletValue}</span>
                  </li>
                  <li>
                    - &nbsp; {liveContent.valueDateBulletLabel}{' '}
                    <span className="ml-1">{liveContent.valueDateBulletValue}</span>
                  </li>
                </ul>

                {liveContent.isQuoteRequestCustom ? (
                  <p className="leading-relaxed pt-1 whitespace-pre-line">
                    {liveContent.quoteRequestParagraph}
                  </p>
                ) : (
                  <p className="leading-relaxed pt-1">
                    A cet effet nous vous prions de nous communiquer par Email (
                    <span className="text-blue-700 underline">{liveContent.contactEmail}</span>) ou
                    par fax, (en remplissant le tableau ci-après) votre meilleure cotation du jour
                    de l’opération avant{' '}
                    <strong className="font-bold underline">{liveContent.submissionTime}</strong>{' '}
                    (heure limite) aux numéros suivants :
                  </p>
                )}

                {liveContent.faxNumbers.trim() && (
                  <div className="text-center font-bold italic text-[15px] tracking-wide py-1.5">
                    {liveContent.faxNumbers}
                  </div>
                )}

                {liveContent.isValidityCustom ? (
                  <p className="leading-relaxed whitespace-pre-line">
                    {liveContent.validityParagraph}
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    Votre cotation demeure valable jusqu’à{' '}
                    <strong className="font-bold underline">{liveContent.validityTime}</strong>,
                    heure limite de confirmation de l’achat par la M.T.K. par téléphone en attendant
                    l’expédition du fax de confirmation.
                  </p>
                )}

                <div className="pt-3 text-right space-y-3 pr-2">
                  <p>{liveContent.closingSalutation}</p>
                  <p className="font-bold">{liveContent.signatureLabel}</p>
                </div>
              </div>

              {/* Bottom Divider & Bank Table */}
              <div className="pt-10 space-y-3">
                <div className="h-1.5 bg-neutral-600 w-full" />
                <div className="text-center font-bold italic text-[14px]">
                  {liveContent.bankTableTitle}
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

                <div className="pt-3 flex items-end justify-between gap-4">
                  <div className="font-sans text-[10px] text-neutral-500 space-y-1 max-w-[420px]">
                    <div>{liveContent.footerTraceability}</div>
                    <div className="text-[9px] text-neutral-400">
                      QR : Réf. ordre, facture, type de paiement &amp; détail montant
                    </div>
                  </div>
                  <QrCodeSvg
                    value={qrPayload}
                    sizePx={90}
                    caption="Vérification QR"
                    className="shrink-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
