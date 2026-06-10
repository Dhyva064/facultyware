const bcrypt = require("bcryptjs");
const db = require("../lib/db");
const { getRoleLabel } = require("../middlewares/roleRedirect");

// Menyelaraskan Cookie dengan 'key' di app.js
const SESSION_COOKIE_NAME = "session_cookie_name";
const ROLE_MODEL_TYPE = "App\\Models\\User";

// 1. GET Landing Page (/)
const index = (req, res) => {
  return res.redirect("/login");
};

// 2. GET Login Page (/login)
const loginPage = (req, res) => {
  if (req.session.userId && req.session.userRole) {
    return res.redirect("/home");
  }

  if (req.session.userId && !req.session.userRole) {
    return res.redirect("/logout");
  }

  return res.render("login", {
    title: "Login",
    error: null,
  });
};

// 3. POST Login (/login)
const login = async (req, res, next) => {
  // Form login.ejs menggunakan name="username", bukan name="email"
  const email = String(req.body.email || req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");


  if (!email || !password) {
    return res.render("login", {
      title: "Login",
      error: "Email dan password wajib diisi.",
    });
  }

  if (!email.endsWith("@ftiunand.ac.id")) {
    return res.render("login", {
      title: "Login",
      error: "Akses dibatasi! Gunakan email resmi @ftiunand.ac.id",
    });
  }

  //Query Gabungan Data User dan Role dari model_has_roles
  try {
    const [rows] = await db.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.password,
          r.id AS role_id,
          r.name AS role_name
        FROM users u
        LEFT JOIN model_has_roles mhr
          ON mhr.model_id = u.id
         AND mhr.model_type = ?
        LEFT JOIN roles r
          ON r.id = mhr.role_id
        WHERE u.email = ?
        ORDER BY mhr.role_id ASC
        LIMIT 1
      `,
      [ROLE_MODEL_TYPE, email],
    );

    if (rows.length === 0) {
      return res.render("login", {
        title: "Login",
        error: "Email atau password tidak terdaftar.",
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password).catch(() => false);

    if (!isMatch) {
      return res.render("login", {
        title: "Login",
        error: "Password yang Anda masukkan salah.",
      });
    }

    if (!user.role_name) {
      return res.render("login", {
        title: "Login",
        error: "Akun ini belum memiliki role. Hubungi administrator SIMAINT.",
      });
    }

    // Prevent session fixation: regenerate session id before assigning user data
    return req.session.regenerate(function (err) {
      if (err) return next(err);

      // Variabel Sesi yang dibutuhkan Dashboard
      req.session.userId = user.id;
      req.session.username = user.name || "User SIMAINT";
      req.session.userEmail = user.email;
      req.session.userRoleId = user.role_id;
      req.session.userRole = user.role_name;
      req.session.roleLabel = getRoleLabel(user.role_name);

      req.session.save(function (err) {
        if (err) return next(err);
        return res.redirect("/home");
      });
    });
  } catch (err) {
    console.error("Kesalahan sistem login:", err);
    return next(err);
  }
};

// 4. GET Logout (/logout)
const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    // Menghapus Cookie dibrowser
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.redirect("/login");
  });
};

module.exports = {
  index,
  loginPage,
  login,
  logout,
};
