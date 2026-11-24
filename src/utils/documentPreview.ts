import { Invoice, PaymentDocument, PaymentOrder } from '../types/payment';

export type PreviewableAttachmentKind = 'pdf' | 'image' | 'text' | 'unsupported';

export interface PreviewableDocumentItem {
  id?: string;
  name: string;
  type?: string;
  docRole?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  dataBase64?: string;
  fileUrl?: string;
  sourceKind: 'ORDER' | 'INVOICE' | 'DRAFT';
  sourceEntityId?: string;
  sourceLabel?: string;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);
const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'json', 'log', 'xml']);

export function extractMimeFromDataUrl(url?: string): string | undefined {
  if (!url || !url.startsWith('data:')) return undefined;
  const commaIdx = url.indexOf(',');
  if (commaIdx === -1) return undefined;
  const meta = url.slice(5, commaIdx);
  const semiIdx = meta.indexOf(';');
  const mime = (semiIdx === -1 ? meta : meta.slice(0, semiIdx)).trim().toLowerCase();
  return mime || undefined;
}

export function getFileExtension(filename?: string): string {
  if (!filename) return '';
  const clean = filename.split('?')[0].split('#')[0];
  const lastDot = clean.lastIndexOf('.');
  if (lastDot === -1 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1).toLowerCase();
}

export function detectAttachmentKind(doc: {
  name?: string;
  mimeType?: string;
  dataBase64?: string;
  fileUrl?: string;
}): PreviewableAttachmentKind {
  const dataMime =
    extractMimeFromDataUrl(doc.dataBase64) || extractMimeFromDataUrl(doc.fileUrl);
  const mime = (dataMime || doc.mimeType || '').trim().toLowerCase();
  const ext = getFileExtension(doc.name);

  if (mime === 'application/pdf' || mime.endsWith('/pdf') || ext === 'pdf') {
    return 'pdf';
  }
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return 'text';
  }
  return 'unsupported';
}

export function parseDataUrlToBytes(
  dataUrl: string
): { mimeType: string; bytes: Uint8Array } | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;

  const header = dataUrl.slice(5, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const parts = header.split(';');
  const mimeType = (parts[0] || 'application/octet-stream').trim() || 'application/octet-stream';
  const isBase64 = parts.some(p => p.trim().toLowerCase() === 'base64');

  if (isBase64) {
    const cleanB64 = body.replace(/\s+/g, '');
    const binaryString = atob(cleanB64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return { mimeType, bytes };
  }

  const decoded = decodeURIComponent(body);
  const encoder = new TextEncoder();
  return { mimeType, bytes: encoder.encode(decoded) };
}

export function dataUrlToBlob(dataUrl: string, fallbackMimeType?: string): Blob | null {
  const parsed = parseDataUrlToBytes(dataUrl);
  if (!parsed) return null;
  const copy = new Uint8Array(parsed.bytes.byteLength);
  copy.set(parsed.bytes);
  return new Blob([copy], {
    type: parsed.mimeType || fallbackMimeType || 'application/octet-stream',
  });
}

export function decodeTextFromDataUrl(dataUrl: string): string | null {
  const parsed = parseDataUrlToBytes(dataUrl);
  if (!parsed) return null;
  try {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(parsed.bytes);
  } catch {
    return null;
  }
}

export function formatFileSizeLabel(bytes?: number): string {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${Math.round(size)} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(2)} Mo`;
}

export function getNextAttachmentIndex(
  currentIndex: number,
  total: number,
  delta: -1 | 1
): number {
  if (total <= 0) return 0;
  const normalizedCurrent = ((currentIndex % total) + total) % total;
  return (normalizedCurrent + delta + total) % total;
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  FACTURE: 'Facture / Proforma',
  DOMICILIATION: 'Fiche Domiciliation',
  CONTRAT: 'Contrat / Bon Commande',
  BORDEREAU_DEPOT: 'Bordereau de Dépôt',
  AVIS_DEBIT_SWIFT: 'Avis Débit SWIFT',
  AUTRE: 'Autre Justificatif',
};

export function formatDocumentTypeLabel(type?: string, docRole?: string): string {
  const base = (type && DOCUMENT_TYPE_LABELS[type]) || type || 'Pièce justificative';
  if (docRole === 'PROFORMA') return `${base} · Proforma`;
  if (docRole === 'FACTURE_DEFINITIVE') return `${base} · Définitive`;
  return base;
}

export function buildOrderAttachmentItems(
  order: PaymentOrder,
  linkedInvoice?: Invoice
): {
  orderDocs: PreviewableDocumentItem[];
  invoiceOnlyDocs: PreviewableDocumentItem[];
  allDocs: PreviewableDocumentItem[];
} {
  const orderDocs: PreviewableDocumentItem[] = (order.documents || []).map((d: PaymentDocument) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    docRole: d.docRole,
    size: d.size,
    mimeType: d.mimeType,
    uploadedAt: d.uploadedAt,
    uploadedBy: d.uploadedBy,
    dataBase64: d.dataBase64,
    fileUrl: d.fileUrl,
    sourceKind: 'ORDER',
    sourceEntityId: order.id,
    sourceLabel: `Ordre ${order.orderNumber}`,
  }));

  const seenOrderNames = new Set(orderDocs.map(d => d.name.trim().toLowerCase()));
  const invoiceOnlyDocs: PreviewableDocumentItem[] =
    linkedInvoice && Array.isArray(linkedInvoice.documents)
      ? linkedInvoice.documents
          .filter(d => !seenOrderNames.has((d.name || '').trim().toLowerCase()))
          .map((d, idx) => ({
            id: d.id || `inv_doc_${idx}`,
            name: d.name,
            type: d.type,
            docRole: d.docRole,
            size: d.size,
            mimeType: d.mimeType,
            uploadedAt: d.uploadedAt,
            uploadedBy: d.uploadedBy,
            dataBase64: d.dataBase64,
            fileUrl: d.fileUrl,
            sourceKind: 'INVOICE' as const,
            sourceEntityId: linkedInvoice.id,
            sourceLabel: `Facture ${linkedInvoice.invoiceNumber}`,
          }))
      : [];

  return {
    orderDocs,
    invoiceOnlyDocs,
    allDocs: [...orderDocs, ...invoiceOnlyDocs],
  };
}
