/**
 * middlewares/badge.js
 * Menghitung badge notifikasi untuk setiap role dan menyimpannya ke res.locals.badgeCounts
 * Disesuaikan untuk SIMAINT (equipment_maintenance_requests)
 */
const db = require('../lib/db');

async function badgeMiddleware(req, res, next) {
  // Hanya hitung badge jika user sudah login
  if (!req.session || !req.session.userId) {
    res.locals.badgeCounts = null;
    return next();
  }

  try {
    const role = req.session.userRole;
    const userId = req.session.userId;
    const counts = { newLaporan: 0, newTugas: 0, newMaintenance: 0 };

    // Cari employee_id dari user ini (untuk PJ / Pengelola Aset)
    const [[emp]] = await db.query(
      'SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]
    );
    const employeeId = emp ? emp.id : null;

    if (role === 'penanggung_jawab' && employeeId) {
      // Hitung laporan 'reported' yang ditugaskan ke PJ ini
      const [[{ n }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM equipment_maintenance_requests emr
         WHERE emr.status = 'reported'
           AND emr.employee_id = ?`,
        [employeeId]
      );
      counts.newLaporan = n || 0;

      // Hitung permohonan maintenance yang memiliki update baru (status log terakhir = 3)
      const [[{ n: nMaint }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM equipment_maintenance_requests emr
         WHERE emr.employee_id = ?
           AND (
             SELECT status FROM equipment_maintenance_request_log
             WHERE equipment_maintenance_request_id = emr.id
             ORDER BY created_at DESC, id DESC LIMIT 1
           ) = 3`,
        [employeeId]
      );
      counts.newMaintenance = nMaint || 0;

    } else if (role === 'pengelola_aset' && employeeId) {
      // Hitung penugasan in_progress yang belum ada log progres (status=3)
      const [[{ n }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM equipment_maintenance_requests emr
         WHERE emr.status = 'in_progress'
           AND emr.employee_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM equipment_maintenance_request_log
             WHERE equipment_maintenance_request_id = emr.id AND status = 3
           )`,
        [employeeId]
      );
      counts.newTugas = n || 0;
    }

    res.locals.badgeCounts = counts;
  } catch (err) {
    // Jangan crash karena badge, cukup set null
    console.error("Badge Error:", err);
    res.locals.badgeCounts = null;
  }

  next();
}

module.exports = badgeMiddleware;
