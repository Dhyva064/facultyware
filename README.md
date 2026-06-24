# FacultyWare SIMAINT — Sistem Maintenance Aset

[![Playwright Tests](https://img.shields.io/badge/tests-XX%45passed-brightgreen)](tests/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v4-blue)](https://expressjs.com)

**Repository Implementasi Fitur Utama**  
Kelompok A4 — Tugas Besar Pemrograman Web  
Fakultas Teknologi Informasi, Universitas Andalas — 2026

🌐 **URL Deployment:** https://facultyware.site

---

## Deskripsi Aplikasi

**FacultyWare SIMAINT** adalah aplikasi web yang dirancang untuk membantu proses pelaporan kerusakan aset dan pengelolaan maintenance secara terintegrasi. Sistem ini memungkinkan pengguna melaporkan kerusakan aset, memantau status perbaikan secara real-time, serta menghasilkan laporan dalam format PDF. Selain itu, Penanggung Jawab dapat melakukan verifikasi laporan dan mengelola permintaan maintenance, sedangkan Pengelola Aset bertugas melaksanakan proses perbaikan dan memperbarui riwayat maintenance.


### Fitur Utama

| No | Modul | Deskripsi |
|----|-------|-----------|
| 1 | **Autentikasi** | Login, logout, dan proteksi akses berbasis session |
| 2 | **Pelaporan Kerusakan Aset** | Pengguna dapat membuat laporan kerusakan aset lengkap dengan deskripsi dan foto bukti |
| 3 | **Monitoring Status Laporan** | Pengguna dapat melihat perkembangan status laporan secara real-time |
| 4 | **Riwayat Laporan** | Pengguna dapat memfilter dan melihat riwayat laporan berdasarkan status |
| 5 | **Dashboard Penanggung Jawab** | Menampilkan statistik dan ringkasan laporan maintenance |
| 6 | **Verifikasi dan Validasi Laporan** | Penanggung Jawab dapat memverifikasi laporan dan mengajukan maintenance |
| 7 | **Manajemen Maintenance** | Pengelola Aset dapat melihat penugasan, memperbarui status, dan mencatat hasil perbaikan |
| 8 | **Dokumentasi Maintenance** | Pengelola Aset dapat mengunggah foto hasil akhir maintenance |
| 9 | **Laporan PDF** | Generate bukti laporan dan rekap maintenance dalam format PDF |
| 10 | **REST API** | Menyediakan API JSON untuk operasi laporan dan maintenance |

### Teknologi yang Digunakan

| Kategori | Teknologi |
|----------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express.js v4 |
| Template Engine | EJS |
| Database | MySQL 8 (native `mysql2`, tanpa ORM) |
| Session | express-session + express-mysql-session |
| PDF Generator | PDFKit |
| CSS Framework | Bootstrap v5 / Tailwind CSS (via CDN) |
| Testing | Playwright (End-to-End, Chromium) |

---

## Cara Instalasi dan Menjalankan Aplikasi

### Prasyarat

Pastikan perangkat Anda telah terinstall:
- [Node.js](https://nodejs.org) versi 18 atau lebih baru
- [MySQL](https://www.mysql.com) versi 8
- [Git](https://git-scm.com)

### Langkah Instalasi

**1. Clone repository**

```bash
git clone https://github.com/Dhyva064/facultyware.git
cd facultyware
```

**2. Install dependencies**

```bash
npm install
```

**3. Konfigurasi environment**

Buat file `.env` di root project:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=facultyware
SESSION_SECRET= 
```

**4. Siapkan database**

Buat database MySQL dengan nama `facultyware`, kemudian import SQL schema yang disediakan:

```bash
mysql -u root -p facultyware < facultyware.sql
```

**5. Jalankan scripts setup**

Setelah database di-import, jalankan script berikut untuk membuat akun pengguna dan mengisi data master:

```bash
# Buat akun admin dan assign role
node scripts/init_db.js

# Isi data master (kategori alat, lokasi, status, dll)
node scripts/seed.js
```

**6. Jalankan aplikasi**

```bash
# Mode development (dengan auto-reload saat ada perubahan file)
npm run dev

# Mode production
npm start
```

Aplikasi akan berjalan di: **http://localhost:3000**

### Akun Login Default

Setelah menjalankan `node scripts/init_db.js`:

| Role | Email | Password |
|------|-------|----------|
| Pengguna1 | `pengguna1@ftiunand.ac.id` | `password123` |
| Pengguna2 | `pengguna2@ftiunand.ac.id` | `password123` |
| Pj | `pj@ftiunand.ac.id` | `password123` |
| Pengelola | `pengelola@ftiunand.ac.id` | `password123` |

### Menjalankan Testing

Pastikan aplikasi **sedang berjalan** di `http://localhost:3000` sebelum menjalankan test.

```bash
# Install Chromium untuk Playwright (hanya perlu sekali)
npx playwright install chromium

# Jalankan semua test (Ubah jadi berurutan biar database aman dari race condition)
npx playwright test --workers=1

# Jalankan test per modul

npx playwright test tests/auth.spec.js             # Autentikasi 
npx playwright test tests/acl.spec.js              # Access Control List (ACL)
npx playwright test tests/pengguna.spec.js         # Fitur Pengguna 
npx playwright test tests/pj.spec.js               # Fitur Penanggung Jawab 
npx playwright test tests/pengelola.spec.js        # Fitur Pengelola Aset
npx playwright test tests/search-filter.spec.js    # Search & Filter 
npx playwright test tests/pdf.spec.js              # Export PDF
npx playwright test tests/api.spec.js              # REST API
npx playwright test tests/error-handling.spec.js   # Error Handling 

# Lihat laporan hasil test dalam format HTML
npx playwright show-report
```

**Hasil Testing:** 45/45 test passed ✅ (Browser: Chromium)

---

## Pembagian Tugas Anggota

| No | Nama | NIM | Fitur yang Dikerjakan | Status |
|----|------|-----|-----------------------|--------|
| 1 | Akbar Rivan Putra | 2411522011 | Pengguna dapat mengisi form laporan kerusakan aset | ✅ |
| 2 | Akbar Rivan Putra | 2411522011 | Pengguna dapat melihat status laporan secara real-time | ✅ |
| 3 | Akbar Rivan Putra | 2411522011 | Pengguna dapat memfilter riwayat laporan berdasarkan status | ✅ |
| 4 | Akbar Rivan Putra | 2411522011 | Pengguna dapat menggenerate bukti laporan dalam format PDF | 📄 |
| 5 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat melihat statistik laporan melalui dashboard | ✅ |
| 6 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat mencari laporan berdasarkan nama aset | ✅ |
| 7 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat melihat daftar permintaan maintenance (Read) | ✅ |
| 8 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat mengedit data laporan maintenance (Update) | ✅ |
| 9 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat menghapus laporan yang tidak valid (Delete) | ✅ |
| 10 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat mengajukan permohonan maintenance kepada Pengelola Aset (Create) | ✅ |
| 11 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat melakukan verifikasi hasil perbaikan dan close permohonan maintenance (Update) | ✅ |
| 12 | Dhyva Aulia Hendri | 2411521001 | Penanggung Jawab dapat menggenerate rekap laporan bulanan dalam format PDF | 📄 |
| 13 | Dhyva Aulia Hendri | 2411522011 | Pengelola Aset dapat melihat daftar penugasan maintenance | ✅ |
| 14 | Akbar Rivan Putra | 2411522011 | Pengelola Aset dapat mengunggah foto bukti hasil akhir maintenance | ✅ |
| 15 | Akbar Rivan Putra | 2411522011 | Pengelola Aset dapat mengupdate riwayat perbaikan | ✅ |
| 16 | Akbar Rivan Putra | 2411522011 | Sistem menyediakan response API JSON untuk operasi laporan maintenance | 🌐 |
| 17 | Dhyva Aulia Hendri | 2411521001 | Sistem menyediakan response API JSON untuk operasi update dan validasi maintenance | 🌐 |

> **Dikerjakan bersama:** Setup project, konfigurasi awal, dan deployment.

---

*Kelompok A4 — Tugas Besar Pemrograman Web, Departemen Sistem Informasi, Fakultas Teknologi Informasi, Universitas Andalas — Juni 2026*
