const db = require('../lib/db');

const maintenanceSelect = `
  SELECT
    emr.id,
    emr.reported_at AS tanggal_laporan,
    a.name AS nama_aset,
    a.code AS kode_aset,
    eq.brand AS merek_peralatan,
    COALESCE(e.name, '-') AS pelapor,
    emr.status,
    emr.issue_description AS deskripsi_kerusakan
  FROM equipment_maintenance_requests emr
  JOIN equipments eq ON emr.equipment_id = eq.id
  JOIN assets a ON eq.asset_id = a.id
  LEFT JOIN employees e ON emr.reported_by = e.id
`;

const getMaintenance = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      ${maintenanceSelect}
      ORDER BY emr.reported_at DESC, emr.id DESC
    `);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    return next(err);
  }
};

const getMaintenanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      ${maintenanceSelect}
      WHERE emr.id = ?
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data tidak ditemukan',
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    return next(err);
  }
};

const pengelolaMaintenanceSelect = `
  SELECT
    emr.id,
    emr.reported_at AS tanggal_laporan,
    a.code AS kode_aset,
    a.name AS nama_aset,
    eq.brand AS merek_peralatan,
    COALESCE(pelapor.name, '-') AS pelapor,
    COALESCE(pengelola.name, '-') AS pengelola_aset,
    emr.status AS status_maintenance,
    emr.issue_description AS deskripsi_kerusakan
  FROM equipment_maintenance_requests emr
  JOIN equipments eq ON emr.equipment_id = eq.id
  JOIN assets a ON eq.asset_id = a.id
  LEFT JOIN employees pelapor ON emr.reported_by = pelapor.id
  LEFT JOIN employees pengelola ON emr.employee_id = pengelola.id
`;

// API Pengelola Aset untuk testing Postman:
// GET http://localhost:3000/api/pengelola-aset/maintenance
// GET http://localhost:3000/api/pengelola-aset/maintenance/1
// Opsional untuk membatasi daftar per petugas:
// GET http://localhost:3000/api/pengelola-aset/maintenance?employee_id=3
const getPengelolaMaintenance = async (req, res, next) => {
  try {
    const employeeId = req.query.employee_id || '';
    const whereParts = ['emr.employee_id IS NOT NULL'];
    const params = [];

    if (employeeId) {
      whereParts.push('emr.employee_id = ?');
      params.push(employeeId);
    }

    const [rows] = await db.query(`
      ${pengelolaMaintenanceSelect}
      WHERE ${whereParts.join(' AND ')}
      ORDER BY emr.reported_at DESC, emr.id DESC
    `, params);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    return next(err);
  }
};

const getPengelolaMaintenanceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT
        emr.id,
        emr.reported_at AS tanggal_laporan,
        emr.resolved_at AS tanggal_selesai,
        emr.status AS status_maintenance,
        emr.issue_description AS deskripsi_kerusakan,
        a.id AS aset_id,
        a.code AS kode_aset,
        a.name AS nama_aset,
        eq.id AS equipment_id,
        eq.brand AS merek_peralatan,
        eq.model AS model_peralatan,
        eq.serial_number,
        COALESCE(pelapor.name, '-') AS pelapor,
        COALESCE(pengelola.name, '-') AS pengelola_aset
      FROM equipment_maintenance_requests emr
      JOIN equipments eq ON emr.equipment_id = eq.id
      JOIN assets a ON eq.asset_id = a.id
      LEFT JOIN employees pelapor ON emr.reported_by = pelapor.id
      LEFT JOIN employees pengelola ON emr.employee_id = pengelola.id
      WHERE emr.id = ?
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data tidak ditemukan',
      });
    }

    const item = rows[0];
    const [logs] = await db.query(`
      SELECT
        emrl.id,
        emrl.status,
        emrl.log,
        emrl.description AS deskripsi_progress,
        emrl.logged_at AS tanggal_progress,
        COALESCE(petugas.name, '-') AS petugas
      FROM equipment_maintenance_request_log emrl
      LEFT JOIN employees petugas ON emrl.logged_by = petugas.id
      WHERE emrl.equipment_maintenance_request_id = ?
      ORDER BY emrl.logged_at ASC, emrl.created_at ASC, emrl.id ASC
    `, [id]);

    return res.json({
      success: true,
      data: {
        maintenance: {
          id: item.id,
          tanggal_laporan: item.tanggal_laporan,
          tanggal_selesai: item.tanggal_selesai,
          pelapor: item.pelapor,
          pengelola_aset: item.pengelola_aset,
          status_maintenance: item.status_maintenance,
          deskripsi_kerusakan: item.deskripsi_kerusakan,
        },
        aset: {
          aset_id: item.aset_id,
          kode_aset: item.kode_aset,
          nama_aset: item.nama_aset,
          equipment_id: item.equipment_id,
          merek_peralatan: item.merek_peralatan,
          model_peralatan: item.model_peralatan,
          serial_number: item.serial_number,
        },
        riwayat_log: logs,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getMaintenance,
  getMaintenanceById,
  getPengelolaMaintenance,
  getPengelolaMaintenanceById,
};
