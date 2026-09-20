const express = require('express');

const User = require('../models/user');

const requireAuth = require('../middlewares/requireAuth');
const googleOAuth = require('../services/googleOAuthService');
const discordOAuth = require('../services/discordOAuthService');
const facebookOAuth = require('../services/facebookOAuthService');
const {
  consumeNativeOAuthRegistration,
  consumeNativeOAuthSession,
  consumeNativeOAuthLink,
  createNativeOAuthAuthentication,
  createNativeOAuthLink,
  exchangeNativeOAuthAuthentication,
  getNativeOAuthRegistration
} = require('../services/nativeOAuthLinkService');
const { createSession } = require('../services/sessionService');

const router = express.Router();
const providers = new Set(['google', 'discord', 'facebook']);
const intents = new Set(['login', 'register']);
const TRAINER_CODE_RE = /^\d{12}$/;

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

const normalizedOptionalString = (value, max) => {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, value: null };
  const normalized = value.trim();
  return normalized && normalized.length <= max
    ? { ok: true, value: normalized }
    : { ok: false, value: null };
};

const parsedCoordinates = (value) => {
  if (value === undefined || value === null) return { ok: true, value: value ?? undefined };
  if (typeof value !== 'object') return { ok: false };
  if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return { ok: false };
  if (value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) {
    return { ok: false };
  }
  return { ok: true, value: { latitude: value.latitude, longitude: value.longitude } };
};

const recentlyAuthenticated = (issuedAt) => {
  const ageSeconds = Math.floor(Date.now() / 1000) - Number(issuedAt || 0);
  return ageSeconds >= 0 && ageSeconds <= 15 * 60;
};

const authorizationUrlFor = (provider, flow) => {
  if (provider === 'google') {
    return googleOAuth.createAuthorizationUrl({ state: flow.state, nonce: flow.nonce });
  }
  if (provider === 'discord') {
    return discordOAuth.createAuthorizationUrl({ state: flow.state });
  }
  return facebookOAuth.createAuthorizationUrl({ state: flow.state });
};

router.post('/mobile/oauth/start', async (req, res) => {
  try {
    const provider = typeof req.body?.provider === 'string'
      ? req.body.provider.trim().toLowerCase()
      : '';
    const intent = typeof req.body?.intent === 'string'
      ? req.body.intent.trim().toLowerCase()
      : '';
    const deviceId = typeof req.body?.device_id === 'string'
      ? req.body.device_id.trim()
      : '';
    if (!providers.has(provider) || !intents.has(intent)) {
      return res.status(400).json({ message: 'Unsupported OAuth request.' });
    }
    if (deviceId.length < 3 || deviceId.length > 128) {
      return res.status(400).json({ message: 'Invalid device_id.' });
    }
    const flow = await createNativeOAuthAuthentication({ provider, intent, deviceId });
    preventSessionCaching(res);
    return res.status(201).json({
      provider,
      intent,
      authorizationUrl: authorizationUrlFor(provider, flow)
    });
  } catch {
    return res.status(500).json({ message: 'Unable to start provider authentication.' });
  }
});

router.post('/mobile/oauth/exchange', async (req, res) => {
  const resultCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';
  if (resultCode.length < 32 || resultCode.length > 128 || deviceId.length < 3 || deviceId.length > 128) {
    return res.status(400).json({ message: 'Invalid or expired provider result.' });
  }
  try {
    const transaction = await exchangeNativeOAuthAuthentication({ resultCode, deviceId });
    if (!transaction) {
      return res.status(409).json({ message: 'This provider result is invalid, expired, or already used.' });
    }
    preventSessionCaching(res);
    if (transaction.resultStatus !== 'authenticated') {
      return res.json({
        provider: transaction.provider,
        status: transaction.resultStatus,
        ...(transaction.resultStatus === 'registration-required'
          ? { email: transaction.identityEmail }
          : {})
      });
    }
    const user = await User.findById(transaction.resultUserId);
    if (!user) return res.status(401).json({ message: 'That account is no longer available.' });
    const tokens = await createSession(User, user, deviceId);
    const consumed = await consumeNativeOAuthSession(transaction._id);
    if (!consumed) return res.status(409).json({ message: 'This provider result was already used.' });
    return res.json({
      provider: transaction.provider,
      status: 'authenticated',
      session: sessionPayload(user, tokens)
    });
  } catch {
    return res.status(500).json({ message: 'Unable to complete provider authentication.' });
  }
});

