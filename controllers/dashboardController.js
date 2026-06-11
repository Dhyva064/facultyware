const {
  getDashboardPartial,
  getRoleConfig,
  getRoleLabel,
} = require("../middlewares/roleRedirect");

const db = require("../lib/db");

/**
 * Relasi DB yang benar (hasil inspeksi schema):
 *  - equipments.asset_id → assets.id  (nama alat ada di assets)
 *  - equipment_maintenance_requests.equipment_id → equipments.id
 *  - equipment_maintenance_requests.employee_id  → employees.id  (PJ/pengelola)
 *  - equipment_maintenance_requests.reported_by  → users.id
 *  - rooms.responsible_employee_id → employees.id  (ruangan per PJ)
 *  - TIDAK ADA relasi langsung equipments → rooms
 */

async function buildDashboardViewModel(req) {
  const roleName = req.session.userRole;
  const roleConfig = getRoleConfig(roleName);
  if (!roleConfig) return null;

  const userId = req.session.userId;
  const [rows] = await db.query("SELECT id, name, email FROM users WHERE id = ?", [userId]);
  if (!rows || rows.length === 0) return null;

  const user = rows[0];

  let stats = {
    totalLaporan: 0,
    menunggu: 0,
    dalamPengerjaan: 0,
    selesaiBulanIni: 0,
    persen: { total: '0', menunggu: '0', pengerjaan: '0', selesai: '0' }
  };
  let topAset    = [];
  let trendLabels = JSON.stringify([]);
  let trendJumlah = JSON.stringify([]);
  let totalCount       = 0;
  let maintenanceCount = 0;
  let recentLaporan    = [];
  const currentFilter  = req.query.filter === 'my' ? 'my' : 'all';

  if (String(roleName || "").trim().toLowerCase().replace(/\s+/g, "_") === 'penanggung_jawab') {
    // Cari employee_id dari user ini
    const [[emp]] = await db.query(
      'SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]
    );
    const employeeId = emp ? emp.id : null;

    // --- Query dasar (semua laporan) ---
    let baseWhere  = '';
    let params     = [];

    // Filter "my": tampilkan laporan yang assigned ke PJ ini
    if (currentFilter === 'my' && employeeId) {
      baseWhere = 'WHERE emr.employee_id = ?';
      params    = [employeeId];
    }

    const [[{ total: tCount }]] = await db.query(
      `SELECT COUNT(*) as total FROM equipment_maintenance_requests emr ${baseWhere}`, params
    );
    const [[{ total: mCount }]] = await db.query(
      `SELECT COUNT(*) as total FROM equipment_maintenance_requests emr ${baseWhere}
       ${baseWhere ? 'AND' : 'WHERE'} emr.status IN ('reported','in_progress')`, params
    );
    const [rLaporan] = await db.query(
      `SELECT emr.id, a.name AS equipment_name, u.name AS reported_by_name,
              emr.issue_description, emr.status, emr.reported_at
       FROM equipment_maintenance_requests emr
       JOIN equipments eq ON emr.equipment_id = eq.id
       JOIN assets a      ON eq.asset_id       = a.id
       JOIN users u       ON emr.reported_by   = u.id
       ${baseWhere}
       ORDER BY emr.reported_at DESC LIMIT 5`, params
    );

    totalCount       = tCount;
    maintenanceCount = mCount;
    recentLaporan    = rLaporan;

    // Stats per-status (global atau filter my)
    const [[{ c: menunggu }]] = await db.query(
      `SELECT COUNT(*) as c FROM equipment_maintenance_requests emr ${baseWhere}
       ${baseWhere ? 'AND' : 'WHERE'} emr.status = 'reported'`, params
    );
    const [[{ c: dalamPengerjaan }]] = await db.query(
      `SELECT COUNT(*) as c FROM equipment_maintenance_requests emr ${baseWhere}
       ${baseWhere ? 'AND' : 'WHERE'} emr.status = 'in_progress'`, params
    );
    const [[{ c: selesaiBulanIni }]] = await db.query(
      `SELECT COUNT(*) as c FROM equipment_maintenance_requests emr ${baseWhere}
       ${baseWhere ? 'AND' : 'WHERE'} emr.status = 'resolved'
         AND MONTH(emr.updated_at) = MONTH(NOW()) AND YEAR(emr.updated_at) = YEAR(NOW())`, params
    );

    stats = {
      totalLaporan: tCount,
      menunggu,
      dalamPengerjaan,
      selesaiBulanIni,
      persen: { total: '0', menunggu: '0', pengerjaan: '0', selesai: '0' }
    };

    // Top 5 aset sering rusak
    const [topAsetRows] = await db.query(`
      SELECT a.name AS nama_aset, a.code AS kode_aset, COUNT(*) AS jumlah_rusak
      FROM equipment_maintenance_requests emr
      JOIN equipments eq ON emr.equipment_id = eq.id
      JOIN assets a      ON eq.asset_id       = a.id
      ${baseWhere}
      GROUP BY eq.id, a.name, a.code
      ORDER BY jumlah_rusak DESC
      LIMIT 5
    `, params);
    topAset = topAsetRows;

    // Tren mingguan (7 hari terakhir)
    const [trendRows] = await db.query(`
      SELECT DATE(reported_at) AS tgl, COUNT(*) AS jumlah
      FROM equipment_maintenance_requests
      WHERE reported_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(reported_at)
      ORDER BY tgl ASC
    `);
    trendLabels = JSON.stringify(trendRows.map(r => {
      const d = new Date(r.tgl);
      return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    }));
    trendJumlah = JSON.stringify(trendRows.map(r => r.jumlah));
  }

  return {
    title:         `SIMAINT | ${roleConfig.label}`,
    pageTitle:     `SIMAINT | ${roleConfig.label}`,
    user:          user.name || req.session.username || "User SIMAINT",
    userName:      user.name || req.session.username || "User SIMAINT",
    userEmail:     user.email || req.session.userEmail,
    userRole:      roleName,
    roleLabel:     getRoleLabel(roleName),
    roleSummary:   roleConfig.summary,
    dashboardView: getDashboardPartial(roleName),
    stats,
    topAset,
    trendLabels,
    trendJumlah,
    totalCount,
    maintenanceCount,
    recentLaporan,
    currentFilter,
  };
}

const home = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.redirect("/login");

    const viewModel = await buildDashboardViewModel(req);
    if (!viewModel) return res.redirect("/logout");

    const flash = req.session.flash || null;
    delete req.session.flash;
    viewModel.flash = flash;

    return res.render("home", viewModel);
  } catch (err) {
    console.error("Error rendering dashboard:", err);
    return next(err);
  }
};

module.exports = { home };
