const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pengelolaController');
const { isAuthenticated } = require('../middlewares/auth');

router.use(isAuthenticated);

router.use((req, res, next) => {
  if (req.session.userRole === 'pengelola_aset') return next();
  return res.redirect('/home');
});

// GET /progres — Riwayat penugasan yang sudah selesai (resolved)
router.get('/', ctrl.history);

module.exports = router;
