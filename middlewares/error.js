var createError = require('http-errors');

// Catch 404 and forward to error handler
const notFoundHandler = (req, res, next) => {
  next(createError(404));
};

// Error handler
const errorHandler = (err, req, res, next) => {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan yang tidak terduga.';
  // Set locals, only providing error in development
  res.locals.message = err.message;
  
  res.locals.error = { 
    status, 
    stack: req.app.get('env') === 'development' ? err.stack : '' 
  };

// Deteksi request API atau JSON untuk mengembalikan response berformat .json()
if (req.path.startsWith('/api/') || req.xhr ||
      (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(status).json({ success: false, message });
  }

res.status(status);

// Render halaman error
res.render('error', {
    message,
    error: res.locals.error
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
