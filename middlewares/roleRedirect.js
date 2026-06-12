function getRoleLabel(roleName) {
  return String(roleName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDashboardPartial(roleName) {
  /* Dashboard dirender langsung di home.ejs — tidak lagi memakai partial terpisah */
  return null;
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

  // Halaman tujuan utama masing-masing role setelah login
  const destinations = {
    pengguna:         '/laporan',
    penanggung_jawab: '/home',
    pengelola_aset:   '/penugasan',
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
