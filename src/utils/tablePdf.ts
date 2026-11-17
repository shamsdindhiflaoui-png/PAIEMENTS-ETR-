import { jsPDF } from 'jspdf';

export interface PdfTableColumn {
  header: string;
  align?: 'left' | 'right' | 'center';
  widthRatio?: number;
}

export interface TablePdfOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: PdfTableColumn[];
  rows: Array<Array<string | number | null | undefined>>;
  orientation?: 'portrait' | 'landscape' | 'auto';
  footerNote?: string;
}

function pdfSafeText(str: string): string {
  return (str || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2260/g, '!=')
    .replace(/\u2190/g, '<-')
    .replace(/\u2192/g, '->')
    .replace(/\u00a0/g, ' ')
    .replace(/\u202f/g, ' ');
}

function resolveOrientation(
  orientation: TablePdfOptions['orientation'],
  columnCount: number
): 'portrait' | 'landscape' {
  if (orientation === 'portrait' || orientation === 'landscape') {
    return orientation;
  }
  return columnCount >= 6 ? 'landscape' : 'portrait';
}

function computeColumnWidths(columns: PdfTableColumn[], totalWidth: number): number[] {
  const weights = columns.map(c => (c.widthRatio && c.widthRatio > 0 ? c.widthRatio : 1));
  const sum = weights.reduce((acc, w) => acc + w, 0) || 1;
  return weights.map(w => (w / sum) * totalWidth);
}

function drawDocumentHeader(
  doc: jsPDF,
  options: TablePdfOptions,
  marginX: number,
  contentWidth: number
): number {
  // Top Banner — B&W print-friendly: crisp black border, clean white background, subtle left black bar
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.45);
  doc.rect(marginX, 11, contentWidth, 18, 'FD');

  // Subtle black accent bar on left edge (low toner footprint)
  doc.setFillColor(0, 0, 0);
  doc.rect(marginX, 11, 2.2, 18, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('MANUFACTURE DES TABACS DE KAIROUAN (MTK)', marginX + 5, 16.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(
    'Direction Financiere & Comptable (DFC) - Reglements Internationaux',
    marginX + 5,
    21.2
  );
  doc.text(
    'B.P. 106 - 3100 Kairouan | Tel : (77) 281.309 | Email : mtk.tn@mtk.tn',
    marginX + 5,
    25.4
  );

  // Right Info Box — white background with crisp black border (zero solid-toner waste)
  const boxWidth = 52;
  const boxX = marginX + contentWidth - boxWidth - 3;
  doc.setFillColor(244, 244, 244);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(boxX, 13, boxWidth, 14, 'FD');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(pdfSafeText(`${options.rows.length} ligne(s)`), boxX + boxWidth / 2, 18.2, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const nowStr = new Date().toLocaleString('fr-FR');
  doc.text(pdfSafeText(`Edite le ${nowStr}`), boxX + boxWidth / 2, 23.4, {
    align: 'center',
  });

  // Main Title
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(pdfSafeText(options.title.toUpperCase()), marginX + contentWidth / 2, 35.5, {
    align: 'center',
  });

  let y = 40;
  if (options.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(45, 45, 45);
    const subLines = doc.splitTextToSize(pdfSafeText(options.subtitle), contentWidth);
    doc.text(subLines, marginX + contentWidth / 2, y, { align: 'center' });
    y += subLines.length * 4 + 2;
  }

  doc.setTextColor(0, 0, 0);
  return y + 1;
}

function drawTableHeaderRow(
  doc: jsPDF,
  columns: PdfTableColumn[],
  colWidths: number[],
  marginX: number,
  y: number
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);

  const cellLines = columns.map((col, idx) =>
    doc.splitTextToSize(pdfSafeText(col.header), Math.max(8, colWidths[idx] - 3))
  );
  const maxLines = Math.max(1, ...cellLines.map(lines => lines.length));
  const rowHeight = Math.max(7.4, maxLines * 3.6 + 3);
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  // Light grayscale header fill + pure black text & borders for razor-sharp B&W printing
  doc.setFillColor(232, 232, 232);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(marginX, y, totalW, rowHeight, 'FD');
  doc.setTextColor(0, 0, 0);

  let cursorX = marginX;
  columns.forEach((col, idx) => {
    const w = colWidths[idx];
    if (idx > 0) {
      doc.setDrawColor(90, 90, 90);
      doc.setLineWidth(0.25);
      doc.line(cursorX, y, cursorX, y + rowHeight);
    }
    const lines = cellLines[idx];
    const align = col.align || 'left';
    const textX =
      align === 'right' ? cursorX + w - 1.8 : align === 'center' ? cursorX + w / 2 : cursorX + 1.8;
    lines.forEach((line: string, lineIdx: number) => {
      doc.text(line, textX, y + 4.4 + lineIdx * 3.6, { align });
    });
    cursorX += w;
  });

  // Stronger bottom rule separating header from table body
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.55);
  doc.line(marginX, y + rowHeight, marginX + totalW, y + rowHeight);

  doc.setTextColor(0, 0, 0);
  return y + rowHeight;
}

