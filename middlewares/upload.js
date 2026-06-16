const fs = require('fs');
const path = require('path');
const multer = require('multer');

const laporanUploadDir = path.join(__dirname, '../public/uploads/laporan');

if (!fs.existsSync(laporanUploadDir)) {
  fs.mkdirSync(laporanUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, laporanUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `foto-kerusakan-${unique}${ext}`);
  },
});

const uploadLaporan = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      req.fileValidationError = 'Foto kerusakan harus berupa JPG, PNG, atau WEBP.';
      return cb(null, false);
    }

    return cb(null, true);
  },
});

function fotoKerusakan(req, res, next) {
  uploadLaporan.fields([{ name: 'foto_kerusakan', maxCount: 1 }])(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      req.fileValidationError = 'Ukuran foto kerusakan maksimal 2 MB.';
      return next();
    }

    if (err) return next(err);
    req.file = req.files && req.files.foto_kerusakan ? req.files.foto_kerusakan[0] : null;
    return next();
  });
}

module.exports = {
  fotoKerusakan,
};
