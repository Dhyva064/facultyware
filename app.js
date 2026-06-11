require('dotenv').config();
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
// TAMBAHAN: Import method-override untuk mendukung PUT/DELETE melalui formulir HTML
var methodOverride = require('method-override');

var indexRouter = require('./routes/index');
// MODIFIKASI: Menambahkan rute spesifik SIMAINT yang diperlukan
var dashboardRouter = require('./routes/dashboard');
//var laporanRouter = require('./routes/laporan');
var pjLaporanRouter = require('./routes/pj/laporan');
var maintenanceRouter = require('./routes/pj/maintenance');
// [TEST MODE] Route belum tersedia, dinonaktifkan sementara
//var pengelolaRouter = require('./routes/pengelola');
//var progresRouter = require('./routes/progres');
//var apiRouter = require('./routes/api');

const { notFoundHandler, errorHandler } = require('./middlewares/error');
// [TEST MODE] Badge middleware belum tersedia, dinonaktifkan sementara
//const badgeMiddleware = require('./middlewares/badge');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// TAMBAHAN: Inisialisasi method-override
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306, // TAMBAHAN: Eksplisit port dari .env
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
  schema: {
      tableName: 'express_sessions',
      columnNames: {
          session_id: 'session_id',
          expires: 'expires',
          data: 'data'
      }
  }
});

app.use(session({
  key: 'fw_session', // MODIFIKASI: Nama key cookie spesifik untuk SIMAINT
  secret: process.env.SESSION_SECRET || 'fti_secret_2025',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    httpOnly: true // TAMBAHAN: Keamanan cookie
  }
}));

// [TEST MODE] Badge middleware belum tersedia, dinonaktifkan sementara
//app.use(badgeMiddleware);

// TAMBAHAN: Middleware anti-cache untuk memastikan flash message/update status tampil real-time
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Routes
// MODIFIKASI: Registrasi rute aplikasi SIMAINT
app.use('/', indexRouter);
app.use('/dashboard', dashboardRouter);
//app.use('/laporan', laporanRouter);
app.use('/laporan', pjLaporanRouter);
app.use('/pj/laporan', pjLaporanRouter);
app.use('/maintenance', maintenanceRouter);
// [TEST MODE] Route belum tersedia, dinonaktifkan sementara
//app.use('/penugasan', pengelolaRouter);
//app.use('/progres', progresRouter);
//app.use('/api/v1', apiRouter);

// catch 404 and forward to error handler
app.use(notFoundHandler);

// error handler
app.use(errorHandler);

module.exports = app;