export function buildTablePdfDocument(options: TablePdfOptions): jsPDF {
  const orientation = resolveOrientation(options.orientation, options.columns.length);
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const marginBottom = 16;
  const contentWidth = pageWidth - marginX * 2;
  const colWidths = computeColumnWidths(options.columns, contentWidth);

  let y = drawDocumentHeader(doc, options, marginX, contentWidth);
  let tableStartY = y;
  y = drawTableHeaderRow(doc, options.columns, colWidths, marginX, y);

  if (options.rows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 45, 45);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(marginX, y, contentWidth, 12, 'S');
    doc.text('Aucune donnee a imprimer pour les filtres actuels.', marginX + contentWidth / 2, y + 7.5, {
      align: 'center',
    });
  } else {
    options.rows.forEach((row, rowIndex) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      const wrappedCells = options.columns.map((_, colIdx) => {
        const raw = row[colIdx] === null || row[colIdx] === undefined ? '' : String(row[colIdx]);
        return doc.splitTextToSize(pdfSafeText(raw), Math.max(8, colWidths[colIdx] - 3));
      });
      const maxLines = Math.max(1, ...wrappedCells.map(lines => lines.length));
      const rowHeight = Math.max(6.4, maxLines * 3.5 + 2.8);

      if (y + rowHeight > pageHeight - marginBottom) {
        // Close outer frame on current page
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.45);
        doc.rect(marginX, tableStartY, contentWidth, y - tableStartY, 'S');

        doc.addPage();
        y = 14;
        tableStartY = y;
        y = drawTableHeaderRow(doc, options.columns, colWidths, marginX, y);
      }

      if (rowIndex % 2 === 1) {
        doc.setFillColor(243, 243, 243);
        doc.rect(marginX, y, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(115, 115, 115);
      doc.setLineWidth(0.25);

      let cursorX = marginX;
      options.columns.forEach((col, colIdx) => {
        const w = colWidths[colIdx];
        doc.rect(cursorX, y, w, rowHeight, 'S');
        const align = col.align || 'left';
        const textX =
          align === 'right'
            ? cursorX + w - 1.8
            : align === 'center'
            ? cursorX + w / 2
            : cursorX + 1.8;
        doc.setTextColor(0, 0, 0);
        wrappedCells[colIdx].forEach((line: string, lineIdx: number) => {
          doc.text(line, textX, y + 4.1 + lineIdx * 3.5, { align });
        });
        cursorX += w;
      });

      y += rowHeight;
    });

    // Crisp pure-black outer frame around the full table
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.45);
    doc.rect(marginX, tableStartY, contentWidth, y - tableStartY, 'S');
  }

  const totalPages = doc.getNumberOfPages();
  const footerLabel = options.footerNote
    ? options.footerNote
    : 'MTK International Payments (DFC) · Edition officielle du tableau';

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(90, 90, 90);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 11.5, pageWidth - marginX, pageHeight - 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(40, 40, 40);
    doc.text(pdfSafeText(footerLabel), marginX, pageHeight - 7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Page ${p} / ${totalPages}`, pageWidth - marginX, pageHeight - 7.5, {
      align: 'right',
    });
  }

  return doc;
}

export function downloadTablePdf(options: TablePdfOptions): void {
  const doc = buildTablePdfDocument(options);
  const safeFilename = (options.filename || 'Tableau_MTK.pdf').replace(/[/\\:*?"<>|]/g, '-');
  doc.save(safeFilename.endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`);
}
