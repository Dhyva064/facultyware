const express = require('express');
const router = express.Router();

const apiController = require('../controllers/apiController');
const apiAuth = require('../middlewares/apiAuth');

router.use(apiAuth);

// Contoh Postman:
// GET http://localhost:3000/api/maintenance
// GET http://localhost:3000/api/maintenance/1
// Jika API_TOKEN/API_KEY di .env diisi, kirim header:
// Authorization: Bearer <token> atau x-api-key: <token>
router.get('/maintenance', apiController.getMaintenance);
router.get('/maintenance/:id', apiController.getMaintenanceById);

module.exports = router;
