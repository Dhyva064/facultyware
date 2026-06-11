const db = require('../lib/db');

const PAGE_SIZE = 10;

function pjLocals(req, extra = {}) {
  return {
    userRole:  req.session.userRole || 'penanggung_jawab',
    userName:  req.session.username || 'User SIMAINT',
    user:      req.session.username || 'User SIMAINT',
    userEmail: req.session.userEmail || '',
    roleLabel: 'Penanggung Jawab',
    themeMode: 'light',
    ...extra,
  };
}

async function resolveEmployeeId(req) {
  if (req.session.employeeId) return req.session.employeeId;
  const userId = req.session.userId;
  if (!userId) return null;
  const [[emp]] = await db.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
  return emp ? emp.id : null;
}

const STATUS_INFO = {
  reported:    { text: 'Dilaporkan', bg: '#fffbeb', color: '#a16207',  border: '#fde68a' },
  in_progress: { text: 'Diproses',   bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
  resolved:    { text: 'Selesai',    bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0' },
};

// GET /dashboard — Dashboard PJ
const getDashboard = async (req, res, next) => {
  try {
    const currentFilter = req.query.filter === 'my' ? 'my' : 'all';
    const pjEmployeeId  = await resolveEmployeeId(req);

    let baseWhere = '';
    let params    = [];
    if (currentFilter === 'my' && pjEmployeeId) {
      baseWhere = 'WHERE emr.employee_id = ?';
      params    = [pjEmployeeId];
    }
    const joinEq = 'JOIN equipments eq ON emr.equipment_id = eq.id';

    const [[{ total: totalCount }]] = await db.query(
      `SELECT COUNT(*) as total FROM equipment_maintenance_requests emr ${joinEq} ${baseWhere}`, params
    );
  
    // MODIFIKASI: Mengubah query 'stats' sebelumnya menjadi 'rawStats'
    const [rawStats] = await db.query(
      `SELECT emr.status, COUNT(*) as total FROM equipment_maintenance_requests emr 
       ${joinEq} 
       ${baseWhere} GROUP BY emr.status`, params
    );

    // MODIFIKASI: Memetakan rawStats ke dalam objek 'stats' agar langsung terbaca oleh home.ejs
    const stats = {
      menunggu: 0,
      dalamPengerjaan: 0,
      selesaiBulanIni: 0
    };

    rawStats.forEach(row => {
      if (row.status === 'reported') stats.menunggu = row.total;
      if (row.status === 'in_progress') stats.dalamPengerjaan = row.total;
      if (row.status === 'resolved') stats.selesaiBulanIni = row.total;
    });

    // PENGEMBALIAN: Menambahkan kembali query maintenanceCount yang sempat hilang di snippet Anda
    const [[{ total: maintenanceCount }]] = await db.query(
      `SELECT COUNT(*) as total FROM equipment_maintenance_requests emr ${joinEq}
       ${baseWhere} AND emr.status IN ('reported','in_progress')`, params
    );
    
    // MODIFIKASI: Pastikan list recent laporan juga terkunci untuk aset milik PJ ini
    const [recentLaporan] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, u.name AS reported_by_name,
              emr.issue_description, emr.status, emr.reported_at
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       JOIN users u       ON emr.reported_by   = u.id
       ${baseWhere}
       ORDER BY emr.reported_at DESC LIMIT 5`, params
    );

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('home', {
      pageTitle:     'Dashboard | SIMAINT',
      user:          req.session?.username || 'User SIMAINT',
      userEmail:     req.session?.userEmail || 'pj@ftiunand.ac.id',
      roleLabel:     'Penanggung Jawab',
      roleSummary:   'Meninjau pengajuan, memantau aset unit, dan menjalankan proses persetujuan yang menjadi kewenangan unit.',
      dashboardView: 'home',
      totalCount,
      stats,             // MODIFIKASI: Sekarang mengirimkan objek format baru (menunggu, dalamPengerjaan, selesaiBulanIni)
      maintenanceCount,
      recentLaporan,
      currentFilter,
      flash,
    });
  } catch (err) {
    console.error("DEBUG ERROR:", err);
    return next(err);
  }
};

// GET /laporan — Daftar laporan
const index = async (req, res, next) => {
  try {
    const search        = req.query.search || '';
    const status        = req.query.status || '';
    const page          = Math.max(1, parseInt(req.query.page) || 1);
    const offset        = (page - 1) * PAGE_SIZE;

    const whereClauses  = [];
    const params        = [];

    if (search) {
      whereClauses.push('a.name LIKE ?');
      params.push(`%${search}%`);
    }
    if (status && ['reported', 'in_progress', 'resolved'].includes(status)) {
      whereClauses.push('emr.status = ?');
      params.push(status);
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       JOIN users u       ON emr.reported_by   = u.id
       ${where}`,
      params
    );

    const [laporan] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, a.code AS equipment_code,
              u.name AS reported_by_name, emr.issue_description,
              emr.status, emr.reported_at
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       JOIN users u       ON emr.reported_by   = u.id
       ${where}
       ORDER BY emr.reported_at DESC
       LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset]
    );

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pj/laporan/index', pjLocals(req, {
      pageTitle:   'Daftar Laporan Aset | SIMAINT',
      roleSummary: 'Daftar seluruh laporan kerusakan aset pada laboratorium wewenang Anda.',
      flash,
      laporan,
      STATUS_INFO,
      search,
      status,
      page,
      totalPages,
      total,
    }));
  } catch (err) { next(err); }
};

