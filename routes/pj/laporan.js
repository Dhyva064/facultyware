const express    = require('express');
const router     = express.Router();

const pjCtrl     = require('../../controllers/pjController');

// [PRE-CONDITION]: Jalankan bypass/placeholder jika pdfController belum dibuat
let pdfCtrl = {};
try {
  pdfCtrl = require('../../controllers/pdfController');
} catch (e) {
  console.log("💡 [SIMAINT INFO]: pdfController belum diimplementasikan, rute cetak PDF menggunakan callback pembantu.");
  pdfCtrl.rekapBulanan    = (req, res) => res.send("Placeholder Rekap PDF Bulanan");
  pdfCtrl.buktiLaporanPJ = (req, res) => res.send(`Placeholder Cetak PDF Laporan ID: ${req.params.id}`);
}

// Impor Middleware
const { isAuthenticated } = require('../../middlewares/auth');
// [TEST MODE] checkPermission dinonaktifkan sementara untuk pengujian login per-role
// const { checkPermission } = require('../../middlewares/acl');

router.use(isAuthenticated);

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