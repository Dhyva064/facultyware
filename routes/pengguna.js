const express = require('express');
const router = express.Router();
const penggunaController = require('../controllers/penggunaController');
const pdfController = require('../controllers/pdfController');
const { isAuthenticated } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Middleware: Pastikan user role adalah 'pengguna'
router.use(isAuthenticated);
router.use((req, res, next) => {
  if (req.session.userRole === 'pengguna') {
    return next();
  }
  return res.redirect('/home');
});

// GET /laporan — Daftar laporan kerusakan aset
router.get('/', penggunaController.getList);

// GET /laporan/buat — Form buat laporan kerusakan aset
router.get('/buat', penggunaController.getCreateForm);

// POST /laporan — Simpan laporan kerusakan aset
router.post('/', upload.fotoKerusakan, penggunaController.postStore);

// GET /laporan/:id/pdf — Unduh bukti laporan kerusakan aset
router.get('/:id/pdf', pdfController.buktiLaporan);

// GET /laporan/:id — Detail laporan kerusakan aset
router.get('/:id', penggunaController.getDetail);

module.exports = router;
