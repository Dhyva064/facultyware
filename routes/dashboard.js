const express = require('express');
const router  = express.Router();

// Mengimpor controller dashboard
const dashboardController = require('../controllers/dashboardController');

// Mengimpor middleware
const { isAuthenticated } = require('../middlewares/auth');
// [TEST MODE] checkPermission dinonaktifkan sementara untuk pengujian login per-role
// const { checkPermission } = require('../middlewares/acl');

// [TEST MODE] checkPermission('dashboard.view') dinonaktifkan → hanya isAuthenticated
router.get('/', isAuthenticated, dashboardController.home);

module.exports = router;