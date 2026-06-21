const db = require('../lib/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PAGE_SIZE = 10;

const STATUS_INFO = {
  reported:    { text: 'Dilaporkan', bg: '#fffbeb', color: '#a16207',  border: '#fde68a' },
  in_progress: { text: 'Diproses',   bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
  resolved:    { text: 'Selesai',    bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0' },
};

// ── Helper: ambil employee_id dari userId session ──────────────────────────────
async function getEmployeeId(userId) {
  const [[emp]] = await db.query('SELECT id FROM employees WHERE id = ?', [userId]);
  return emp ? emp.id : null;
}

// ── Helper: generate id log baru (MAX+1) ──────────────────────────────────────
async function nextLogId() {
  const [[{ nid }]] = await db.query(
    'SELECT COALESCE(MAX(id), 0) + 1 AS nid FROM equipment_maintenance_request_log'
  );
  return nid;
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /maintenance  — daftar permohonan (termasuk resolved agar PDF tetap bisa diakses)
// ══════════════════════════════════════════════════════════════════════════════
const index = async (req, res, next) => {
  try {
    const pjEmployeeId = req.session.userId;
    const search = req.query.search || '';
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // Filter: Menampilkan semua status (reported, in_progress, resolved) 
    const whereParts = [
      "emr.status IN ('in_progress', 'reported', 'resolved')"
    ];
    const params = [];

    if (search) {
      whereParts.push('a.name LIKE ?');
      params.push(`%${search}%`);
    }
    const where = 'WHERE ' + whereParts.join(' AND ');

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       ${where}`,
      params
    );

    const [maintenance] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, a.code AS equipment_code,
              emr.issue_description, emr.status, emr.reported_at,
              pengelola.name AS pengelola_name,
              (SELECT COUNT(*) FROM equipment_maintenance_request_log
               WHERE equipment_maintenance_request_id = emr.id) AS log_count,
              (SELECT status FROM equipment_maintenance_request_log
               WHERE equipment_maintenance_request_id = emr.id
               ORDER BY created_at DESC, id DESC LIMIT 1) = 3 AS has_update
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       LEFT JOIN (
         SELECT e.id, e.name
         FROM employees e
         JOIN model_has_roles mhr ON e.id = mhr.model_id
         JOIN roles r ON mhr.role_id = r.id
         WHERE r.name = 'pengelola_aset'
           AND mhr.model_type = 'App\\\\Models\\\\User'
       ) pengelola ON emr.employee_id = pengelola.id
       ${where}
       ORDER BY emr.reported_at DESC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset]
    );

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pj/maintenance/index', { // Changed to point directly to the specific view
      title:       'Permohonan Maintenance',
      currentPath: '/maintenance',
      userRole:    req.session.userRole,
      userName:    req.session.username,
      flash,
      maintenance,
      STATUS_INFO,
      search,
      page,
      totalPages,
      total,
      themeMode:   'light' 
    });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /maintenance/buat  — form buat permohonan
// ══════════════════════════════════════════════════════════════════════════════
const create = async (req, res, next) => {
  try {
    const pjEmployeeId = req.session.userId;

    // Ambil daftar laporan yang berstatus reported
    const [laporan] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, emr.issue_description, emr.reported_at
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       WHERE emr.status = 'reported'
       ORDER BY emr.reported_at DESC`
    );

    const selectedLaporanId = req.query.laporan_id || '';

    res.render('pj/maintenance/create', { // Changed view path
      title:            'Buat Permohonan Maintenance',
      currentPath:      '/maintenance',
      userRole:         req.session.userRole,
      userName:         req.session.userName,
      flash:            null,
      laporan,
      errors:           null,
      old:              { laporan_id: selectedLaporanId },
      themeMode:        'light'
    });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /maintenance  — simpan permohonan (auto-assign pengelola LIMIT 1)
// ══════════════════════════════════════════════════════════════════════════════
const store = async (req, res, next) => {
  const pjEmployeeId = req.session.userId;
  const { laporan_id } = req.body;

  const errors = [];
  if (!laporan_id) errors.push({ field: 'laporan_id', msg: 'Laporan wajib dipilih.' });

  const renderForm = async (errs, old) => {
    const [laporan] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, emr.issue_description, emr.reported_at
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       WHERE emr.status = 'reported'
       ORDER BY emr.reported_at DESC`
    );
    return res.render('pj/maintenance/create', { // Changed view path
      title:       'Buat Permohonan Maintenance',
      currentPath: '/maintenance',
      userRole:    req.session.userRole,
      userName:    req.session.username,
      flash:       null,
      laporan,
      errors:      errs,
      old,
      themeMode:   'light'
    });
  };

  if (errors.length > 0) return renderForm(errors, { laporan_id });

  try {
    const [[laporan]] = await db.query(
      `SELECT emr.id FROM equipment_maintenance_requests emr
       WHERE emr.id = ? AND emr.status = 'reported'`,
      [laporan_id]
    );
    if (!laporan) {
      return renderForm(
        [{ field: 'laporan_id', msg: 'Laporan tidak ditemukan atau sudah diproses.' }],
        { laporan_id }
      );
    }

    const [[pengelola]] = await db.query(
      `SELECT e.id
       FROM employees e
       JOIN model_has_roles mhr ON e.id = mhr.model_id
       JOIN roles r ON mhr.role_id = r.id
       WHERE r.name = 'pengelola_aset'
         AND mhr.model_type = 'App\\\\Models\\\\User'
       LIMIT 1`
    );

    if (!pengelola) {
      return renderForm(
        [{ field: 'laporan_id', msg: 'Tidak ada pengelola aset yang tersedia di sistem SIMAINT.' }],
        { laporan_id }
      );
    }

    // 1. Update status laporan awal menjadi 'in_progress' dan kaitkan dengan ID pengelola aset yang ditunjuk otomatis
    await db.query(
      `UPDATE equipment_maintenance_requests
       SET status = 'in_progress', employee_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [pengelola.id, laporan_id]
    );

    // 2. Insert log historis penugasan (status = 1: Created/Dilaporkan)
    // Catatan: kolom `log` di DB varchar(45) — judul singkat saja; detail ke `description`
    const logId = await nextLogId();
    await db.query(
      `INSERT INTO equipment_maintenance_request_log
          (id, equipment_maintenance_request_id, log, logged_by, logged_at, description, status, created_at, updated_at)
       VALUES (?, ?, 'Permohonan maintenance dibuat', ?, NOW(), 'Permohonan dibuat otomatis oleh Penanggung Jawab', 1, NOW(), NOW())`,
      [logId, laporan_id, pjEmployeeId]
    );

    req.session.flash = { type: 'success', message: 'Permohonan maintenance berhasil dibuat.' };
    res.redirect('/maintenance');
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /maintenance/:id  — detail permohonan + timeline log
// ══════════════════════════════════════════════════════════════════════════════
const show = async (req, res, next) => {
  try {
    const pjEmployeeId = req.session.userId;
    const { id } = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.reported_at, emr.resolved_at,
              a.name AS equipment_name, a.code AS equipment_code,
              e_by.name AS reported_by_name,
              pengelola.name AS pengelola_name
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       JOIN users e_by ON emr.reported_by = e_by.id
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
        error:   { status: 404, stack: 'Permohonan maintenance dengan ID tersebut tidak ada.' },
      });
    }

    const [logs] = await db.query(
      `SELECT emrl.*, e.name AS logged_by_name, ev.name AS verified_by_name
       FROM equipment_maintenance_request_log emrl
       LEFT JOIN users e  ON emrl.logged_by   = e.id
       LEFT JOIN users ev ON emrl.verified_by = ev.id
       WHERE emrl.equipment_maintenance_request_id = ?
       ORDER BY emrl.created_at ASC`,
      [id]
    );

    // Cek status log progres untuk kontrol validasi tombol aksi (status 3 = Progress Update dari Pengelola Aset)
    const hasProgress = logs.some(lg => lg.status === 3);
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
    const canAction = lastLog && lastLog.status === 3;

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pj/maintenance/show', { // Changed view path
      title:       `Maintenance #${String(id).padStart(5, '0')}`,
      currentPath: '/maintenance',
      userRole:    req.session.userRole,
      userName:    req.session.username,
      flash,
      laporan,
      logs,
      STATUS_INFO,
      hasProgress,
      canAction,
      themeMode:   'light'
    });
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /maintenance/:id/close  — tutup permohonan (selesai)
// ══════════════════════════════════════════════════════════════════════════════
const close = async (req, res, next) => {
  const pjEmployeeId = req.session.userId;
  const { id } = req.params;
  try {
    const [[laporan]] = await db.query(
      `SELECT emr.id FROM equipment_maintenance_requests emr
       WHERE emr.id = ?`,
      [id]
    );
    if (!laporan) {
      req.session.flash = { type: 'error', message: 'Permohonan tidak ditemukan.' };
      return res.redirect('/maintenance');
    }

    // Validasi: Status log terakhir wajib bernilai 3
    const [latestLogs] = await db.query(
      `SELECT status FROM equipment_maintenance_request_log
       WHERE equipment_maintenance_request_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [id]
    );
    const lastLog = latestLogs.length > 0 ? latestLogs[0] : null;
    if (!lastLog || lastLog.status !== 3) {
      req.session.flash = {
        type: 'error',
        message: 'Permohonan tidak dapat ditutup. Menunggu konfirmasi penyelesaian atau update progres baru dari pihak pengelola.',
      };
      return res.redirect(`/maintenance/${id}`);
    }

    // Update status berkas utama laporan -> 'resolved'
    await db.query(
      `UPDATE equipment_maintenance_requests
       SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    // Kirim entri log final penutupan laporan (status 5 = Resolved/Closed)
    const logId = await nextLogId();
    await db.query(
      `INSERT INTO equipment_maintenance_request_log
          (id, equipment_maintenance_request_id, log, logged_by, logged_at, description, status, created_at, updated_at)
       VALUES (?, ?, 'Permohonan ditutup', ?, NOW(), 'Disetujui dan ditutup oleh Penanggung Jawab', 5, NOW(), NOW())`,
      [logId, id, pjEmployeeId]
    );

    req.session.flash = { type: 'success', message: 'Permohonan maintenance berhasil ditutup dan dinyatakan selesai.' };
    res.redirect('/maintenance');
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /maintenance/:id/revisi  — minta revisi jika hasil kerja kurang memuaskan
// ══════════════════════════════════════════════════════════════════════════════
const revisi = async (req, res, next) => {
  const pjEmployeeId = req.session.userId;
  const { id }    = req.params;
  const { catatan } = req.body;

  if (!catatan || catatan.trim().length < 10) {
    req.session.flash = {
      type: 'error',
      message: 'Catatan instruksi revisi wajib dilampirkan minimal 10 karakter.',
    };
    return res.redirect(`/maintenance/${id}`);
  }

  try {
    const [latestLogs] = await db.query(
      `SELECT status FROM equipment_maintenance_request_log
       WHERE equipment_maintenance_request_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [id]
    );
    const lastLog = latestLogs.length > 0 ? latestLogs[0] : null;
    if (!lastLog || lastLog.status !== 3) {
      req.session.flash = {
        type: 'error',
        message: 'Tidak dapat meminta revisi. Log terakhir harus berupa klaim progres dari pengelola.',
      };
      return res.redirect(`/maintenance/${id}`);
    }

    const [[laporan]] = await db.query(
      `SELECT emr.id FROM equipment_maintenance_requests emr
       WHERE emr.id = ?`,
      [id]
    );
    if (!laporan) {
      req.session.flash = { type: 'error', message: 'Permohonan tidak ditemukan.' };
      return res.redirect('/maintenance');
    }

    // Menyisipkan log baru dengan status 4 (Revision Requested) tanpa mengubah status global 'in_progress' pada tabel utama
    const logId = await nextLogId();
    await db.query(
      `INSERT INTO equipment_maintenance_request_log
          (id, equipment_maintenance_request_id, log, logged_by, logged_at, description, status, created_at, updated_at)
       VALUES (?, ?, 'Revisi diminta', ?, NOW(), ?, 4, NOW(), NOW())`,
      [logId, id, pjEmployeeId, catatan.trim()]
    );

    req.session.flash = { type: 'success', message: 'Catatan revisi berhasil dikirim ke pengelola.' };
    res.redirect(`/maintenance/${id}`);
  } catch (err) { next(err); }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /maintenance/rekap-pdf  — Generate PDF Rekap Bulanan
// ══════════════════════════════════════════════════════════════════════════════
const downloadRekapBulanan = async (req, res, next) => {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    
    res.setHeader('Content-disposition', 'attachment; filename="Rekap_Laporan_Maintenance_Bulanan.pdf"');
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Header FTI
    // Coba gunakan file logo yang sudah ada, misalnya logo_unand.png atau default hunvreus.png
    let logoPath = path.join(__dirname, '../public/assets/images/logo_unand.png');
    if (!fs.existsSync(logoPath)) {
      // fallback if logo-unand is not present yet
      logoPath = path.join(__dirname, '../public/assets/hunvreus.png');
    }
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 60 });
    }

    doc.font('Times-Roman')
       .fontSize(14)
       .text('KEMENTERIAN PENDIDIKAN TINGGI, SAINS DAN TEKNOLOGI', 120, 45, { align: 'center' })
       .text('UNIVERSITAS ANDALAS', 120, 60, { align: 'center' })
       .font('Times-Bold')
       .text('FAKULTAS TEKNOLOGI INFORMASI', 120, 75, { align: 'center' })
       .font('Times-Roman')
       .fontSize(10)
       .text('Kampus Universitas Andalas, Limau Manis, Padang - 25163', 120, 90, { align: 'center' })
       .text('website: http://fti.unand.ac.id email: sekretariat@it.unand.ac.id', 120, 105, { align: 'center' });

    doc.moveTo(50, 125).lineTo(545, 125).lineWidth(2).stroke();
    doc.moveTo(50, 128).lineTo(545, 128).lineWidth(1).stroke();
    doc.moveDown(2);

    // Title
    doc.font('Helvetica-Bold').fontSize(14).text('REKAP LAPORAN MAINTENANCE PERALATAN BULANAN', { align: 'center' });
    doc.moveDown(1.5);

    // Fetch data
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'reported' THEN 1 ELSE 0 END) as reported,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM equipment_maintenance_requests
      WHERE MONTH(reported_at) = MONTH(CURRENT_DATE()) AND YEAR(reported_at) = YEAR(CURRENT_DATE())
    `);

    doc.font('Helvetica-Bold').fontSize(11).text('Ringkasan Statistik Bulan Ini:', 50, doc.y);
    doc.font('Helvetica').fontSize(10);
    const statObj = stats[0] || { total:0, reported:0, in_progress:0, resolved:0 };
    doc.text(`Total Laporan : ${statObj.total || 0}`);
    doc.text(`Dilaporkan (reported) : ${statObj.reported || 0}`);
    doc.text(`Dalam Proses (in_progress) : ${statObj.in_progress || 0}`);
    doc.text(`Selesai (resolved) : ${statObj.resolved || 0}`);
    doc.moveDown(1.5);

    // Table Data
    const [maintenance] = await db.query(`
      SELECT emr.reported_at, a.code AS equipment_code, a.name AS equipment_name, eq.brand,
             e_by.name AS pelapor_name, emr.status, emr.issue_description
      FROM equipment_maintenance_requests emr
      JOIN equipments eq ON emr.equipment_id = eq.id
      JOIN assets a ON eq.asset_id = a.id
      JOIN users e_by ON emr.reported_by = e_by.id
      WHERE MONTH(emr.reported_at) = MONTH(CURRENT_DATE()) AND YEAR(emr.reported_at) = YEAR(CURRENT_DATE())
      ORDER BY emr.reported_at DESC
    `);

    // Draw Table
    const tableTop = doc.y;
    const colWidths = [60, 70, 100, 70, 100, 70];
    const headers = ['Tanggal', 'Kode Aset', 'Nama Aset', 'Merek', 'Pelapor', 'Status'];

    let currentY = tableTop;
    
    // Function to check if page break is needed
    const checkPageBreak = (height) => {
        if (currentY + height > 750) {
            doc.addPage();
            currentY = 50;
            return true;
        }
        return false;
    };

    doc.font('Helvetica-Bold').fontSize(9);
    let startX = 50;
    headers.forEach((h, i) => {
       doc.text(h, startX, currentY);
       startX += colWidths[i];
    });
    currentY += 15;
    doc.moveTo(50, currentY).lineTo(545, currentY).lineWidth(1).stroke();
    currentY += 5;

    doc.font('Helvetica').fontSize(9);
    maintenance.forEach(row => {
       const tgl = new Date(row.reported_at).toLocaleDateString('id-ID');
       const descText = `Deskripsi Kerusakan: ${row.issue_description || '-'}`;
       const descHeight = doc.heightOfString(descText, { width: 495, fontSize: 8 });
       
       checkPageBreak(15 + descHeight + 15);

       startX = 50;
       doc.text(tgl, startX, currentY);
       startX += colWidths[0];
       
       doc.text(row.equipment_code || '-', startX, currentY, { width: colWidths[1]-5 });
       startX += colWidths[1];

       doc.text(row.equipment_name || '-', startX, currentY, { width: colWidths[2]-5 });
       startX += colWidths[2];

       doc.text(row.brand || '-', startX, currentY, { width: colWidths[3]-5 });
       startX += colWidths[3];

       doc.text(row.pelapor_name || '-', startX, currentY, { width: colWidths[4]-5 });
       startX += colWidths[4];

       doc.text(row.status, startX, currentY, { width: colWidths[5]-5 });

       currentY += 15;
       doc.font('Helvetica-Oblique').fontSize(8);
       doc.text(descText, 50, currentY, { width: 495 });
       doc.font('Helvetica').fontSize(9);
       
       currentY += descHeight + 5;
       doc.moveTo(50, currentY).lineTo(545, currentY).lineWidth(0.5).stroke();
       currentY += 5;
    });

    // Add page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8);
      const printDate = new Date().toLocaleString('id-ID');
      doc.text(`Dicetak pada: ${printDate}`, 50, 780, { align: 'left' });
      doc.text(`Halaman ${i + 1} dari ${pages.count}`, 50, 780, { align: 'right' });
    }

    doc.end();

  } catch (err) { next(err); }
};

module.exports = { index, create, store, show, close, revisi, downloadRekapBulanan };
