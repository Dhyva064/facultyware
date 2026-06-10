const db = require('../lib/db');

const PAGE_SIZE = 10;

const STATUS_INFO = {
  reported:    { text: 'Dilaporkan', bg: '#fffbeb', color: '#a16207',  border: '#fde68a' },
  in_progress: { text: 'Diproses',   bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
  resolved:    { text: 'Selesai',    bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0' },
};

/**
 * Relasi DB yang benar:
 *  - equipments.asset_id → assets.id         (nama alat di assets)
 *  - emr.equipment_id    → equipments.id
 *  - emr.employee_id     → employees.id       (PJ/pengelola yang di-assign)
 *  - emr.reported_by     → users.id
 *  - TIDAK ADA relasi langsung equipments → rooms
 *  - Filter milik PJ: WHERE emr.employee_id = <employeeId>
 */

// Helper: dapatkan employee_id dari user_id
async function getEmployeeId(userId) {
  const [[emp]] = await db.query(
    'SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]
  );
  return emp ? emp.id : null;
}

// GET /dashboard — Dashboard PJ
const getDashboard = async (req, res, next) => {
  try {
    const userId        = req.session.userId;
    const employeeId    = await getEmployeeId(userId);
    const currentFilter = req.query.filter === 'my' ? 'my' : 'all';

    let baseWhere = '';
    let params    = [];
    if (currentFilter === 'my' && employeeId) {
      baseWhere = 'WHERE emr.employee_id = ?';
      params    = [employeeId];
    }

    const [[{ total: totalCount }]] = await db.query(
      `SELECT COUNT(*) as total FROM equipment_maintenance_requests emr ${baseWhere}`, params
    );
    const [stats] = await db.query(
      `SELECT emr.status, COUNT(*) as total FROM equipment_maintenance_requests emr ${baseWhere} GROUP BY emr.status`, params
    );
    const [[{ total: maintenanceCount }]] = await db.query(
      `SELECT COUNT(*) as total FROM equipment_maintenance_requests emr ${baseWhere}
       ${baseWhere ? 'AND' : 'WHERE'} emr.status IN ('reported','in_progress')`, params
    );
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
      dashboardView: 'pj/index',
      totalCount,
      stats,
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

// GET /pj/laporan — Daftar laporan
const index = async (req, res, next) => {
  try {
    const userId        = req.session.userId;
    const employeeId    = await getEmployeeId(userId);
    const search        = req.query.search || '';
    const status        = req.query.status || '';
    const page          = Math.max(1, parseInt(req.query.page) || 1);
    const offset        = (page - 1) * PAGE_SIZE;

    // PJ hanya lihat laporan yang di-assign kepadanya
    const whereClauses  = ['emr.employee_id = ?'];
    const params        = [employeeId];

    if (search) {
      whereClauses.push('a.name LIKE ?');
      params.push(`%${search}%`);
    }
    if (status && ['reported', 'in_progress', 'resolved'].includes(status)) {
      whereClauses.push('emr.status = ?');
      params.push(status);
    }

    const where = 'WHERE ' + whereClauses.join(' AND ');

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
      `SELECT emr.id, a.name AS equipment_name,
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

    res.render('home', {
      pageTitle:     'Daftar Laporan Aset | SIMAINT',
      user:          req.session?.username || 'User SIMAINT',
      userEmail:     req.session?.userEmail || 'pj@ftiunand.ac.id',
      roleLabel:     'Penanggung Jawab',
      roleSummary:   'Daftar seluruh laporan kerusakan aset pada laboratorium wewenang Anda.',
      dashboardView: 'pj/index',
      flash,
      laporan,
      STATUS_INFO,
      search,
      status,
      page,
      totalPages,
      total,
    });
  } catch (err) { next(err); }
};

// GET /pj/laporan/:id — Detail laporan
const show = async (req, res, next) => {
  try {
    const userId     = req.session.userId;
    const employeeId = await getEmployeeId(userId);
    const { id }     = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.reported_at, emr.resolved_at,
              a.name AS equipment_name,
              u.name AS reported_by_name, u.email AS reported_by_email
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       JOIN users u       ON emr.reported_by   = u.id
       WHERE emr.id = ? AND emr.employee_id = ?`,
      [id, employeeId]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Laporan tidak ditemukan',
        error:   { status: 404, stack: 'Laporan alat tidak tersedia atau di luar wewenang Anda.' },
      });
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

    res.render('home', {
      pageTitle:     `Detail Laporan #${String(id).padStart(5, '0')} | SIMAINT`,
      user:          req.session?.username || 'User SIMAINT',
      userEmail:     req.session?.userEmail || 'pj@ftiunand.ac.id',
      roleLabel:     'Penanggung Jawab',
      roleSummary:   'Detail riwayat dan status penanganan kerusakan aset.',
      dashboardView: 'pj/index',
      flash,
      laporan,
      logs,
      STATUS_INFO,
    });
  } catch (err) { next(err); }
};

// GET /pj/laporan/:id/edit — Form edit laporan
const edit = async (req, res, next) => {
  try {
    const userId     = req.session.userId;
    const employeeId = await getEmployeeId(userId);
    const { id }     = req.params;

    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.issue_description, emr.status, emr.equipment_id,
              a.name AS equipment_name
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       WHERE emr.id = ? AND emr.employee_id = ?`,
      [id, employeeId]
    );

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Laporan tidak ditemukan',
        error:   { status: 404, stack: 'Laporan tidak ditemukan atau di luar kendali Anda.' },
      });
    }

    if (laporan.status !== 'reported') {
      req.session.flash = { type: 'error', message: 'Laporan yang telah diproses tidak dapat diubah.' };
      return res.redirect(`/pj/laporan/${id}`);
    }

    // Daftar semua alat yang bisa dipilih
    const [equipments] = await db.query(
      `SELECT eq.id, a.name
       FROM equipments eq
       JOIN assets a ON eq.asset_id = a.id
       ORDER BY a.name`
    );

    res.render('home', {
      pageTitle:     `Edit Laporan #${String(id).padStart(5, '0')} | SIMAINT`,
      user:          req.session?.username || 'User SIMAINT',
      userEmail:     req.session?.userEmail || 'pj@ftiunand.ac.id',
      roleLabel:     'Penanggung Jawab',
      dashboardView: 'pj/index',
      flash:         null,
      laporan,
      equipments,
      errors:        null,
      old:           { equipment_id: laporan.equipment_id, issue_description: laporan.issue_description },
    });
  } catch (err) { next(err); }
};

