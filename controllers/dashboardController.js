const {
  getDashboardPartial,
  getRoleConfig,
  getRoleLabel,
} = require("../middlewares/roleRedirect");

const db = require("../lib/db");

async function buildDashboardViewModel(req) {
  const roleName = req.session.userRole;
  const roleConfig = getRoleConfig(roleName);

  if (!roleConfig) {
    return null;
  }

  // Always fetch authoritative user data from DB using req.session.userId
  const userId = req.session.userId;
  const [rows] = await db.query("SELECT id, name, email FROM users WHERE id = ?", [userId]);
  if (!rows || rows.length === 0) {
    return null;
  }

  const user = rows[0];

  return {
    title: `SIMAINT | ${roleConfig.label}`,
    pageTitle: `SIMAINT | ${roleConfig.label}`,
    user: user.name || req.session.username || "User SIMAINT",
    userEmail: user.email || req.session.userEmail,
    userRole: roleName,
    roleLabel: getRoleLabel(roleName),
    roleSummary: roleConfig.summary,
    dashboardView: getDashboardPartial(roleName),
  };
}

const home = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.redirect("/login");
    }

    const viewModel = await buildDashboardViewModel(req);
    if (!viewModel) {
      return res.redirect("/logout");
    }

    return res.render("home", viewModel);
  } catch (err) {
    console.error("Error rendering dashboard:", err);
    return next(err);
  }
};

module.exports = {
  home,
};
