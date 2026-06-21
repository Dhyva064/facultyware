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

    if (role === 'penanggung_jawab') {
      // Hitung semua laporan berstatus 'reported' yang belum diproses (PJ melihat semua, bukan filtered per employee)
      const [[{ n }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM equipment_maintenance_requests emr
         WHERE emr.status = 'reported'`
      );
      counts.newLaporan = n || 0;

      // Hitung permohonan maintenance yang activity terakhirnya perlu ditinjau PJ (semua, bukan per employee).
      const [[{ n: nMaint }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM equipment_maintenance_requests emr
         WHERE emr.status = 'in_progress'
           AND (
             SELECT log FROM equipment_maintenance_request_log
             WHERE equipment_maintenance_request_id = emr.id
             ORDER BY created_at DESC, id DESC LIMIT 1
           ) = 'Perbaikan dilakukan'`
      );
      counts.newMaintenance = nMaint || 0;

    } else if (role === 'pengelola_aset' && employeeId) {
      // Hitung penugasan in_progress yang menunggu aksi Pengelola Aset.
      const [[{ n }]] = await db.query(
        `SELECT COUNT(*) AS n
         FROM equipment_maintenance_requests emr
         WHERE emr.status = 'in_progress'
           AND emr.employee_id = ?
           AND COALESCE((
             SELECT log FROM equipment_maintenance_request_log
             WHERE equipment_maintenance_request_id = emr.id
             ORDER BY created_at DESC, id DESC LIMIT 1
           ), 'Maintenance ditugaskan') IN ('Maintenance ditugaskan', 'Revisi diminta')`,
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
