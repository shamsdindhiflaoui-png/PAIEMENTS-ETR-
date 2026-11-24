import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderAttachmentItems,
  dataUrlToBlob,
  decodeTextFromDataUrl,
  detectAttachmentKind,
  formatDocumentTypeLabel,
  formatFileSizeLabel,
  getNextAttachmentIndex,
  parseDataUrlToBytes,
} from './documentPreview';
import { Invoice, PaymentOrder } from '../types/payment';

test('detectAttachmentKind classifies PDF, image, text, and unsupported files cleanly', () => {
  assert.equal(detectAttachmentKind({ name: 'facture.pdf', mimeType: 'application/pdf' }), 'pdf');
  assert.equal(detectAttachmentKind({ name: 'scan.PDF' }), 'pdf');
  assert.equal(
    detectAttachmentKind({
      name: 'document_sans_extension',
      dataBase64: 'data:application/pdf;base64,JVBERi0xLjQ=',
    }),
    'pdf'
  );
  assert.equal(detectAttachmentKind({ name: 'avis_swift.png', mimeType: 'image/png' }), 'image');
  assert.equal(detectAttachmentKind({ name: 'photo.JPEG' }), 'image');
  assert.equal(detectAttachmentKind({ name: 'releve.csv', mimeType: 'text/csv' }), 'text');
  assert.equal(detectAttachmentKind({ name: 'notes.txt' }), 'text');
  assert.equal(detectAttachmentKind({ name: 'archive.zip', mimeType: 'application/zip' }), 'unsupported');
});

test('parseDataUrlToBytes, dataUrlToBlob, and decodeTextFromDataUrl decode base64 payloads accurately', () => {
  const textPayload = 'Ordre: 001-026-0001\nMontant: 15000 EUR';
  const base64Text = Buffer.from(textPayload, 'utf8').toString('base64');
  const dataUrl = `data:text/plain;base64,${base64Text}`;

  const parsed = parseDataUrlToBytes(dataUrl);
  assert.ok(parsed);
  assert.equal(parsed.mimeType, 'text/plain');
  assert.equal(decodeTextFromDataUrl(dataUrl), textPayload);

  const blob = dataUrlToBlob(dataUrl);
  assert.ok(blob);
  assert.equal(blob.type, 'text/plain');
  assert.equal(blob.size, Buffer.byteLength(textPayload, 'utf8'));

  assert.equal(parseDataUrlToBytes('https://example.com/file.pdf'), null);
});

test('formatFileSizeLabel, formatDocumentTypeLabel, and getNextAttachmentIndex behave deterministically', () => {
  assert.equal(formatFileSizeLabel(0), '—');
  assert.equal(formatFileSizeLabel(512), '512 o');
  assert.equal(formatFileSizeLabel(15360), '15.0 Ko');
  assert.equal(formatFileSizeLabel(2 * 1024 * 1024), '2.00 Mo');

  assert.equal(formatDocumentTypeLabel('FACTURE', 'PROFORMA'), 'Facture / Proforma · Proforma');
  assert.equal(
    formatDocumentTypeLabel('AVIS_DEBIT_SWIFT'),
    'Avis Débit SWIFT'
  );

  assert.equal(getNextAttachmentIndex(0, 3, -1), 2);
  assert.equal(getNextAttachmentIndex(2, 3, 1), 0);
  assert.equal(getNextAttachmentIndex(1, 3, 1), 2);
});

test('buildOrderAttachmentItems merges order documents with unique linked invoice documents', () => {
  const order: PaymentOrder = {
    id: 'ord_1',
    orderNumber: '001-026-0001',
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:00:00Z',
    createdBy: 'Admin',
    createdById: 'u_1',
    purpose: 'Test',
    beneficiaryName: 'Supplier',
    beneficiaryCountry: 'FR',
    beneficiaryAddress: 'Paris',
    beneficiaryBank: 'BNP',
    beneficiaryIban: 'FR123',
    beneficiarySwift: 'BNPAFRPP',
    currency: 'EUR',
    amount: 1000,
    amountInWords: 'Mille euros',
    transferPurpose: 'Test',
    invoiceNumber: 'FAC-01',
    invoiceDate: '2026-11-01',
    operationNature: 'Import',
    bankId: 'bank_bna',
    bankName: 'BNA',
    bankBranch: 'Kairouan',
    bankFileRef: 'REF',
    status: 'SAISI',
    history: [],
    documents: [
      {
        id: 'doc_ord_1',
        orderId: 'ord_1',
        name: 'Facture_Proforma.pdf',
        type: 'FACTURE',
        size: 12000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-11-18T10:00:00Z',
        uploadedBy: 'Admin',
      },
    ],
    isDemo: false,
  };

  const invoice: Invoice = {
    id: 'inv_1',
    invoiceNumber: 'FAC-01',
    invoiceDate: '2026-11-01',
    purpose: 'Test',
    operationNature: 'Import',
    supplierName: 'Supplier',
    supplierCountry: 'FR',
    supplierAddress: 'Paris',
    supplierBank: 'BNP',
    supplierIban: 'FR123',
    supplierSwift: 'BNPAFRPP',
    currency: 'EUR',
    totalAmount: 2000,
    documents: [
      {
        id: 'doc_inv_dup',
        name: 'Facture_Proforma.pdf',
        type: 'FACTURE',
        size: 12000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-11-10T10:00:00Z',
        uploadedBy: 'Admin',
      },
      {
        id: 'doc_inv_def',
        name: 'Facture_Definitive.pdf',
        type: 'FACTURE',
        docRole: 'FACTURE_DEFINITIVE',
        size: 18500,
        mimeType: 'application/pdf',
        uploadedAt: '2026-11-18T12:00:00Z',
        uploadedBy: 'Admin',
      },
    ],
    createdAt: '2026-11-10T10:00:00Z',
    createdBy: 'Admin',
    createdById: 'u_1',
    isDemo: false,
  };

  const merged = buildOrderAttachmentItems(order, invoice);
  assert.equal(merged.orderDocs.length, 1);
  assert.equal(merged.invoiceOnlyDocs.length, 1);
  assert.equal(merged.invoiceOnlyDocs[0].name, 'Facture_Definitive.pdf');
  assert.equal(merged.invoiceOnlyDocs[0].sourceKind, 'INVOICE');
  assert.equal(merged.invoiceOnlyDocs[0].sourceEntityId, 'inv_1');
  assert.equal(merged.allDocs.length, 2);
});
