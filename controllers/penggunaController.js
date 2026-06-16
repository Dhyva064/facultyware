const fs = require('fs');
const db = require('../lib/db');

const PAGE_SIZE = 10;

// ── Helper: Ambil user ID dari session ──────────────────────────────────────
async function getUserId(req) {
  return req.session.userId || null;
}

// ── Helper: Format tanggal ke format Indonesia ──────────────────────────────
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
}

// ── Helper: Truncate text ──────────────────────────────────────────────────
function trunc(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n) + '…' : s;
}

// Status info colors
const STATUS_INFO = {
  reported:    { text: 'Dilaporkan', bg: '#fffbeb', color: '#a16207',  border: '#fde68a' },
  in_progress: { text: 'Diproses',   bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
  resolved:    { text: 'Selesai',    bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0' },
};

function cleanupUploadedFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

async function nextLogId() {
  const [[{ nid }]] = await db.query(
    'SELECT COALESCE(MAX(id), 0) + 1 AS nid FROM equipment_maintenance_request_log'
  );
  return nid;
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /laporan — Daftar laporan kerusakan aset milik pengguna
// ══════════════════════════════════════════════════════════════════════════════
const getList = async (req, res, next) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.redirect('/login');

    const search = req.query.search || '';
    const status = req.query.status || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    // Tentukan employee ID untuk filter laporan
    let reportedByEmployeeId = userId;
    const [[userAsEmployee]] = await db.query(
      'SELECT id FROM employees WHERE id = ?',
      [userId]
    );
    
    if (!userAsEmployee) {
      // Jika user bukan employee, gunakan default employee
      const [[defaultEmployee]] = await db.query(
        'SELECT id FROM employees LIMIT 1'
      );
      reportedByEmployeeId = defaultEmployee?.id || 1;
    }

    // Build WHERE clause
    const whereParts = ['emr.reported_by = ?'];
    const params = [reportedByEmployeeId];

    if (search) {
      whereParts.push('(a.name LIKE ? OR emr.issue_description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status && ['reported', 'in_progress', 'resolved'].includes(status)) {
      whereParts.push('emr.status = ?');
      params.push(status);
    }

    const where = 'WHERE ' + whereParts.join(' AND ');

    // Count total
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       ${where}`,
      params
    );

    // Get paginated data
    const [laporan] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, a.code AS equipment_code,
              emr.issue_description, emr.status, emr.reported_at,
              (SELECT COUNT(*) FROM equipment_maintenance_request_log
               WHERE equipment_maintenance_request_id = emr.id) AS log_count
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a ON eq.asset_id = a.id
       ${where}
       ORDER BY emr.reported_at DESC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset]
    );

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pengguna/laporan/index', {
      title: 'Laporan Kerusakan Aset',
      currentPath: '/laporan',
      userRole: req.session.userRole,
      userName: req.session.username,
      flash,
      laporan,
      STATUS_INFO,
      search,
      status,
      page,
      totalPages,
      total,
      themeMode: 'light'
    });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /laporan/buat — Form buat laporan kerusakan aset
// ══════════════════════════════════════════════════════════════════════════════
const getCreateForm = async (req, res, next) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.redirect('/login');

    // Ambil daftar aset/peralatan yang tersedia
    const [equipments] = await db.query(
      `SELECT eq.id, a.name AS asset_name, a.code AS asset_code, eq.serial_number
       FROM equipments eq
       JOIN assets a ON eq.asset_id = a.id
       ORDER BY a.name ASC`
    );

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pengguna/laporan/create', {
      title: 'Buat Laporan Kerusakan Aset',
      currentPath: '/laporan',
      userRole: req.session.userRole,
      userName: req.session.username,
      flash,
      equipments,
      errors: null,
      old: {},
      themeMode: 'light'
    });
  } catch (err) {
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /laporan — Simpan laporan kerusakan aset baru
// ══════════════════════════════════════════════════════════════════════════════
const postStore = async (req, res, next) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.redirect('/login');

    const body = req.body || {};
    const { equipment_id, issue_description, severity } = body;

    // Validasi
    const errors = [];
    if (!body.form_source) {
      errors.push({
        field: 'form_source',
        msg: 'Data form tidak terbaca oleh server. Pastikan server sudah direstart setelah perubahan upload.',
      });
    } else if (!equipment_id || equipment_id === '') {
      errors.push({ field: 'equipment_id', msg: 'Silakan pilih peralatan.' });
    }
    if (body.form_source && (!issue_description || issue_description.trim() === '')) {
      errors.push({ field: 'issue_description', msg: 'Deskripsi masalah tidak boleh kosong.' });
    }
    if (body.form_source && issue_description && issue_description.trim().length > 500) {
      errors.push({ field: 'issue_description', msg: 'Deskripsi tidak boleh lebih dari 500 karakter.' });
    }
    if (req.fileValidationError) {
      errors.push({ field: 'foto_kerusakan', msg: req.fileValidationError });
    }

    // Jika ada error, render form kembali
    if (errors.length > 0) {
      cleanupUploadedFile(req.file);
      const [equipments] = await db.query(
        `SELECT eq.id, a.name AS asset_name, a.code AS asset_code, eq.serial_number
         FROM equipments eq
         JOIN assets a ON eq.asset_id = a.id
         ORDER BY a.name ASC`
      );

      return res.render('pengguna/laporan/create', {
        title: 'Buat Laporan Kerusakan Aset',
        currentPath: '/laporan',
        userRole: req.session.userRole,
        userName: req.session.username,
        flash: null,
        equipments,
        errors,
        old: body,
        themeMode: 'light'
      });
    }

    // Check apakah equipment_id valid
    const [[equipment]] = await db.query(
      'SELECT id FROM equipments WHERE id = ?',
      [equipment_id]
    );

    if (!equipment) {
      errors.push({ field: 'equipment_id', msg: 'Peralatan tidak ditemukan.' });
    }

    if (errors.length > 0) {
      cleanupUploadedFile(req.file);
      const [equipments] = await db.query(
        `SELECT eq.id, a.name AS asset_name, a.code AS asset_code, eq.serial_number
         FROM equipments eq
         JOIN assets a ON eq.asset_id = a.id
         ORDER BY a.name ASC`
      );

      return res.render('pengguna/laporan/create', {
        title: 'Buat Laporan Kerusakan Aset',
        currentPath: '/laporan',
        userRole: req.session.userRole,
        userName: req.session.username,
        flash: null,
        equipments,
        errors,
        old: body,
        themeMode: 'light'
      });
    }

    // Simpan ke database
    // Ambil employee_id dari employee yang sesuai atau default employee
    let employeeId = userId;  // Try using userId as employee_id first
    const [[userAsEmployee]] = await db.query(
      'SELECT id FROM employees WHERE id = ?',
      [userId]
    );
    
    if (!userAsEmployee) {
      // Jika user bukan employee, gunakan default employee (PJ/pengelola)
      const [[defaultEmployee]] = await db.query(
        'SELECT id FROM employees LIMIT 1'
      );
      employeeId = defaultEmployee?.id || 1;
    }
    
    const [result] = await db.query(
      `INSERT INTO equipment_maintenance_requests 
       (equipment_id, reported_by, issue_description, status, employee_id, reported_at, created_at, updated_at)
       VALUES (?, ?, ?, 'reported', ?, NOW(), NOW(), NOW())`,
      [equipment_id, employeeId, issue_description.trim(), employeeId]
    );

    if (req.file) {
      const logId = await nextLogId();
      const photoPath = `/uploads/laporan/${req.file.filename}`;
      await db.query(
        `INSERT INTO equipment_maintenance_request_log
           (id, equipment_maintenance_request_id, log, logged_by, logged_at, log_file, description, status, created_at, updated_at)
         VALUES (?, ?, 'Laporan dibuat', ?, NOW(), ?, 'Foto kerusakan diunggah oleh pengguna saat membuat laporan.', 1, NOW(), NOW())`,
        [logId, result.insertId, employeeId, photoPath]
      );
    }

    req.session.flash = {
      type: 'success',
      message: 'Laporan kerusakan aset berhasil dibuat. Tim maintenance akan segera memproses.'
    };

    res.redirect('/laporan');
  } catch (err) {
    cleanupUploadedFile(req.file);
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /laporan/:id — Detail laporan kerusakan aset
// ══════════════════════════════════════════════════════════════════════════════
const getDetail = async (req, res, next) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.redirect('/login');

    const laporanId = req.params.id;

    // Tentukan employee ID untuk filter laporan
    let reportedByEmployeeId = userId;
    const [[userAsEmployee]] = await db.query(
      'SELECT id FROM employees WHERE id = ?',
      [userId]
    );
    
    if (!userAsEmployee) {
      // Jika user bukan employee, gunakan default employee
      const [[defaultEmployee]] = await db.query(
        'SELECT id FROM employees LIMIT 1'
      );
      reportedByEmployeeId = defaultEmployee?.id || 1;
    }

    // Ambil detail laporan
    const [[laporan]] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, a.code AS equipment_code,
              e.serial_number, emr.issue_description,
              emr.status, emr.reported_at, emr.created_at,
              e_reporter.name AS reported_by_name,
              e_pengelola.name AS pengelola_name
       FROM equipment_maintenance_requests emr
       JOIN equipments e ON emr.equipment_id = e.id
       JOIN assets a ON e.asset_id = a.id
       JOIN employees e_reporter ON emr.reported_by = e_reporter.id
       LEFT JOIN employees e_pengelola ON emr.employee_id = e_pengelola.id
       WHERE emr.id = ? AND emr.reported_by = ?`,
      [laporanId, reportedByEmployeeId]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Laporan tidak ditemukan atau Anda tidak memiliki akses.',
        error: { status: 404 }
      });
    }

    // Ambil log progres
    const [logs] = await db.query(
      `SELECT log.id, log.status, log.description, log.created_at,
              e.name AS updated_by
       FROM equipment_maintenance_request_log log
       LEFT JOIN employees e ON log.verified_by = e.id
       WHERE log.equipment_maintenance_request_id = ?
       ORDER BY log.created_at DESC`,
      [laporanId]
    );

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pengguna/laporan/show', {
      title: `Detail Laporan #${laporanId}`,
      currentPath: '/laporan',
      userRole: req.session.userRole,
      userName: req.session.username,
      flash,
      laporan,
      logs,
      STATUS_INFO,
      themeMode: 'light'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getList,
  getCreateForm,
  postStore,
  getDetail
};
