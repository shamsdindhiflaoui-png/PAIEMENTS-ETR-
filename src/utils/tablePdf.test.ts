import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTablePdfDocument } from './tablePdf';

test('buildTablePdfDocument generates a valid non-empty PDF for standard and multi-page tables', () => {
  const rows = Array.from({ length: 45 }, (_, idx) => [
    `OP-2026-${String(idx + 1).padStart(4, '0')}`,
    '2026-02-15',
    `Fournisseur International Long Name Example #${idx + 1}`,
    'Société Tunisienne de Banque',
    'VIREMENT',
    '24 500,00 EUR',
    'Déposé à la banque',
  ]);

  const doc = buildTablePdfDocument({
    title: 'Registre des Ordres de Paiement',
    subtitle: 'Filtres : Tous statuts · Exercice 2026',
    filename: 'Registre_Ordres_MTK.pdf',
    columns: [
      { header: 'N° Ordre', widthRatio: 1.2 },
      { header: 'Date', widthRatio: 0.9 },
      { header: 'Bénéficiaire', widthRatio: 2 },
      { header: 'Banque MTK', widthRatio: 1.6 },
      { header: 'Mode', widthRatio: 0.9 },
      { header: 'Montant', align: 'right', widthRatio: 1.1 },
      { header: 'Statut', widthRatio: 1.2 },
    ],
    rows,
  });

  assert.ok(doc.getNumberOfPages() >= 2, 'Should paginate automatically across multiple pages');
  const buf = Buffer.from(doc.output('arraybuffer'));
  assert.ok(buf.byteLength > 2000, 'Generated PDF buffer should not be empty');
  assert.equal(buf.subarray(0, 4).toString(), '%PDF');
});

test('buildTablePdfDocument handles empty tables cleanly without throwing', () => {
  const doc = buildTablePdfDocument({
    title: 'Factures Fournisseurs',
    filename: 'Factures_MTK.pdf',
    columns: [
      { header: 'N° Facture' },
      { header: 'Date' },
      { header: 'Fournisseur' },
      { header: 'Montant', align: 'right' },
    ],
    rows: [],
  });

  assert.equal(doc.getNumberOfPages(), 1);
  const buf = Buffer.from(doc.output('arraybuffer'));
  assert.equal(buf.subarray(0, 4).toString(), '%PDF');
});

test('buildTablePdfDocument uses strictly monochrome grayscale/black-and-white tones for B&W printing', () => {
  const doc = buildTablePdfDocument({
    title: 'Test Impression Noir et Blanc',
    subtitle: 'Controle contraste monochrome',
    filename: 'Test_NB.pdf',
    columns: [
      { header: 'Ref' },
      { header: 'Libelle' },
      { header: 'Montant', align: 'right' },
    ],
    rows: [
      ['001', 'Ligne paire', '1 000,00 EUR'],
      ['002', 'Ligne impaire', '2 000,00 EUR'],
    ],
  });

  const rawPdf = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  // Match any PDF RGB color operator: `r g b rg` or `r g b RG`
  const rgbOps = [...rawPdf.matchAll(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(?:rg|RG)/g)];
  for (const match of rgbOps) {
    const [, r, g, b] = match;
    assert.equal(r, g, `Expected monochrome tone where R === G, got ${match[0]}`);
    assert.equal(g, b, `Expected monochrome tone where G === B, got ${match[0]}`);
  }
});
