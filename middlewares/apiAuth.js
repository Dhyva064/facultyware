function apiAuth(req, res, next) {
  const configuredToken = process.env.API_TOKEN || process.env.API_KEY;

  if (!configuredToken) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const apiKey = req.headers['x-api-key'];
  const token = bearerToken || apiKey;

  if (token === configuredToken) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized',
  });
}

module.exports = apiAuth;
