const PDFDocument = require('pdfkit');
const db   = require('../lib/db');
const path = require('path');
const fs   = require('fs');

// Pastikan folder generated ada
const generatedDir = path.join(__dirname, '../public/generated');
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '-';
  const dateObj = new Date(d);
  const tgl = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  return `${tgl} pukul ${jam}`;
}

function fmtDateTimePukul(d) {
  if (!d) return '-';
  const dateObj = new Date(d);
  const tgl = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  return `${tgl}\nPukul ${jam}`;
}

async function getReportedByUserId(userId) {
  return userId || null;
}

function initDoc() {
  const doc = new PDFDocument({ margin: 40, bufferPages: true, size: 'A4' });
  // Font fallback jika font tidak ditemukan
  try {
    doc.registerFont('Cambria', 'C:\\Windows\\Fonts\\cambria.ttc', 'Cambria');
    doc.registerFont('Cambria-Bold', 'C:\\Windows\\Fonts\\cambriab.ttf');
    doc.registerFont('Cambria-Italic', 'C:\\Windows\\Fonts\\cambriai.ttf');
    doc.registerFont('Cambria-BoldItalic', 'C:\\Windows\\Fonts\\cambriaz.ttf');
  } catch (err) {
    // Fallback to standard fonts if Windows fonts are missing
    doc.registerFont('Cambria', 'Helvetica');
    doc.registerFont('Cambria-Bold', 'Helvetica-Bold');
    doc.registerFont('Cambria-Italic', 'Helvetica-Oblique');
    doc.registerFont('Cambria-BoldItalic', 'Helvetica-BoldOblique');
  }
  return doc;
}

const STATUS_LABEL = {
  reported:    'Dilaporkan',
  in_progress: 'Dalam Proses',
  resolved:    'Terselesaikan',
};

const LOG_STATUS_LABEL = {
  1: 'Laporan Dibuat',
  2: 'Diterima',
  3: 'Progres Perbaikan',
  4: 'Revisi',
  5: 'Selesai',
};

// ── PDF Builder Helpers ────────────────────────────────────────────────────────

function drawHeader(doc, subtitle) {
  let logoPath = path.join(__dirname, '../public/assets/images/logo-unand.png');
  if (!fs.existsSync(logoPath)) {
    logoPath = path.join(__dirname, '../public/assets/images/logo_unand.png');
  }
  let hasLogo = fs.existsSync(logoPath);
  
  if (hasLogo) {
    doc.image(logoPath, 45, 40, { width: 55 });
    doc.fontSize(11).font('Cambria-Bold')
       .text('U N I V E R S I T A S   A N D A L A S', 110, 40, { align: 'center', width: 445 });
    doc.fontSize(14).font('Cambria-Bold')
       .text('FAKULTAS TEKNOLOGI INFORMASI', 110, 54, { align: 'center', width: 445 });
    doc.fontSize(9).font('Cambria')
       .text('Kampus Universitas Andalas, Limau Manis, Padang - 25163', 110, 72, { align: 'center', width: 445 });
    doc.fontSize(7.5).font('Cambria')
       .text('Telp: 0751-9824667 Website: http://fti.unand.ac.id email: sekretariat@it.unand.ac.id', 110, 84, { align: 'center', width: 445 });
  } else {
    doc.fontSize(11).font('Cambria-Bold')
       .text('U N I V E R S I T A S   A N D A L A S', 40, 40, { align: 'center', width: 515 });
    doc.fontSize(14).font('Cambria-Bold')
       .text('FAKULTAS TEKNOLOGI INFORMASI', 40, 54, { align: 'center', width: 515 });
    doc.fontSize(9).font('Cambria')
       .text('Kampus Universitas Andalas, Limau Manis, Padang - 25163', 40, 72, { align: 'center', width: 515 });
    doc.fontSize(7.5).font('Cambria')
       .text('Telp: 0751-9824667 Website: http://fti.unand.ac.id email: sekretariat@it.unand.ac.id', 40, 84, { align: 'center', width: 515 });
  }

  const yLine = 112;
  doc.moveTo(40, yLine).lineTo(555, yLine).lineWidth(1.5).stroke('#000000');
  doc.moveTo(40, yLine + 2).lineTo(555, yLine + 2).lineWidth(0.5).stroke('#000000');
  doc.y = yLine + 10;
  doc.moveDown(0.4);

  doc.fontSize(12).font('Cambria-Bold')
     .text(subtitle.toUpperCase(), 40, doc.y, { align: 'center', width: 515 });
  doc.moveDown(0.5);
}

