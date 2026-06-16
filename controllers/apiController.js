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

module.exports = {
  getMaintenance,
  getMaintenanceById,
};