// POST /pj/laporan/:id — Update laporan
const update = async (req, res, next) => {
  const userId     = req.session.userId;
  const { id }     = req.params;
  const { equipment_id, issue_description } = req.body;

  const errors = [];
  if (!equipment_id)
    errors.push({ field: 'equipment_id', msg: 'Alat/Aset laboratorium wajib dipilih.' });
  if (!issue_description || issue_description.trim().length < 20)
    errors.push({ field: 'issue_description', msg: 'Deskripsi kerusakan minimal 20 karakter.' });

  if (errors.length > 0) {
    try {
      const employeeId = await getEmployeeId(userId);
      const [[laporan]] = await db.query(
        `SELECT emr.id, emr.issue_description, emr.status, a.name AS equipment_name
         FROM equipment_maintenance_requests emr
         JOIN equipments eq ON emr.equipment_id = eq.id
         JOIN assets a      ON eq.asset_id       = a.id
         WHERE emr.id = ? AND emr.employee_id = ?`,
        [id, employeeId]
      );
      const [equipments] = await db.query(
        `SELECT eq.id, a.name FROM equipments eq JOIN assets a ON eq.asset_id = a.id ORDER BY a.name`
      );
      return res.render('home', {
        pageTitle:     'Edit Laporan | SIMAINT',
        user:          req.session?.username || 'User SIMAINT',
        roleLabel:     'Penanggung Jawab',
        dashboardView: 'pj/index',
        flash:         null,
        laporan,
        equipments,
        errors,
        old: { equipment_id, issue_description },
      });
    } catch (e) { return next(e); }
  }

  try {
    const [[currentLaporan]] = await db.query(
      'SELECT status FROM equipment_maintenance_requests WHERE id = ?', [id]
    );
    if (currentLaporan && currentLaporan.status !== 'reported') {
      req.session.flash = { type: 'error', message: 'Laporan yang telah berjalan tidak bisa diubah.' };
      return res.redirect(`/pj/laporan/${id}`);
    }

    await db.query(
      `UPDATE equipment_maintenance_requests
       SET issue_description = ?, equipment_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [issue_description.trim(), equipment_id, id]
    );

    req.session.flash = { type: 'success', message: 'Laporan aset berhasil diperbarui.' };
    res.redirect(`/pj/laporan/${id}`);
  } catch (err) { next(err); }
};

// DELETE /pj/laporan/:id — Hapus laporan
const destroy = async (req, res, next) => {
  const userId = req.session.userId;
  const { id } = req.params;
  try {
    const employeeId = await getEmployeeId(userId);
    const [[laporan]] = await db.query(
      `SELECT emr.id, emr.status FROM equipment_maintenance_requests emr
       WHERE emr.id = ? AND emr.employee_id = ?`,
      [id, employeeId]
    );
    if (!laporan) {
      req.session.flash = { type: 'error', message: 'Laporan tidak ditemukan atau melanggar hak akses.' };
      return res.redirect('/pj/laporan');
    }
    if (laporan.status !== 'reported') {
      req.session.flash = { type: 'error', message: 'Laporan sedang diproses, tidak boleh dihapus.' };
      return res.redirect(`/pj/laporan/${id}`);
    }

    await db.query('DELETE FROM equipment_maintenance_request_log WHERE equipment_maintenance_request_id = ?', [id]);
    await db.query('DELETE FROM equipment_maintenance_requests WHERE id = ?', [id]);

    req.session.flash = { type: 'success', message: 'Laporan kerusakan aset berhasil dihapus permanen.' };
    res.redirect('/pj/laporan');
  } catch (err) { next(err); }
};

module.exports = { getDashboard, index, show, edit, update, destroy };