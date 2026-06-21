const fs = require('fs');
const db = require('../lib/db');

const PAGE_SIZE = 10;

const STATUS_INFO = {
  reported: { text: 'Dilaporkan', bg: '#fffbeb', color: '#a16207', border: '#fde68a' },
  in_progress: { text: 'Diproses', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  resolved: { text: 'Selesai', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
};

async function getEmployeeId(req) {
  const userId = req.session.userId;
  const [[emp]] = await db.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
  return emp ? emp.id : userId;
}

async function nextLogId() {
  const [[{ nid }]] = await db.query(
    'SELECT COALESCE(MAX(id), 0) + 1 AS nid FROM equipment_maintenance_request_log'
  );
  return nid;
}

function getFlash(req) {
  const flash = req.session.flash || null;
  delete req.session.flash;
  return flash;
}

function cleanupUploadedFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

async function fetchLogs(laporanId) {
  const [logs] = await db.query(
    `SELECT emrl.*,
            u.name AS logged_by_name,
            COALESCE(ev.name, uv.name) AS verified_by_name
     FROM equipment_maintenance_request_log emrl
     LEFT JOIN users u ON emrl.logged_by = u.id
     LEFT JOIN employees ev ON emrl.verified_by = ev.id
     LEFT JOIN users uv ON emrl.verified_by = uv.id
     WHERE emrl.equipment_maintenance_request_id = ?
     ORDER BY emrl.created_at ASC, emrl.id ASC`,
    [laporanId]
  );
  return logs;
}

async function fetchAssignment(id, employeeId, includeResolved = false) {
  const statusClause = includeResolved
    ? "emr.status IN ('in_progress', 'resolved')"
    : "emr.status = 'in_progress'";

  const [[assignment]] = await db.query(
    `SELECT emr.id, emr.issue_description, emr.status, emr.reported_at, emr.resolved_at,
            a.name AS equipment_name, a.code AS equipment_code,
            eq.serial_number,
            u_reporter.name AS reported_by_name,
            pengelola.name AS pengelola_name
     FROM equipment_maintenance_requests emr
     JOIN equipments eq ON emr.equipment_id = eq.id
     JOIN assets a ON eq.asset_id = a.id
     LEFT JOIN users u_reporter ON emr.reported_by = u_reporter.id
     LEFT JOIN (
       SELECT e.id, e.name
       FROM employees e
       JOIN model_has_roles mhr ON e.id = mhr.model_id
       JOIN roles r ON mhr.role_id = r.id
       WHERE r.name = 'pengelola_aset'
         AND mhr.model_type = 'App\\\\Models\\\\User'
     ) pengelola ON emr.employee_id = pengelola.id
     WHERE emr.id = ?
       AND emr.employee_id = ?
       AND ${statusClause}`,
    [id, employeeId]
  );

  return assignment;
}

async function listAssignments(req, status, view, title, currentPath) {
  const employeeId = await getEmployeeId(req);
  const search = req.query.search || '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const whereParts = ['emr.status = ?', 'emr.employee_id = ?'];
  const params = [status, employeeId];

  if (search) {
    whereParts.push('(a.name LIKE ? OR a.code LIKE ? OR emr.issue_description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
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

  const [penugasan] = await db.query(
    `SELECT emr.id, a.name AS equipment_name, a.code AS equipment_code,
            emr.issue_description, emr.status, emr.reported_at, emr.resolved_at,
            u_reporter.name AS reported_by_name,
            (SELECT COUNT(*) FROM equipment_maintenance_request_log
             WHERE equipment_maintenance_request_id = emr.id) AS log_count,
            (SELECT log FROM equipment_maintenance_request_log
             WHERE equipment_maintenance_request_id = emr.id
             ORDER BY created_at DESC, id DESC LIMIT 1) AS last_activity
     FROM equipment_maintenance_requests emr
     JOIN equipments eq ON emr.equipment_id = eq.id
     JOIN assets a ON eq.asset_id = a.id
     LEFT JOIN users u_reporter ON emr.reported_by = u_reporter.id
     ${where}
     ORDER BY ${status === 'resolved' ? 'emr.resolved_at DESC, emr.updated_at DESC' : 'emr.reported_at DESC'}
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  );

  return {
    view,
    data: {
      title,
      currentPath,
      userRole: req.session.userRole,
      userName: req.session.username,
      flash: getFlash(req),
      penugasan,
      STATUS_INFO,
      search,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
      total,
      themeMode: 'light',
    },
  };
}

const index = async (req, res, next) => {
  try {
    const result = await listAssignments(req, 'in_progress', 'pengelola/penugasan/index', 'Penugasan Maintenance', '/penugasan');
    res.render(result.view, result.data);
  } catch (err) {
    next(err);
  }
};

const show = async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req);
    const { id } = req.params;
    const laporan = await fetchAssignment(id, employeeId, true);

    if (!laporan) {
      return res.status(404).render('error', {
        message: 'Penugasan tidak ditemukan',
        error: { status: 404, stack: 'Penugasan tidak ada atau bukan milik Anda.' },
      });
    }

    const logs = await fetchLogs(id);

    res.render('pengelola/penugasan/show', {
      title: `Penugasan #${String(id).padStart(5, '0')}`,
      currentPath: '/penugasan',
      userRole: req.session.userRole,
      userName: req.session.username,
      flash: getFlash(req),
      laporan,
      logs,
      STATUS_INFO,
      themeMode: 'light',
    });
  } catch (err) {
    next(err);
  }
};

const updateProgress = async (req, res, next) => {
  try {
    const employeeId = await getEmployeeId(req);
    const { id } = req.params;
    const description = String(req.body.description || '').trim();

    if (req.fileValidationError) {
      cleanupUploadedFile(req.file);
      req.session.flash = {
        type: 'error',
        message: req.fileValidationError,
      };
      return res.redirect(`/penugasan/${id}`);
    }

    if (description.length < 10) {
      cleanupUploadedFile(req.file);
      req.session.flash = {
        type: 'error',
        message: 'Catatan progres minimal 10 karakter.',
      };
      return res.redirect(`/penugasan/${id}`);
    }

    const laporan = await fetchAssignment(id, employeeId, false);
    if (!laporan) {
      cleanupUploadedFile(req.file);
      req.session.flash = {
        type: 'error',
        message: 'Penugasan tidak ditemukan, sudah selesai, atau bukan milik Anda.',
      };
      return res.redirect('/penugasan');
    }

    const logId = await nextLogId();
    const photoPath = req.file ? `/uploads/laporan/${req.file.filename}` : null;
    await db.query(
      `INSERT INTO equipment_maintenance_request_log
          (id, equipment_maintenance_request_id, log, logged_by, logged_at, log_file, description, created_at, updated_at)
       VALUES (?, ?, 'Perbaikan dilakukan', ?, NOW(), ?, ?, NOW(), NOW())`,
      [logId, id, req.session.userId, photoPath, description]
    );

    await db.query(
      `UPDATE equipment_maintenance_requests
       SET status = 'in_progress', updated_at = NOW()
       WHERE id = ? AND employee_id = ?`,
      [id, employeeId]
    );

    req.session.flash = {
      type: 'success',
      message: 'Riwayat perbaikan berhasil diperbarui. Penanggung Jawab dapat meninjau progres ini.',
    };
    return res.redirect(`/penugasan/${id}`);
  } catch (err) {
    cleanupUploadedFile(req.file);
    next(err);
  }
};

const history = async (req, res, next) => {
  try {
    const result = await listAssignments(req, 'resolved', 'pengelola/penugasan/history', 'Riwayat Progres', '/progres');
    res.render(result.view, result.data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  index,
  show,
  updateProgress,
  history,
};
