const express = require('express');
const router = express.Router();

const maintenanceCtrl = require('../../controllers/maintenanceController');
const pdfCtrl = require('../../controllers/pdfController');
const authModule = require('../../middlewares/auth');
const { isAuthenticated } = authModule;
const checkPermission = authModule.checkPermission || ((role) => (req, res, next) => next());

router.use(isAuthenticated);

router.use((req, res, next) => {
  if (req.session.userRole === 'penanggung_jawab') return next();
  return res.redirect('/home');
});

// GET  /PJ/MAINTENANCE — Menampilkan list permohonan perbaikan alat yang sedang berjalan
router.get('/',
  checkPermission('maintenance.view'),
  maintenanceCtrl.index
);

// GET  /PJ/MAINTENANCE/REKAP-PDF — Download Rekap Bulanan PDF
router.get('/rekap-pdf',
  checkPermission('maintenance.view'),
  pdfCtrl.rekapBulanan
);

// GET  /PJ/MAINTENANCE/BUAT — Membuka form pengajuan perbaikan mandiri oleh PJ 
router.get('/buat',
  checkPermission('maintenance.create'),
  maintenanceCtrl.create
);

// POST /PJ/MAINTENANCE — Eksekusi simpan data maintenance baru ke database
router.post('/',
  checkPermission('maintenance.create'),
  maintenanceCtrl.store
);

// GET  /PJ/MAINTENANCE/:ID — Meninjau berkas log tahapan perbaikan alat
router.get('/:id',
  checkPermission('maintenance.view'),
  maintenanceCtrl.show
);

// POST /PJ/MAINTENANCE/:ID/CLOSE — Aksi persetujuan PJ untuk menutup kasus karena alat selesai diperbaiki
router.post('/:id/close',
  checkPermission('maintenance.close'),
  maintenanceCtrl.close
);

// POST /PJ/MAINTENANCE/:ID/REVISI — Membalikkan status laporan ke teknisi/pelapor untuk diperbaiki datanya
router.post('/:id/revisi',
  checkPermission('maintenance.revisi'),
  maintenanceCtrl.revisi
);

module.exports = router;