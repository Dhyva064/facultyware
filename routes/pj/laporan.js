const express = require('express');
const router = express.Router();

const pjCtrl = require('../../controllers/pjController');
const pdfCtrl = require('../../controllers/pdfController');
const { isAuthenticated } = require('../../middlewares/auth');
const { checkPermission } = require('../../middlewares/acl');

router.use(isAuthenticated);

router.use((req, res, next) => {
  if (req.session.userRole === 'penanggung_jawab') return next();
  return res.redirect('/home');
});

// DAFTAR ROUTE CRUD LAPORAN PENANGGUNG JAWAB

// GET  /PJ/LAPORAN — Daftar semua laporan kerusakan
router.get('/', pjCtrl.index);

// GET  /PJ/LAPORAN/PDF-REKAP — Unduh rekapitulasi data bulanan
router.get('/pdf-rekap', checkPermission('dashboard.view'), pdfCtrl.rekapBulanan);

// GET  /PJ/LAPORAN/:ID/PDF — Unduh bukti fisik surat laporan kerusakan
router.get('/:id/pdf', pdfCtrl.buktiLaporanPJ);

// GET  /PJ/LAPORAN/:ID/EDIT — Tampilkan halaman formulir pengubahan deskripsi laporan
router.get('/:id/edit', pjCtrl.edit);

// GET  /PJ/LAPORAN/:ID — Tampilkan detail status laporan beserta riwayat log penanganan
router.get('/:id', checkPermission('laporan.view_all'), pjCtrl.show);

// POST /PJ/LAPORAN/:ID — Simpan data perubahan deskripsi ke database MySQL
router.post('/:id', pjCtrl.update);

// DELETE /PJ/LAPORAN/:ID — Hapus data permohonan secara permanen
router.delete('/:id', pjCtrl.destroy);

module.exports = router;