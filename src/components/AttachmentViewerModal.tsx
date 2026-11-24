import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  FileCode2,
  AlertCircle,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import {
  dataUrlToBlob,
  decodeTextFromDataUrl,
  detectAttachmentKind,
  formatDocumentTypeLabel,
  formatFileSizeLabel,
  getNextAttachmentIndex,
  PreviewableDocumentItem,
} from '../utils/documentPreview';

interface AttachmentViewerModalProps {
  documents: PreviewableDocumentItem[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

interface LoadedContent {
  dataUrl: string;
  mimeType?: string;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  documents,
  initialIndex = 0,
  title,
  onClose,
}) => {
  const safeInitialIndex =
    documents.length > 0 ? Math.min(Math.max(0, initialIndex), documents.length - 1) : 0;

  const [currentIndex, setCurrentIndex] = useState<number>(safeInitialIndex);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadedContent, setLoadedContent] = useState<LoadedContent | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  // Image transform state
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  const cacheRef = useRef<Map<string, LoadedContent>>(new Map());
  const pdfIframeRef = useRef<HTMLIFrameElement | null>(null);

  const activeDoc = documents[currentIndex];
  const activeCacheKey = activeDoc
    ? `${activeDoc.sourceKind}:${activeDoc.sourceEntityId || 'local'}:${
        activeDoc.id || activeDoc.name
      }:${currentIndex}`
    : '';

