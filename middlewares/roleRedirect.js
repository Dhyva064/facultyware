function getRoleLabel(roleName) {
  return String(roleName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDashboardPartial(roleName) {
  const partialMap = {
    pengguna: "pengguna/index",
    penanggung_jawab: "pj/index",
    pengelola_aset: "pengelola/index",
  };

  return partialMap[roleName] || null;
}

// Konfigurasi per-role: label dan deskripsi ringkas untuk header dashboard
function getRoleConfig(roleName) {
  const configs = {
    pengguna: {
      label:   'Pengguna',
      summary: 'Laporkan kerusakan peralatan laboratorium di unit Anda.',
    },
    penanggung_jawab: {
      label:   'Penanggung Jawab',
      summary: 'Meninjau pengajuan, memantau aset unit, dan menjalankan proses persetujuan yang menjadi kewenangan unit.',
    },
    pengelola_aset: {
      label:   'Pengelola Aset',
      summary: 'Kelola data aset, distribusi, dan pemantauan status perbaikan.',
    },
  };

  return configs[roleName] || null;
}

// Middleware: Redirect user ke halaman utama sesuai rolenya setelah login
const roleRedirect = (req, res) => {
  const role = req.session.userRole;

  // Seluruh role diarahkan ke gerbang masuk utama (/home) SIMAINT 
  const destinations = {
    pengguna:         '/home',
    penanggung_jawab: '/home',
    pengelola_aset:   '/home',
  };

  const destination = destinations[role] || '/login';
  res.redirect(destination);
};

module.exports = {
  getRoleLabel,
  getDashboardPartial,
  getRoleConfig,
  roleRedirect,
};