// Memanggil library mysql2 yang mendukung Promise (async/await)
const mysql = require('mysql2/promise');
require('dotenv').config(); // Untuk membaca konfigurasi dari file .env

// Membuat pool (kumpulan koneksi) ke database.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'facultyware',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test koneksi 
pool.getConnection()
    .then(conn => {
        console.log("✅ DATABASE CONNECTED: Sukses tersambung ke MySQL!");
        conn.release();
    })
    .catch(err => {
        console.error("❌ DATABASE ERROR: Gagal konek ke MySQL! Cek Laragon kamu.", err.message);
    });

// Mengekspor pool ini agar bisa digunakan di file controller kita nanti
module.exports = pool;
