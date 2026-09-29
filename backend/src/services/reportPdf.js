const PDFDocument = require('pdfkit');

function generateActivityPDFBuffer(rows, range, generatedAt, requester, period) {
  const clean = value => String(value ?? '—').replace(/[^\x20-\x7E]/g, '').trim() || '—';
  const formatDate = value => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
  };
  const withdrawals = rows.filter(row => String(row.action).toLowerCase() === 'withdraw').length;
  const restocks = rows.filter(row => String(row.action).toLowerCase() === 'restock').length;
  const departments = [...new Set(rows.map(row => row.module))].sort();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 48, left: 40, right: 40 }, bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 40, width = 515, pageBottom = 748;
      const colors = { ink: '#20252B', muted: '#69727D', brand: '#A0604E', line: '#E4E7EB' };
      function pageHeader(first = false) {
        doc.rect(left, 40, width, 4).fill(colors.brand);
        doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(first ? 15 : 10)
          .text('SWISS SIDE TRAINING CAMP', left, first ? 58 : 53, { width: 300 });
        if (!first) {
          doc.fillColor(colors.muted).font('Helvetica').fontSize(8)
            .text('INVENTORY ACTIVITY STATEMENT', 345, 55, { width: 210, align: 'right' });
          doc.moveTo(left, 75).lineTo(left + width, 75).strokeColor(colors.line).stroke();
        }
      }
      pageHeader(true);
      doc.fillColor(colors.brand).font('Helvetica-Bold').fontSize(9).text('INVENTORY ACTIVITY STATEMENT', left, 81);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(21).text(periodLabel(period), left, 101);
      doc.fillColor(colors.muted).font('Helvetica').fontSize(10).text(`${range.from} to ${range.to}`, left, 130);

      doc.roundedRect(left, 158, width, 62, 7).fill('#F7F5F3');
      doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text('REQUESTED BY', left + 14, 171);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(10).text(clean(requester), left + 14, 185, { width: 240 });
      doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text('GENERATED', left + 290, 171);
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(10)
        .text(`${generatedAt}  |  ${departments.length} departments`, left + 290, 185, { width: 210 });

      const cardY = 235, cardWidth = 163;
      [['TOTAL ACTIVITY', rows.length], ['WITHDRAWALS', withdrawals], ['RESTOCKS', restocks]].forEach(([label, value], index) => {
        const x = left + index * (cardWidth + 13);
        doc.roundedRect(x, cardY, cardWidth, 64, 7).lineWidth(0.7).strokeColor(colors.line).stroke();
        doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(7.5).text(label, x + 12, cardY + 12);
        doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(20).text(String(value), x + 12, cardY + 29);
      });

      let y = 328;
      doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(12).text('Activity details', left, y);
      y += 23;
      const columns = [
        { label: 'DATE', x: left + 8, width: 62 },
        { label: 'DEPT.', x: left + 75, width: 58 },
        { label: 'ITEM', x: left + 138, width: 137 },
        { label: 'ACTION', x: left + 280, width: 66 },
        { label: 'QTY', x: left + 351, width: 49, align: 'right' },
        { label: 'PROCESSED BY', x: left + 408, width: 99 }
      ];
      function drawTableHeader() {
        doc.rect(left, y, width, 25).fill('#F1F3F5');
        doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(7);
        columns.forEach(column => doc.text(column.label, column.x, y + 9, { width: column.width, align: column.align || 'left' }));
        y += 25;
      }
      drawTableHeader();
      if (!rows.length) {
        doc.fillColor(colors.muted).font('Helvetica').fontSize(10)
          .text('No inventory activity was recorded during this date range.', left + 10, y + 18, { width: width - 20 });
        y += 48;
      } else {
        rows.forEach((row, index) => {
          if (y + 28 > pageBottom) {
            doc.addPage();
            pageHeader();
            y = 91;
            drawTableHeader();
          }
          const rowHeight = 28;
          if (index % 2) doc.rect(left, y, width, rowHeight).fill('#FAFAFA');
          doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).strokeColor(colors.line).lineWidth(0.5).stroke();
          doc.fillColor(colors.ink).font('Helvetica').fontSize(7.5);
          const values = [
            formatDate(row.transaction_date), clean(row.module), clean(row.item_name),
            clean(String(row.action || '').replace(/_/g, ' ')),
            row.quantity == null ? '—' : `${row.quantity} ${clean(row.unit)}`,
            clean(row.action_by)
          ];
          columns.forEach((column, columnIndex) => doc.text(values[columnIndex], column.x, y + 9, {
            width: column.width, height: 18, ellipsis: true, align: column.align || 'left'
          }));
          y += rowHeight;
        });
      }

      const rangeEnd = new Date(`${range.to}T00:00:00`);
      rangeEnd.setDate(rangeEnd.getDate() - 1);
      const inclusiveEnd = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}`;
      const pages = doc.bufferedPageRange();
      for (let index = 0; index < pages.count; index++) {
        doc.switchToPage(index);
        doc.fillColor(colors.muted).font('Helvetica').fontSize(8)
          .text(`Swiss Side  |  ${range.from} to ${inclusiveEnd}`, left, 770, { width: 380, lineBreak: false });
        doc.text(`Page ${index + 1} of ${pages.count}`, 440, 770, { width: 115, align: 'right', lineBreak: false });
      }
      doc.end();
    } catch (error) { reject(error); }
  });
}

function periodLabel(period) {
  return ({ '24h': 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', '6m': 'Last 6 months', '12m': 'Last 12 months', all: 'All time' })[period] || 'Selected period';
}

module.exports = { generateActivityPDFBuffer };
