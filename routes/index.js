// routes/index.js
var express = require("express");
var router = express.Router();
const indexController = require("../controllers/indexController");
const dashboardController = require("../controllers/dashboardController");
const { isAuthenticated } = require("../middlewares/auth");

// Halaman depan statis default 
router.get("/", indexController.index);

// Halaman utama sistem (Hanya bisa dibuka jika sudah login)
router.get("/home", isAuthenticated, dashboardController.home);

// Halaman login
router.get("/login", indexController.loginPage);
router.post("/login", indexController.login);

// Proses logout
router.get("/logout", indexController.logout);

module.exports = router;
