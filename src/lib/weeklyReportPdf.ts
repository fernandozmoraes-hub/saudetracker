import jsPDF from 'jspdf';

export interface WeeklyReportPdfInput {
  report: string;
  periodStart: string;
  periodEnd: string;
}

// Gerador simples de PDF: texto puro, sem gráficos.
export function generateWeeklyReportPdf({ report, periodStart, periodEnd }: WeeklyReportPdfInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório Semanal de Performance', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Período: ${periodStart} → ${periodEnd}`, margin, y);
  y += 18;
  doc.setTextColor(0);

  const headingRe = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const lines = report.split('\n');

  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, '').trimEnd();
    const isHeading = headingRe.test(line) && line.trim().length < 80;

    if (line.trim() === '') {
      y += 8;
      continue;
    }

    if (isHeading) {
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    }

    const wrapped = doc.splitTextToSize(line, maxWidth) as string[];
    for (const w of wrapped) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(w, margin, y);
      y += isHeading ? 16 : 14;
    }
  }

  doc.save(`relatorio-semanal-${periodEnd}.pdf`);
}