function drawField(doc, label, value, xLabel, xValue, y, opts = {}) {
  const labelW  = opts.labelW  || 170;
  const valueW  = opts.valueW  || 345;
  doc.fontSize(12).font('Cambria-Bold')
     .text(label + ':', xLabel, y, { width: labelW, lineBreak: false });
  doc.fontSize(12).font('Cambria')
     .text(String(value || '-'), xValue, y, { width: valueW });
}

function drawTableHeader(doc, columns, y) {
  doc.rect(40, y, 515, 20).stroke('#000000');
  let x = 40;
  columns.forEach(col => {
    doc.rect(x, y, col.w, 20).stroke('#000000');
    doc.fontSize(10).font('Cambria-Bold').fillColor('#000000')
       .text(col.label, x + 4, y + 5, { width: col.w - 8, align: col.align || 'left' });
    x += col.w;
  });
  doc.fillColor('#000000');
  return y + 20;
}

function drawTableRow(doc, columns, row, y, isEven) {
  let maxH = 18;
  columns.forEach((col, i) => {
    const val = row[i];
    if (val && typeof val === 'object' && val.type === 'image') {
      const imgH = val.height || 60;
      if (imgH + 10 > maxH) maxH = imgH + 10;
    } else {
      const valStr = String(val || '-');
      const textH = doc.heightOfString(valStr, { width: col.w - 8, fontSize: 10 });
      if (textH + 8 > maxH) maxH = textH + 8;
    }
  });

  if (isEven) {
    doc.rect(40, y, 515, maxH).fill('#F0F4FF');
  }
  doc.rect(40, y, 515, maxH).stroke('#CCCCCC');

  let x = 40;
  columns.forEach((col, i) => {
    doc.rect(x, y, col.w, maxH).stroke('#CCCCCC');
    const val = row[i];
    if (val && typeof val === 'object' && val.type === 'image') {
      if (val.path && fs.existsSync(val.path)) {
        try {
          doc.image(val.path, x + 5, y + 5, { fit: [col.w - 10, maxH - 10], align: 'center', valign: 'center' });
        } catch (e) {
          doc.fontSize(10).font('Cambria').fillColor('#000000')
             .text('-', x + 4, y + 4, { width: col.w - 8, align: 'center' });
        }
      } else {
        doc.fontSize(10).font('Cambria').fillColor('#000000')
           .text('-', x + 4, y + 4, { width: col.w - 8, align: 'center' });
      }
    } else {
      doc.fontSize(10).font('Cambria').fillColor('#000000')
         .text(String(val || '-'), x + 4, y + 4, { width: col.w - 8 });
    }
    x += col.w;
  });
  return y + maxH;
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(40, doc.page.height - 35).lineTo(555, doc.page.height - 35)
       .lineWidth(0.5).stroke('#CCCCCC');

    doc.fontSize(8.5).font('Cambria').fillColor('#777777')
       .text(`Dicetak pada: ${fmtDateTime(new Date())}`, 40, doc.page.height - 30, { align: 'left', width: 250 });

    doc.fontSize(8.5).font('Cambria').fillColor('#777777')
       .text(`Halaman ${i + 1} dari ${range.count}`, 305, doc.page.height - 30, { align: 'right', width: 250 });

    doc.page.margins.bottom = oldBottomMargin;
  }
  doc.fillColor('#000000');
}

function checkPageBreak(doc, neededSpace = 60) {
  if (doc.y + neededSpace > doc.page.height - 60) {
    doc.addPage();
    return true;
  }
  return false;
}

function collectPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// A. PDF BUKTI LAPORAN — untuk Pengguna Biasa
// GET /laporan/:id/pdf
// ══════════════════════════════════════════════════════════════════════════════
const buktiLaporan = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const reportedByUserId = await getReportedByUserId(userId);

    const [[laporan]] = await db.query(
      `SELECT emr.*, a.name AS equipment_name, a.code AS equipment_code,
              u_reporter.name AS reported_by_name,
              u_reporter.email AS reported_by_email
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       JOIN users u_reporter ON emr.reported_by = u_reporter.id
       WHERE emr.id = ? AND emr.reported_by = ?`,
      [
        id,
        reportedByUserId
      ]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Laporan tidak ditemukan',
        error: { status: 404, stack: 'Laporan tidak ada atau bukan milik Anda.' },
      });
    }

    const [logs] = await db.query(
      `SELECT emrl.logged_at, emrl.log, emrl.description, emrl.status, emrl.log_file,
              u.name AS logged_by_name
       FROM equipment_maintenance_request_log emrl
       LEFT JOIN users u ON emrl.logged_by = u.id
       WHERE emrl.equipment_maintenance_request_id = ?
       ORDER BY emrl.created_at ASC`,
      [id]
    );

    const initialLog = logs.find(lg => Number(lg.status) === 1 && lg.log_file && lg.log_file !== '-');
    const photoUrl = initialLog && initialLog.log_file ? initialLog.log_file : null;
    const imgPath = photoUrl ? path.join(__dirname, '../public', photoUrl.replace(/^\/+/, '')) : null;
    const hasPhoto = imgPath && fs.existsSync(imgPath);

    const doc = initDoc();
    const filename = `bukti-laporan-ALAT-${String(id).padStart(5, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    drawHeader(doc, 'Bukti Laporan Kerusakan Alat');

    doc.fontSize(14).font('Cambria-Bold').fillColor('#2563EB')
       .text(`ALAT-${String(laporan.id).padStart(5, '0')}`, 40, doc.y, { align: 'center', width: 515 });
    doc.fillColor('#000000');
    doc.moveDown(0.4);

    const fields = [
      ['Nama Pelapor',    laporan.reported_by_name],
      ['Email',           laporan.reported_by_email || '-'],
      ['Nama Alat',       laporan.equipment_name],
      ['Kode Alat',       laporan.equipment_code || '-'],
      ['Tanggal Laporan', fmtDateTime(laporan.reported_at)],
      ['Status Terkini',  STATUS_LABEL[laporan.status] || laporan.status],
    ];
    if (laporan.resolved_at) {
      fields.push(['Tanggal Selesai', fmtDateTime(laporan.resolved_at)]);
    }

    fields.forEach(([label, val]) => {
      const y = doc.y;
      doc.fontSize(12).font('Cambria-Bold')
         .text(label, 40, y, { width: 165, lineBreak: false });
      doc.fontSize(12).font('Cambria-Bold')
         .text(':', 210, y, { width: 10, lineBreak: false });
      doc.fontSize(12).font('Cambria')
         .text(String(val || '-'), 230, y, { width: 325 });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);

    doc.fontSize(12).font('Cambria-Bold').text('Deskripsi Kerusakan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);
    const descH = doc.heightOfString(laporan.issue_description, { width: 501, fontSize: 11 }) + 14;
    const boxY = doc.y;
    doc.rect(40, boxY, 515, descH).fill('#F8FAFF');
    doc.fontSize(11).font('Cambria').fillColor('#000000')
       .text(laporan.issue_description, 47, boxY + 7, { width: 501 });
    doc.y = boxY + descH;
    doc.moveDown(0.6);

    if (hasPhoto) {
      doc.moveDown(0.4);
      checkPageBreak(doc, 190);
      doc.fontSize(12).font('Cambria-Bold').text('Foto Kerusakan', 40);
      doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
      doc.moveDown(0.5);

      try {
        doc.image(imgPath, { fit: [240, 160] });
      } catch (e) {
        doc.fontSize(11).font('Cambria-Italic').fillColor('#888888').text('Gagal memuat foto kerusakan.');
        doc.fillColor('#000000');
      }
    }

    addPageNumbers(doc);
    doc.end();
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// B. PDF REKAP LAPORAN BULANAN — untuk Penanggung Jawab
// GET /pj/laporan/pdf-rekap?bulan=YYYY-MM
// ══════════════════════════════════════════════════════════════════════════════
const rekapBulanan = async (req, res, next) => {
  try {
    const bulan = req.query.bulan || '';
    if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) {
      return res.status(400).render('error', {
        message: 'Parameter bulan tidak valid',
        error: { status: 400, stack: 'Gunakan format YYYY-MM, contoh: 2025-05' },
      });
    }

    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'reported' THEN 1 ELSE 0 END) as reported,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM equipment_maintenance_requests
      WHERE DATE_FORMAT(reported_at, '%Y-%m') = ?
    `, [bulan]);

    const [maintenance] = await db.query(`
      SELECT emr.reported_at, a.code AS equipment_code, a.name AS equipment_name, eq.brand,
             u.name AS pelapor_name, emr.status, emr.issue_description
      FROM equipment_maintenance_requests emr
      JOIN equipments eq ON emr.equipment_id = eq.id
      JOIN assets a ON eq.asset_id = a.id
      JOIN users u ON emr.reported_by = u.id
      WHERE DATE_FORMAT(emr.reported_at, '%Y-%m') = ?
      ORDER BY emr.reported_at DESC
    `, [bulan]);

    const doc = initDoc();
    const pdfReady = collectPdfBuffer(doc);
    const filename = `rekap-laporan-alat-${bulan}.pdf`;
    const [tahun, bln] = bulan.split('-');
    const periode = new Date(Number(tahun), Number(bln) - 1, 1)
      .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const statObj = stats[0] || { total:0, reported:0, in_progress:0, resolved:0 };

    const statusText = {
      reported: 'Dilaporkan',
      in_progress: 'Dalam Proses',
      resolved: 'Selesai',
    };

    const tableX = 40;
    const tableW = 515;
    const pageBottom = doc.page.height - 60;
    const columns = [
      { label: 'Tanggal', w: 66 },
      { label: 'Kode Aset', w: 74 },
      { label: 'Nama Aset', w: 150 },
      { label: 'Merek', w: 65 },
      { label: 'Pelapor', w: 88 },
      { label: 'Status', w: 72 },
    ];

    const ensureSpace = (height) => {
      if (doc.y + height <= pageBottom) return false;
      doc.addPage();
      doc.y = 50;
      return true;
    };

    const drawStatsCard = (x, y, w, title, value) => {
      doc.rect(x, y, w, 54).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.font('Cambria-Bold').fontSize(8.5).fillColor('#475569')
        .text(title, x + 8, y + 9, { width: w - 16, align: 'center' });
      doc.font('Cambria-Bold').fontSize(20).fillColor('#111827')
        .text(String(value || 0), x + 8, y + 27, { width: w - 16, align: 'center' });
      doc.fillColor('#000000');
    };

    const drawReportTableHeader = () => {
      const y = doc.y;
      doc.rect(tableX, y, tableW, 24).fillAndStroke('#E5E7EB', '#94A3B8');
      let x = tableX;
      columns.forEach(col => {
        doc.rect(x, y, col.w, 24).stroke('#94A3B8');
        doc.font('Cambria-Bold').fontSize(9).fillColor('#111827')
          .text(col.label, x + 6, y + 7, { width: col.w - 12 });
        x += col.w;
      });
      doc.fillColor('#000000');
      doc.y = y + 24;
    };

    const drawReportRow = (row, index) => {
      const values = [
        fmtDate(row.reported_at),
        row.equipment_code || '-',
        row.equipment_name || '-',
        row.brand || '-',
        row.pelapor_name || '-',
        statusText[row.status] || STATUS_LABEL[row.status] || row.status || '-',
      ];

      doc.font('Cambria').fontSize(9);
      const mainRowH = Math.max(
        28,
        ...values.map((value, i) => doc.heightOfString(String(value), { width: columns[i].w - 12 }) + 14)
      );

      const descLabelH = 12;
      const descH = doc.heightOfString(row.issue_description || '-', { width: tableW - 24, fontSize: 9 }) + 10;
      const descBoxH = descLabelH + descH + 10;
      const blockH = mainRowH + descBoxH + 12;

      if (ensureSpace(blockH + 24)) drawReportTableHeader();

      const y = doc.y;
      if (index % 2 === 0) {
        doc.rect(tableX, y, tableW, mainRowH).fill('#F9FAFB');
      }
      doc.rect(tableX, y, tableW, mainRowH).stroke('#CBD5E1');

      let x = tableX;
      values.forEach((value, i) => {
        doc.rect(x, y, columns[i].w, mainRowH).stroke('#CBD5E1');
        doc.font('Cambria').fontSize(9).fillColor('#111827')
          .text(String(value), x + 6, y + 8, { width: columns[i].w - 12 });
        x += columns[i].w;
      });

      doc.y = y + mainRowH + 8;
      const descY = doc.y;
      doc.rect(tableX, descY, tableW, descBoxH).fillAndStroke('#FFFFFF', '#E5E7EB');
      doc.font('Cambria-Bold').fontSize(9).fillColor('#334155')
        .text('Deskripsi Kerusakan:', tableX + 10, descY + 8, { width: tableW - 20 });
      doc.font('Cambria').fontSize(9).fillColor('#111827')
        .text(row.issue_description || '-', tableX + 10, descY + 24, { width: tableW - 20 });

      doc.y = descY + descBoxH + 8;
      doc.moveTo(tableX, doc.y).lineTo(tableX + tableW, doc.y).lineWidth(0.6).stroke('#CBD5E1');
      doc.y += 10;
      doc.fillColor('#000000');
    };

    drawHeader(doc, 'Rekap Laporan Maintenance Peralatan Bulanan');
    doc.font('Cambria').fontSize(10).fillColor('#374151')
      .text(`Periode Laporan: ${periode}`, 40, doc.y, { width: 515, align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1.2);

    doc.font('Cambria-Bold').fontSize(12).text('Ringkasan Statistik', tableX, doc.y);
    doc.moveDown(0.5);

    const cardGap = 10;
    const cardW = (tableW - (cardGap * 3)) / 4;
    const cardY = doc.y;
    drawStatsCard(tableX, cardY, cardW, 'Total Laporan', statObj.total);
    drawStatsCard(tableX + (cardW + cardGap), cardY, cardW, 'Dilaporkan', statObj.reported);
    drawStatsCard(tableX + (cardW + cardGap) * 2, cardY, cardW, 'Dalam Proses', statObj.in_progress);
    drawStatsCard(tableX + (cardW + cardGap) * 3, cardY, cardW, 'Selesai', statObj.resolved);
    doc.y = cardY + 72;

    doc.font('Cambria-Bold').fontSize(12).text('Daftar Laporan', tableX, doc.y);
    doc.moveDown(0.5);

    if (maintenance.length === 0) {
      doc.rect(tableX, doc.y, tableW, 42).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.font('Cambria').fontSize(10).fillColor('#64748B')
        .text('Tidak ada laporan pada periode ini.', tableX, doc.y + 14, { width: tableW, align: 'center' });
      doc.fillColor('#000000');
      doc.y += 52;
    } else {
      drawReportTableHeader();
      maintenance.forEach((row, index) => drawReportRow(row, index));
    }

    addPageNumbers(doc);
    doc.end();
    const pdfBuffer = await pdfReady;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// C. PDF PERMOHONAN MAINTENANCE — untuk Pengelola Aset
// GET /penugasan/:id/pdf
// ══════════════════════════════════════════════════════════════════════════════
const permohonanMaintenance = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.reported_at,
              a.name AS equipment_name, a.code AS equipment_code,
              u.name AS reported_by_name, u.email AS reported_by_email,
              pengelola.name AS assigned_employee_name
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       JOIN users u ON emr.reported_by = u.id
       LEFT JOIN (
         SELECT e.id, e.name
         FROM employees e
         JOIN model_has_roles mhr ON e.id = mhr.model_id
         JOIN roles r ON mhr.role_id = r.id
         WHERE r.name = 'pengelola_aset'
           AND mhr.model_type = 'App\\\\Models\\\\User'
       ) pengelola ON emr.employee_id = pengelola.id
       WHERE emr.id = ?`,
      [id]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Permohonan tidak ditemukan',
        error: { status: 404, stack: 'Data tidak ada.' },
      });
    }

    const [[firstLog]] = await db.query(
      `SELECT logged_at FROM equipment_maintenance_request_log
       WHERE equipment_maintenance_request_id = ? AND status = 1
       ORDER BY created_at ASC LIMIT 1`,
      [id]
    );

    const doc = initDoc();
    const filename = `permohonan-maintenance-MNT-${String(id).padStart(5, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    drawHeader(doc, 'Surat Permohonan Maintenance Alat');

    doc.fontSize(14).font('Cambria-Bold').fillColor('#2563EB')
       .text(`MNT-${String(laporan.id).padStart(5, '0')}`, 40, doc.y, { align: 'center', width: 515 });
    doc.fillColor('#000000');
    doc.moveDown(0.4);

    doc.fontSize(12).font('Cambria-Bold').text('Data Permohonan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);

    const fields = [
      ['Tanggal Permohonan', fmtDate(firstLog ? firstLog.logged_at : laporan.reported_at)],
      ['Nama Alat',          laporan.equipment_name],
      ['Kode Alat',          laporan.equipment_code || '-'],
      ['Tanggal Kerusakan',  fmtDate(laporan.reported_at)],
      ['Dilaporkan Oleh',    laporan.reported_by_name],
      ['Petugas Ditugaskan', laporan.assigned_employee_name || '-'],
      ['Status',             STATUS_LABEL[laporan.status] || laporan.status],
    ];

    fields.forEach(([label, val]) => {
      const y = doc.y;
      drawField(doc, label, val, 40, 230, y);
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);

    doc.fontSize(12).font('Cambria-Bold').text('Deskripsi Kerusakan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);
    const descH = doc.heightOfString(laporan.issue_description, { width: 501, fontSize: 11 }) + 14;
    const boxY = doc.y;
    doc.rect(40, boxY, 515, descH).fill('#FFF8F0');
    doc.fontSize(11).font('Cambria').fillColor('#000000')
       .text(laporan.issue_description, 47, boxY + 7, { width: 501 });
    doc.y = boxY + descH;
    doc.moveDown(0.5);

    doc.fontSize(12).font('Cambria-Bold').text('Persetujuan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.4);

    const sigY = doc.y;
    // Kotak TTD
    doc.rect(325, sigY, 230, 75).stroke('#CCCCCC');
    doc.fontSize(10).font('Cambria').text('Petugas', 325, sigY + 6, { width: 230, align: 'center' });
    doc.fontSize(10).font('Cambria-Bold').text(laporan.assigned_employee_name || '_______________', 325, sigY + 58, { width: 230, align: 'center' });

    addPageNumbers(doc);
    doc.end();
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// D. PDF LAPORAN HASIL PERBAIKAN — untuk Pengelola Aset
// GET /penugasan/:id/pdf-hasil
// ══════════════════════════════════════════════════════════════════════════════
const hasilPerbaikan = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.reported_at, emr.resolved_at,
              a.name AS equipment_name, a.code AS equipment_code,
              u.name AS reported_by_name,
              pengelola.name AS assigned_employee_name
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       JOIN users u ON emr.reported_by = u.id
       LEFT JOIN (
         SELECT e.id, e.name
         FROM employees e
         JOIN model_has_roles mhr ON e.id = mhr.model_id
         JOIN roles r ON mhr.role_id = r.id
         WHERE r.name = 'pengelola_aset'
           AND mhr.model_type = 'App\\\\Models\\\\User'
       ) pengelola ON emr.employee_id = pengelola.id
       WHERE emr.id = ?`,
      [id]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Data tidak ditemukan',
        error: { status: 404, stack: 'Laporan dengan ID tersebut tidak ada.' },
      });
    }

    if (laporan.status !== 'resolved') {
      req.session.flash = {
        type: 'error',
        message: 'PDF hasil perbaikan belum dapat diunduh karena permohonan belum dinyatakan selesai/ditutup.'
      };
      return res.redirect(`/penugasan/${id}`);
    }

    const [progres] = await db.query(
      `SELECT emrl.log, emrl.description, emrl.log_file, emrl.logged_at,
              emrl.status, u.name AS logged_by_name
       FROM equipment_maintenance_request_log emrl
       LEFT JOIN users u ON emrl.logged_by = u.id
       WHERE emrl.equipment_maintenance_request_id = ?
       ORDER BY emrl.created_at ASC`,
      [id]
    );

    const progresOnly = progres.filter(p => p.status === 3);

    const doc = initDoc();
    const filename = `hasil-perbaikan-PNT-${String(id).padStart(5, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    drawHeader(doc, 'Laporan Hasil Perbaikan Alat');

    doc.fontSize(14).font('Cambria-Bold').fillColor('#15803D')
       .text(`PNT-${String(laporan.id).padStart(5, '0')}`, 40, doc.y, { align: 'center', width: 515 });
    doc.fillColor('#000000');
    doc.moveDown(0.4);

    doc.fontSize(12).font('Cambria-Bold').text('Informasi Perbaikan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);

    const fields = [
      ['Nama Alat',        laporan.equipment_name],
      ['Kode Alat',        laporan.equipment_code || '-'],
      ['Pelapor',          laporan.reported_by_name],
      ['Petugas Aset',     laporan.assigned_employee_name || '-'],
      ['Tgl Laporan',      fmtDate(laporan.reported_at)],
      ['Status Akhir',     STATUS_LABEL[laporan.status] || laporan.status],
    ];
    if (laporan.resolved_at) {
      fields.push(['Tgl Selesai', fmtDate(laporan.resolved_at)]);
    }

    fields.forEach(([label, val]) => {
      const y = doc.y;
      drawField(doc, label, val, 40, 220, y);
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);

    doc.fontSize(12).font('Cambria-Bold').text('Deskripsi Kerusakan Awal', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);
    const descH = doc.heightOfString(laporan.issue_description, { width: 501, fontSize: 11 }) + 14;
    const boxY2 = doc.y;
    doc.rect(40, boxY2, 515, descH).fill('#FFF8F0');
    doc.fontSize(11).font('Cambria').fillColor('#000000')
       .text(laporan.issue_description, 47, boxY2 + 7, { width: 501 });
    doc.y = boxY2 + descH;
    doc.moveDown(0.5);

    doc.fontSize(12).font('Cambria-Bold')
       .text(`Rekap Progres Perbaikan (${progresOnly.length} update)`, 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);

    if (progresOnly.length === 0) {
      doc.fontSize(11).font('Cambria').fillColor('#888888').text('Belum ada update progres.');
      doc.fillColor('#000000');
    } else {
      const cols = [
        { label: 'Ke-',       w: 30  },
        { label: 'Tanggal',   w: 95  },
        { label: 'Deskripsi Pekerjaan', w: 280 },
        { label: 'Foto',      w: 110 },
      ];
      checkPageBreak(doc, 40);
      let tY = drawTableHeader(doc, cols, doc.y);
      progresOnly.forEach((p, i) => {
        const imgPath = p.log_file ? path.join(__dirname, '../public', p.log_file) : null;
        const hasImg = imgPath && fs.existsSync(imgPath);
        const neededSpace = hasImg ? 75 : 35;
        checkPageBreak(doc, neededSpace);
        if (doc.y !== tY) tY = doc.y;

        const fotoCell = hasImg
          ? { type: 'image', path: imgPath, height: 60 }
          : '-';

        const row = [
          String(i + 1),
          fmtDateTimePukul(p.logged_at),
          p.description || '-',
          fotoCell,
        ];
        tY = drawTableRow(doc, cols, row, tY, i % 2 === 0);
        doc.y = tY;
      });
    }

    addPageNumbers(doc);
    doc.end();
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// E. PDF BUKTI LAPORAN untuk Penanggung Jawab (view all)
// GET /pj/laporan/:id/pdf
// ══════════════════════════════════════════════════════════════════════════════
const buktiLaporanPJ = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.*, a.name AS equipment_name, a.code AS equipment_code,
              u.name AS reported_by_name, u.email AS reported_by_email
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       JOIN users u ON emr.reported_by = u.id
       WHERE emr.id = ?`,
      [id]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Laporan tidak ditemukan',
        error: { status: 404, stack: 'Laporan tidak ada.' },
      });
    }

    const [logs] = await db.query(
      `SELECT emrl.logged_at, emrl.log, emrl.description, emrl.status,
              u.name AS logged_by_name
       FROM equipment_maintenance_request_log emrl
       LEFT JOIN users u ON emrl.logged_by = u.id
       WHERE emrl.equipment_maintenance_request_id = ?
       ORDER BY emrl.created_at ASC`,
      [id]
    );

    const doc = initDoc();
    const filename = `laporan-ALAT-${String(id).padStart(5, '0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    drawHeader(doc, 'Detail Laporan Kerusakan Alat');

    doc.fontSize(14).font('Cambria-Bold').fillColor('#2563EB')
       .text(`ALAT-${String(laporan.id).padStart(5, '0')}`, 40, doc.y, { align: 'center', width: 515 });
    doc.fillColor('#000000');
    doc.moveDown(0.4);

    doc.fontSize(12).font('Cambria-Bold').text('Informasi Laporan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);

    const fields = [
      ['Nama Pelapor',    laporan.reported_by_name],
      ['Email',           laporan.reported_by_email || '-'],
      ['Nama Alat',       laporan.equipment_name],
      ['Kode Alat',       laporan.equipment_code || '-'],
      ['Tanggal Laporan', fmtDateTime(laporan.reported_at)],
      ['Status Terkini',  STATUS_LABEL[laporan.status] || laporan.status],
    ];
    if (laporan.resolved_at) fields.push(['Tanggal Selesai', fmtDateTime(laporan.resolved_at)]);

    fields.forEach(([label, val]) => {
      const y = doc.y;
      drawField(doc, label, val, 40, 220, y);
      doc.moveDown(0.4);
    });

    doc.moveDown(0.3);
    doc.fontSize(12).font('Cambria-Bold').text('Deskripsi Kerusakan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);
    const descH = doc.heightOfString(laporan.issue_description, { width: 501, fontSize: 11 }) + 14;
    const boxY = doc.y;
    doc.rect(40, boxY, 515, descH).fill('#F8FAFF');
    doc.fontSize(11).font('Cambria').fillColor('#000000')
       .text(laporan.issue_description, 47, boxY + 7, { width: 501 });
    doc.y = boxY + descH;
    doc.moveDown(0.6);

    doc.fontSize(12).font('Cambria-Bold').text('Riwayat Perbaikan', 40);
    doc.moveTo(40, doc.y + 1).lineTo(555, doc.y + 1).lineWidth(0.5).stroke('#CCCCCC');
    doc.moveDown(0.3);

    if (logs.length === 0) {
      doc.fontSize(11).font('Cambria').fillColor('#888888').text('Belum ada riwayat.');
      doc.fillColor('#000000');
    } else {
      const cols = [
        { label: 'Tanggal',    w: 130 },
        { label: 'Keterangan', w: 185 },
        { label: 'Deskripsi',  w: 130 },
        { label: 'Oleh',       w: 70  },
      ];
      checkPageBreak(doc, 40);
      let tY = drawTableHeader(doc, cols, doc.y);
      logs.forEach((lg, i) => {
        checkPageBreak(doc, 35);
        if (doc.y !== tY) tY = doc.y;
        const row = [
          fmtDateTime(lg.logged_at),
          `${LOG_STATUS_LABEL[lg.status] || '-'}\n${lg.log || ''}`,
          lg.description || '-',
          lg.logged_by_name || '-',
        ];
        tY = drawTableRow(doc, cols, row, tY, i % 2 === 0);
        doc.y = tY;
      });
    }

    addPageNumbers(doc);
    doc.end();
  } catch (err) { next(err); }
};

module.exports = {
  buktiLaporan,       // A: GET /laporan/:id/pdf
  rekapBulanan,       // B: GET /pj/laporan/pdf-rekap?bulan=YYYY-MM
  permohonanMaintenance, // C: GET /penugasan/:id/pdf
  hasilPerbaikan,     // D: GET /penugasan/:id/pdf-hasil
  buktiLaporanPJ,     // E: GET /pj/laporan/:id/pdf
};
