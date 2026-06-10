const db = require("../lib/db");

/**
 * ACL Middleware to check if a user has the required permission(s).
 * 
 * @param {string|string[]} requiredPermissions - A single permission or an array of permissions.
 * If an array is provided, the user must have at least one of the permissions.
 * 
 * Database Schema Requirements:
 * 
 * 1. roles: id, name
 * 2. permissions: id, name
 * 3. role_has_permissions: role_id, permission_id
 * 4. model_has_roles: model_id, role_id, model_type
 */

const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const permissionsArray = Array.isArray(requiredPermissions) 
      ? requiredPermissions 
      : [requiredPermissions];

    try {
      // Query jika user punya role
      const query = `
        SELECT DISTINCT p.name 
        FROM permissions p
        JOIN role_has_permissions rhp ON p.id = rhp.permission_id
        JOIN model_has_roles mhr      ON rhp.role_id = mhr.role_id
        WHERE mhr.model_id = ? 
          AND mhr.model_type = 'App\\\\Models\\\\User' 
          AND p.name IN (?)
      `;

      const [rows] = await db.query(query, [req.session.userId, permissionsArray]);

      if (rows.length > 0) {
        return next();
      }

      // Passing data error ke view templates/error.ejs
      res.status(403).render("error", {
        message: "Akses Ditolak",
        error: { 
          status: 403, 
          stack: "Anda tidak memiliki izin untuk mengakses halaman ini." 
        }
      });
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  checkPermission
};