router.post('/mobile/oauth/complete-registration', async (req, res) => {
  const resultCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const deviceId = typeof req.body?.device_id === 'string' ? req.body.device_id.trim() : '';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const pokemonGoNameResult = normalizedOptionalString(req.body?.pokemonGoName, 64);
  const trainerCode = typeof req.body?.trainerCode === 'string'
    ? req.body.trainerCode.replace(/\s+/g, '') || null
    : null;
  const locationResult = normalizedOptionalString(req.body?.location, 255);
  const allowLocation = req.body?.allowLocation ?? false;
  const coordinatesResult = parsedCoordinates(req.body?.coordinates);
  if (resultCode.length < 32 || resultCode.length > 128 || deviceId.length < 3 || deviceId.length > 128) {
    return res.status(400).json({ message: 'Invalid or expired provider registration.' });
  }
  if (!/^[A-Za-z0-9_]{3,15}$/.test(username)) {
    return res.status(400).json({ message: 'Username must be 3–15 letters, numbers, or underscores.' });
  }
  if (!pokemonGoNameResult.ok) return res.status(400).json({ message: 'Invalid Pokémon GO name.' });
  if (trainerCode && !TRAINER_CODE_RE.test(trainerCode)) {
    return res.status(400).json({ message: 'Trainer Code must contain 12 digits.' });
  }
  if (!locationResult.ok) return res.status(400).json({ message: 'Invalid location.' });
  if (typeof allowLocation !== 'boolean') return res.status(400).json({ message: 'allowLocation must be boolean.' });
  if (!coordinatesResult.ok) return res.status(400).json({ message: 'Invalid coordinates.' });

  try {
    const pending = await getNativeOAuthRegistration({ resultCode, deviceId });
    if (!pending?.identitySubject || !pending.identityEmail) {
      return res.status(409).json({ message: 'This provider registration is invalid, expired, or already used.' });
    }
    if (await User.findOne({ username })) return res.status(409).json({ message: 'Username already exists.' });
    if (await User.findOne({ email: pending.identityEmail })) {
      return res.status(409).json({ message: 'An account already exists for this email. Sign in instead.' });
    }
    if (pokemonGoNameResult.value && await User.findOne({ pokemonGoName: pokemonGoNameResult.value })) {
      return res.status(409).json({ message: 'Pokémon GO name already exists.' });
    }
    if (trainerCode && await User.findOne({ trainerCode })) {
      return res.status(409).json({ message: 'Trainer Code already exists.' });
    }
    const claimed = await consumeNativeOAuthRegistration({ resultCode, deviceId });
    if (!claimed) return res.status(409).json({ message: 'This provider registration was already used.' });
    const provider = claimed.provider;
    const user = await new User({
      username,
      email: claimed.identityEmail,
      pokemonGoName: pokemonGoNameResult.value,
      trainerCode,
      allowLocation,
      location: locationResult.value,
      ...(coordinatesResult.value !== undefined && { coordinates: coordinatesResult.value }),
      [`${provider}Id`]: claimed.identitySubject,
      identities: [{
        provider,
        subject: claimed.identitySubject,
        email: claimed.identityEmail,
        emailVerified: claimed.identityEmailVerified === true
      }]
    }).save({ writeConcern: { w: 'majority' } });
    const tokens = await createSession(User, user, deviceId);
    preventSessionCaching(res);
    return res.status(201).json({
      provider,
      status: 'authenticated',
      session: sessionPayload(user, tokens)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'That account information is already in use.' });
    }
    return res.status(500).json({ message: 'Unable to complete provider registration.' });
  }
});

router.post('/mobile/oauth/link/start', requireAuth, async (req, res) => {
  try {
    const provider = typeof req.body?.provider === 'string'
      ? req.body.provider.trim().toLowerCase()
      : '';
    if (!providers.has(provider)) {
      return res.status(400).json({ message: 'Unsupported OAuth provider.' });
    }
    if (!req.auth.deviceId || !recentlyAuthenticated(req.auth.issuedAt)) {
      return res.status(401).json({ message: 'Sign in again before connecting an account.' });
    }
    const flow = await createNativeOAuthLink({
      userId: req.auth.userId,
      provider,
      deviceId: req.auth.deviceId
    });
    return res.status(201).json({
      provider,
      authorizationUrl: authorizationUrlFor(provider, flow)
    });
  } catch {
    return res.status(500).json({ message: 'Unable to start account connection.' });
  }
});

router.post('/mobile/oauth/link/exchange', requireAuth, async (req, res) => {
  const resultCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (resultCode.length < 32 || resultCode.length > 128 || !req.auth.deviceId) {
    return res.status(400).json({ message: 'Invalid or expired account connection result.' });
  }
  const transaction = await consumeNativeOAuthLink({
    resultCode,
    userId: req.auth.userId,
    deviceId: req.auth.deviceId
  });
  if (!transaction) {
    return res.status(409).json({ message: 'This account connection result is invalid, expired, or already used.' });
  }
  return res.json({
    provider: transaction.provider,
    status: transaction.resultStatus
  });
});

module.exports = router;
