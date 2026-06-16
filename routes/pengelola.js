const express = require('express');
const router = express.Router();
const pengelolaController = require('../controllers/pengelolaController');
const { isAuthenticated } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.use(isAuthenticated);

router.use((req, res, next) => {
  if (req.session.userRole === 'pengelola_aset') return next();
  return res.redirect('/home');
});

router.get('/', pengelolaController.index);
router.get('/:id', pengelolaController.show);
router.post('/:id/progress', upload.buktiHasilMaintenance, pengelolaController.updateProgress);

module.exports = router;
