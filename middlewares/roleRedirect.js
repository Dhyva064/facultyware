const ROLE_CONFIG = {
  pengguna: {
    label: "Pengguna",
    summary:
      "Mengajukan kebutuhan aset, memantau status permohonan, dan melihat informasi aset yang terkait.",
    highlights: [
      "Ajukan kebutuhan aset dan pantau statusnya dari dashboard.",
      "Lihat riwayat aset dan informasi yang relevan dengan akun Anda.",
      "Gunakan dashboard untuk update cepat terkait permintaan.",
    ],
  },
  penanggung_jawab: {
    label: "Penanggung Jawab",
    summary:
      "Meninjau pengajuan, memantau aset unit, dan menjalankan proses persetujuan yang menjadi kewenangan unit.",
    highlights: [
      "Tinjau pengajuan yang masuk ke unit Anda.",
      "Pantau kondisi aset dan kebutuhan tindak lanjutnya.",
      "Kelola persetujuan agar proses administrasi tetap tertib.",
    ],
  },
  pengelola_aset: {
    label: "Pengelola Aset",
    summary:
      "Mengelola master data aset, memonitor kondisi aset, dan memastikan distribusi aset berjalan sesuai prosedur.",
    highlights: [
      "Kelola data aset dan perubahan status secara terpusat.",
      "Awasi distribusi, mutasi, dan kondisi aset lintas unit.",
      "Gunakan dashboard untuk pengambilan keputusan operasional.",
    ],
  },
};

function getRoleConfig(roleName) {
  return ROLE_CONFIG[roleName] || null;
}

function getRoleLabel(roleName) {
  const config = getRoleConfig(roleName);
  if (config) return config.label;

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

module.exports = {
  ROLE_CONFIG,
  getRoleConfig,
  getRoleLabel,
  getDashboardPartial,
};
