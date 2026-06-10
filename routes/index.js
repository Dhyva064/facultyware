// routes/index.js
var express = require("express");
var router = express.Router();
const indexController = require("../controllers/indexController");
const dashboardController = require("../controllers/dashboardController");
const { isAuthenticated } = require("../middlewares/auth");

const { roleRedirect } = require("../middlewares/roleRedirect");

// Halaman depan statis default ( Landing Page )
router.get("/", indexController.index);

router.get("/home", isAuthenticated, dashboardController.home);

// Halaman login (Tampilan Form)
router.get("/login", indexController.loginPage);
// Eksekusi Login (Pencocokan username, password, dan mhr.model_type)
router.post("/login", indexController.login);

// Proses memusnahkan session (Destroy Session)
router.get("/logout", indexController.logout);

// Mengarahkan role secara aman ke rute tujuan utama masing-masing melalui middleware roleRedirect.
router.get('/auth/role-redirect', isAuthenticated, roleRedirect);

module.exports = router;