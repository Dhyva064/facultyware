const express = require('express');
const router  = express.Router();

// Mengimpor controller dashboard
const dashboardController = require('../controllers/dashboardController');

// Mengimpor middleware
const { isAuthenticated } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/acl');

router.get('/', isAuthenticated, checkPermission('dashboard.view'), dashboardController.home);

module.exports = router;