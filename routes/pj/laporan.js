const express = require('express');
const router = express.Router();

const pjCtrl = require('../../controllers/pjController');
const pdfCtrl = require('../../controllers/pdfController');
const { isAuthenticated } = require('../../middlewares/auth');

router.use(isAuthenticated);

router.use((req, res, next) => {
  if (req.session.userRole === 'penanggung_jawab') return next();
  return res.redirect('/home');
});

// DAFTAR ROUTE CRUD LAPORAN PENANGGUNG JAWAB

// GET  /PJ/LAPORAN — Daftar semua laporan kerusakan
router.get('/', pjCtrl.index);

// GET  /PJ/LAPORAN/PDF-REKAP — Unduh rekapitulasi data bulanan
// [TEST MODE] checkPermission('dashboard.view') dinonaktifkan
router.get('/pdf-rekap', pdfCtrl.rekapBulanan);

// GET  /PJ/LAPORAN/:ID/PDF — Unduh bukti fisik surat laporan kerusakan
router.get('/:id/pdf', pdfCtrl.buktiLaporanPJ);

// GET  /PJ/LAPORAN/:ID/EDIT — Tampilkan halaman formulir pengubahan deskripsi laporan
router.get('/:id/edit', pjCtrl.edit);

// GET  /PJ/LAPORAN/:ID — Tampilkan detail status laporan beserta riwayat log penanganan
// [TEST MODE] checkPermission('laporan.view_all') dinonaktifkan
router.get('/:id', pjCtrl.show);

// POST /PJ/LAPORAN/:ID — Simpan data perubahan deskripsi ke database MySQL
router.post('/:id', pjCtrl.update);

// DELETE /PJ/LAPORAN/:ID — Hapus data permohonan secara permanen
router.delete('/:id', pjCtrl.destroy);

module.exports = router;