  // Reset zoom/rotation when switching document
  useEffect(() => {
    setZoomPercent(100);
    setRotationDeg(0);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && documents.length > 1) {
        setCurrentIndex(prev => getNextAttachmentIndex(prev, documents.length, -1));
      } else if (e.key === 'ArrowRight' && documents.length > 1) {
        setCurrentIndex(prev => getNextAttachmentIndex(prev, documents.length, 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [documents.length, onClose]);

  // Load binary/data URL for active document
  useEffect(() => {
    if (!activeDoc) return;
    let cancelled = false;

    const load = async () => {
      setErrorMsg(null);
      setLoadedContent(null);

      // 1. Check local cache first
      const cached = cacheRef.current.get(activeCacheKey);
      if (cached) {
        if (!cancelled) setLoadedContent(cached);
        return;
      }

      // 2. Inline dataBase64 / fileUrl already available
      if (activeDoc.dataBase64 || activeDoc.fileUrl) {
        const inline: LoadedContent = {
          dataUrl: (activeDoc.dataBase64 || activeDoc.fileUrl)!,
          mimeType: activeDoc.mimeType,
        };
        cacheRef.current.set(activeCacheKey, inline);
        if (!cancelled) setLoadedContent(inline);
        return;
      }

      // 3. Lazy-load from PostgreSQL API
      if (!activeDoc.sourceEntityId || activeDoc.sourceKind === 'DRAFT') {
        if (!cancelled) {
          setErrorMsg(
            "Aucun contenu binaire disponible pour cette pièce (document d'exemple ou brouillon sans fichier)."
          );
        }
        return;
      }

      try {
        setLoading(true);
        const fetched =
          activeDoc.sourceKind === 'INVOICE'
            ? await api.getInvoiceDocumentContent(activeDoc.sourceEntityId, activeDoc)
            : await api.getOrderDocumentContent(activeDoc.sourceEntityId, activeDoc);

        cacheRef.current.set(activeCacheKey, fetched);
        if (!cancelled) {
          setLoadedContent(fetched);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Impossible de charger cette pièce justificative.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeDoc, activeCacheKey, retryCounter]);

  const kind = useMemo(() => {
    if (!activeDoc) return 'unsupported' as const;
    return detectAttachmentKind({
      name: activeDoc.name,
      mimeType: loadedContent?.mimeType || activeDoc.mimeType,
      dataBase64: loadedContent?.dataUrl || activeDoc.dataBase64,
      fileUrl: activeDoc.fileUrl,
    });
  }, [activeDoc, loadedContent]);

  // Convert data URL into Blob ObjectURL for smooth iframe PDF rendering & clean memory lifecycle
  useEffect(() => {
    setObjectUrl(null);
    setTextContent(null);
    if (!loadedContent?.dataUrl) return;

    const url = loadedContent.dataUrl;
    if (kind === 'text') {
      const decoded = decodeTextFromDataUrl(url);
      if (decoded !== null) {
        setTextContent(decoded);
        return;
      }
    }

    if (url.startsWith('data:')) {
      const blob = dataUrlToBlob(url, loadedContent.mimeType || activeDoc?.mimeType);
      if (blob) {
        const createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        return () => {
          URL.revokeObjectURL(createdUrl);
        };
      }
    }

    setObjectUrl(url);
    return undefined;
  }, [loadedContent, kind, activeDoc?.mimeType]);

  if (!activeDoc) return null;

  const handleDownloadCurrent = () => {
    const href = objectUrl || loadedContent?.dataUrl;
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.download = activeDoc.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrintPdf = () => {
    try {
      pdfIframeRef.current?.contentWindow?.focus();
      pdfIframeRef.current?.contentWindow?.print();
    } catch {
      handleDownloadCurrent();
    }
  };

  const KindIcon =
    kind === 'image' ? ImageIcon : kind === 'text' ? FileCode2 : FileText;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Visionneuse de pièce jointe : ${activeDoc.name}`}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl overflow-hidden flex flex-col border border-slate-700/40"
      >
        {/* Top Toolbar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
              <KindIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-bold truncate max-w-[320px] sm:max-w-[460px]">
                  {activeDoc.name}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {formatDocumentTypeLabel(activeDoc.type, activeDoc.docRole)}
                </span>
                {activeDoc.sourceLabel && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {activeDoc.sourceLabel}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                {title && <span>{title}</span>}
                {title && <span aria-hidden="true">·</span>}
                <span className="font-mono">{formatFileSizeLabel(activeDoc.size)}</span>
                {activeDoc.uploadedBy && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Déposé par {activeDoc.uploadedBy}
                      {activeDoc.uploadedAt ? ` le ${activeDoc.uploadedAt.split('T')[0]}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Multi-doc navigation */}
            {documents.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 mr-1">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex(prev => getNextAttachmentIndex(prev, documents.length, -1))
                  }
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                  aria-label="Pièce précédente"
                  title="Pièce précédente (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-1.5 text-slate-200 tabular-nums">
                  {currentIndex + 1} / {documents.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex(prev => getNextAttachmentIndex(prev, documents.length, 1))
                  }
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                  aria-label="Pièce suivante"
                  title="Pièce suivante (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Image Zoom & Rotate Controls */}
            {kind === 'image' && loadedContent && !errorMsg && (
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 mr-1">
                <button
                  type="button"
                  onClick={() => setZoomPercent(z => Math.max(50, z - 25))}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                  aria-label="Dézoomer"
                  title="Zoom −"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-semibold px-1 text-slate-200 min-w-[40px] text-center">
                  {zoomPercent}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomPercent(z => Math.min(250, z + 25))}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                  aria-label="Zoomer"
                  title="Zoom +"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotationDeg(r => (r + 90) % 360)}
                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded"
                  aria-label="Pivoter à 90 degrés"
                  title="Pivoter 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                {(zoomPercent !== 100 || rotationDeg !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoomPercent(100);
                      setRotationDeg(0);
                    }}
                    className="p-1 text-amber-300 hover:text-white hover:bg-slate-700 rounded"
                    aria-label="Réinitialiser l'affichage"
                    title="Réinitialiser"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {kind === 'pdf' && objectUrl && !errorMsg && (
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
            )}

            {loadedContent && !errorMsg && (
              <button
                type="button"
                onClick={handleDownloadCurrent}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
              aria-label="Fermer la visionneuse"
            >
              <X className="w-4 h-4" />
              <span>Fermer</span>
            </button>
          </div>
        </div>

        {/* Viewer Viewport */}
        <div className="flex-1 bg-slate-800/95 overflow-auto flex items-center justify-center relative">
          {loading ? (
            <div className="text-center space-y-3 p-8">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-200">
                Chargement de la pièce justificative...
              </p>
            </div>
          ) : errorMsg ? (
            <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6 text-center space-y-3 shadow-lg">
              <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Aperçu indisponible</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{errorMsg}</p>
              </div>
              <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-left space-y-1 text-slate-600">
                <div>
                  <strong>Fichier :</strong> {activeDoc.name}
                </div>
                <div>
                  <strong>Catégorie :</strong> {formatDocumentTypeLabel(activeDoc.type, activeDoc.docRole)}
                </div>
                <div>
                  <strong>Taille déclarée :</strong> {formatFileSizeLabel(activeDoc.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  cacheRef.current.delete(activeCacheKey);
                  setRetryCounter(c => c + 1);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Réessayer</span>
              </button>
            </div>
          ) : kind === 'pdf' && objectUrl ? (
            <iframe
              ref={pdfIframeRef}
              src={objectUrl}
              title={activeDoc.name}
              className="w-full h-full bg-white border-0"
            />
          ) : kind === 'image' && (objectUrl || loadedContent?.dataUrl) ? (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-6">
              <img
                src={objectUrl || loadedContent?.dataUrl}
                alt={activeDoc.name}
                style={{
                  transform: `scale(${zoomPercent / 100}) rotate(${rotationDeg}deg)`,
                  transformOrigin: 'center center',
                }}
                className="max-w-full max-h-full object-contain rounded shadow-xl bg-white transition-transform duration-150"
              />
            </div>
          ) : kind === 'text' && textContent !== null ? (
            <div className="w-full h-full p-4 sm:p-6 overflow-auto">
              <pre className="max-w-4xl mx-auto bg-white text-slate-900 rounded-xl border border-slate-200 p-5 text-xs font-mono leading-relaxed whitespace-pre-wrap shadow-md">
                {textContent}
              </pre>
            </div>
          ) : (
            <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6 text-center space-y-3 shadow-lg">
              <FileText className="w-10 h-10 text-blue-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Format non prévisualisable directement
                </h4>
                <p className="text-xs text-slate-600">
                  Ce type de fichier ({activeDoc.mimeType || 'binaire'}) peut être téléchargé pour être ouvert localement.
                </p>
              </div>
              {loadedContent && (
                <button
                  type="button"
                  onClick={handleDownloadCurrent}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger {activeDoc.name}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Document Strip when multiple files */}
        {documents.length > 1 && (
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
            {documents.map((d, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={`${d.id || d.name}_${idx}`}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap flex items-center gap-1.5 border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-80">{idx + 1}.</span>
                  <span className="max-w-[180px] truncate">{d.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