// GET /laporan/:id — Detail laporan
const show = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.reported_at, emr.resolved_at,
              a.name AS equipment_name, a.code AS equipment_code,
              u.name AS reported_by_name, u.email AS reported_by_email
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       JOIN users u       ON emr.reported_by   = u.id
       WHERE emr.id = ?`,
      [id]
    );

    if (!laporan) {
      req.session.flash = { type: 'error', message: 'Laporan tidak ditemukan.' };
      return res.redirect('/laporan');
    }

    const [logs] = await db.query(
      `SELECT emrl.*, u.name AS logged_by_name
       FROM equipment_maintenance_request_log emrl
       LEFT JOIN users u ON emrl.logged_by = u.id
       WHERE emrl.equipment_maintenance_request_id = ?
       ORDER BY emrl.created_at ASC`,
      [id]
    );

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pj/laporan/show', pjLocals(req, {
      pageTitle:   `Detail Laporan #${String(id).padStart(5, '0')} | SIMAINT`,
      roleSummary: 'Detail riwayat dan status penanganan kerusakan aset.',
      flash,
      laporan,
      logs,
      STATUS_INFO,
    }));
  } catch (err) { next(err); }
};

// GET /laporan/:id/edit — Form edit laporan
const edit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.equipment_id,
              a.name AS equipment_name
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       WHERE emr.id = ?`,
      [id]
    );

    if (!laporan) {
      req.session.flash = { type: 'error', message: 'Laporan tidak ditemukan.' };
      return res.redirect('/laporan');
    }

    if (laporan.status !== 'reported') {
      req.session.flash = { type: 'error', message: 'Laporan yang telah diproses tidak dapat diubah.' };
      return res.redirect(`/laporan/${id}`);
    }

    const [equipments] = await db.query(
      `SELECT eq.id, a.code AS asset_code, a.name AS asset_name
       FROM equipments eq
       JOIN assets a ON eq.asset_id = a.id
       ORDER BY a.name`
    );

    res.render('pj/laporan/edit', pjLocals(req, {
      pageTitle: `Edit Laporan #${String(id).padStart(5, '0')} | SIMAINT`,
      flash:     null,
      laporan,
      equipments,
      errors:    null,
      old:       { equipment_id: laporan.equipment_id, issue_description: laporan.issue_description },
    }));
  } catch (err) { next(err); }
};

// POST /laporan/:id — Update laporan
const update = async (req, res, next) => {
  const { id } = req.params;
  const { equipment_id, issue_description } = req.body;

  const errors = [];
  if (!equipment_id)
    errors.push({ field: 'equipment_id', msg: 'Alat/Aset laboratorium wajib dipilih.' });
  if (!issue_description || issue_description.trim().length < 20)
    errors.push({ field: 'issue_description', msg: 'Deskripsi kerusakan minimal 20 karakter.' });

  if (errors.length > 0) {
    try {
      const [[laporan]] = await db.query(
        `SELECT emr.id, emr.issue_description, emr.status, a.name AS equipment_name
         FROM equipment_maintenance_requests emr
         JOIN equipments eq ON emr.equipment_id = eq.id
         JOIN assets a      ON eq.asset_id       = a.id
         WHERE emr.id = ?`,
        [id]
      );

      const [equipments] = await db.query(
        `SELECT eq.id, a.code AS asset_code, a.name AS asset_name
         FROM equipments eq JOIN assets a ON eq.asset_id = a.id
         ORDER BY a.name`
      );
      
      return res.render('pj/laporan/edit', pjLocals(req, {
        pageTitle: 'Edit Laporan | SIMAINT',
        flash:     null,
        laporan,
        equipments,
        errors,
        old: { equipment_id, issue_description },
      }));
    } catch (e) { return next(e); }
  }

  try {
    const [[currentLaporan]] = await db.query(
      'SELECT status FROM equipment_maintenance_requests WHERE id = ?',
      [id]
    );

    if (!currentLaporan) {
      req.session.flash = { type: 'error', message: 'Laporan tidak ditemukan.' };
      return res.redirect('/laporan');
    }
    
    if (currentLaporan.status !== 'reported') {
      req.session.flash = { type: 'error', message: 'Laporan yang telah berjalan tidak bisa diubah.' };
      return res.redirect(`/laporan/${id}`);
    }

    await db.query(
      `UPDATE equipment_maintenance_requests
       SET issue_description = ?, equipment_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [issue_description.trim(), equipment_id, id]
    );

    req.session.flash = { type: 'success', message: 'Laporan aset berhasil diperbarui.' };
    res.redirect(`/laporan/${id}`);
  } catch (err) { next(err); }
};

// DELETE /laporan/:id — Hapus laporan
const destroy = async (req, res, next) => {
  const { id } = req.params;

  try {
    const [[laporan]] = await db.query(
      'SELECT id, status FROM equipment_maintenance_requests WHERE id = ?',
      [id]
    );

    if (!laporan) {
      req.session.flash = { type: 'error', message: 'Laporan tidak ditemukan.' };
      return res.redirect('/laporan');
    }
    if (laporan.status !== 'reported') {
      req.session.flash = { type: 'error', message: 'Laporan sedang diproses, tidak boleh dihapus.' };
      return res.redirect(`/laporan/${id}`);
    }

    await db.query('DELETE FROM equipment_maintenance_request_log WHERE equipment_maintenance_request_id = ?', [id]);
    await db.query('DELETE FROM equipment_maintenance_requests WHERE id = ?', [id]);

    req.session.flash = { type: 'success', message: 'Laporan kerusakan aset berhasil dihapus permanen.' };
    res.redirect('/laporan');
  } catch (err) { next(err); }
};

module.exports = { getDashboard, index, show, edit, update, destroy };