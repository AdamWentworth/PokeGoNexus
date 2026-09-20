const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const logger = require('../middlewares/logger');
const {
  SessionError,
  createSession,
  rotateSession,
  revokeSession
} = require('../services/sessionService');

const router = express.Router();

const isNonEmptyString = (value, min = 1, max = 255) => (
  typeof value === 'string'
  && value.trim().length >= min
  && value.trim().length <= max
);

const userPayload = (user) => ({
  user_id: user._id.toString(),
  username: user.username,
  email: user.email,
  pokemonGoName: user.pokemonGoName,
  trainerCode: user.trainerCode,
  allowLocation: user.allowLocation,
  location: user.location,
  coordinates: user.coordinates
});

const sessionPayload = (user, tokens) => ({
  user: userPayload(user),
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  accessTokenExpiry: tokens.accessTokenExpiry.toISOString(),
  refreshTokenExpiry: tokens.refreshTokenExpiry.toISOString()
});

const preventSessionCaching = (res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
};

router.post('/mobile/login', async (req, res) => {
  const loginId = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';

  if (!isNonEmptyString(loginId, 3, 255)
      || !isNonEmptyString(password, 6, 128)
      || !isNonEmptyString(deviceId, 3, 128)) {
    return res.status(400).json({ message: 'Invalid login payload' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { username: loginId },
        { email: loginId.toLowerCase() }
      ]
    }).exec();
    const validPassword = Boolean(user?.password) && await bcrypt.compare(password, user.password);
    if (!user || !validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokens = await createSession(User, user, deviceId);
    preventSessionCaching(res);
    logger.info(`User ${user.username} created a mobile session`);
    return res.status(200).json({
      ...sessionPayload(user, tokens),
      message: 'Logged in successfully'
    });
  } catch (err) {
    logger.error(`Mobile login error: ${err.message}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/mobile/refresh', async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === 'string'
    ? req.body.refreshToken.trim()
    : '';
  if (!refreshToken || refreshToken.length > 8192) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const { user, tokens } = await rotateSession(User, refreshToken);
    preventSessionCaching(res);
    return res.status(200).json(sessionPayload(user, tokens));
  } catch (err) {
    if (err instanceof SessionError) {
      return res.status(err.status).json({ message: err.message });
    }
    logger.error(`Mobile refresh error: ${err.message}`);
    return res.status(500).json({ message: 'Failed to refresh tokens' });
  }
});

router.post('/mobile/logout', async (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === 'string'
    ? req.body.refreshToken.trim()
    : '';
  if (!refreshToken || refreshToken.length > 8192) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  try {
    await revokeSession(User, refreshToken);
    preventSessionCaching(res);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error(`Mobile logout error: ${err.message}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
