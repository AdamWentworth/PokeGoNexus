const tokenService = require('../services/tokenService');

const readAccessToken = (req) => {
  const cookieToken = typeof req.cookies?.accessToken === 'string'
    ? req.cookies.accessToken.trim()
    : '';
  if (cookieToken) return cookieToken;

  const authorization = typeof req.get === 'function'
    ? req.get('authorization')
    : req.headers?.authorization;
  if (typeof authorization !== 'string') return '';

  const normalized = authorization.trim();
  if (normalized.length < 8 || normalized.slice(0, 6).toLowerCase() !== 'bearer') {
    return '';
  }
  if (normalized[6].trim()) return '';
  return normalized.slice(7).trim();
};

module.exports = (req, res, next) => {
  const accessToken = readAccessToken(req);
  if (!accessToken) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const decoded = tokenService.verifyAccessToken(accessToken);
  if (!decoded || !decoded.user_id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  req.auth = {
    userId: String(decoded.user_id),
    username: decoded.username || '',
    issuedAt: Number(decoded.iat || 0),
    deviceId: decoded.device_id || ''
  };

  next();
};
