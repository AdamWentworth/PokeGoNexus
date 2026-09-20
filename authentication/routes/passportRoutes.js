const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const logger = require('../middlewares/logger');
const setCookies = require('../middlewares/setCookies');
const googleOAuth = require('../services/googleOAuthService');
const discordOAuth = require('../services/discordOAuthService');
const facebookOAuth = require('../services/facebookOAuthService');
const { createSession } = require('../services/sessionService');
const tokenService = require('../services/tokenService');
const {
  claimNativeOAuthLink,
  completeNativeOAuthAuthentication,
  completeNativeOAuthLink,
  isNativeOAuthState,
  redirectNativeOAuthError,
  redirectNativeOAuthResult
} = require('../services/nativeOAuthLinkService');

const router = express.Router();
const FLOW_TTL = '10m';
const STATE_COOKIE = 'googleOAuthState';
const PENDING_COOKIE = 'googleOAuthPending';
const DISCORD_STATE_COOKIE = 'discordOAuthState';
const DISCORD_PENDING_COOKIE = 'discordOAuthPending';
const FACEBOOK_STATE_COOKIE = 'facebookOAuthState';
const FACEBOOK_PENDING_COOKIE = 'facebookOAuthPending';
const TRAINER_CODE_RE = /^\d{12}$/;
const localFrontendOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);
const configuredFrontendOrigin = process.env.FRONTEND_URL;
const fallbackFrontendOrigin =
  process.env.NODE_ENV === 'production' && localFrontendOrigins.has(configuredFrontendOrigin)
    ? 'https://pokegonexus.com'
    : (configuredFrontendOrigin || (
      process.env.NODE_ENV === 'production' ? 'https://pokegonexus.com' : 'http://localhost:3000'
    ));
const allowedFrontendOrigins = new Set([
  configuredFrontendOrigin,
  ...localFrontendOrigins,
  'https://pokegonexus.com',
  'https://www.pokegonexus.com'
].filter(Boolean));

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'test',
  sameSite: 'lax',
  maxAge: 10 * 60 * 1000,
  path: '/'
};

const secret = () => process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;
const signFlow = (payload) => jwt.sign(payload, secret(), {
  expiresIn: FLOW_TTL,
  algorithm: 'HS256',
  issuer: 'pokemongonexus-google-oauth'
});
const verifyFlow = (token) => jwt.verify(token, secret(), {
  algorithms: ['HS256'],
  issuer: 'pokemongonexus-google-oauth'
});
const signDiscordFlow = (payload) => jwt.sign(payload, secret(), {
  expiresIn: FLOW_TTL,
  algorithm: 'HS256',
  issuer: 'pokemongonexus-discord-oauth'
});
const verifyDiscordFlow = (token) => jwt.verify(token, secret(), {
  algorithms: ['HS256'],
  issuer: 'pokemongonexus-discord-oauth'
});
const signFacebookFlow = (payload) => jwt.sign(payload, secret(), {
  expiresIn: FLOW_TTL,
  algorithm: 'HS256',
  issuer: 'pokemongonexus-facebook-oauth'
});
const verifyFacebookFlow = (token) => jwt.verify(token, secret(), {
  algorithms: ['HS256'],
  issuer: 'pokemongonexus-facebook-oauth'
});
const safeFrontendOrigin = (candidate) =>
  allowedFrontendOrigins.has(candidate) ? candidate : fallbackFrontendOrigin;
const redirectWithStatus = (res, origin, path, status) =>
  res.redirect(302, `${origin}${path}${path.includes('?') ? '&' : '?'}oauth=${encodeURIComponent(status)}`);
const optionalString = (value, max) => {
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const normalized = value.trim();
  return normalized && normalized.length <= max
    ? { ok: true, value: normalized }
    : { ok: false };
};
const parseCoordinates = (value) => {
  if (value === undefined || value === null) return { ok: true, value: value ?? undefined };
  if (typeof value !== 'object') return { ok: false };
  const { latitude, longitude } = value;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ok: false };
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return { ok: false };
  return { ok: true, value: { latitude, longitude } };
};
const buildFlowIdentity = (req) => {
  const requestedIntent = ['login', 'register', 'link'].includes(req.query.intent)
    ? req.query.intent
    : 'login';
  if (requestedIntent !== 'link') return { intent: requestedIntent };
  const decoded = tokenService.verifyAccessToken(req.cookies?.accessToken);
  if (!decoded?.user_id) {
    const error = new Error('Sign in again before connecting an account.');
    error.status = 401;
    throw error;
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - Number(decoded.iat || 0);
  if (ageSeconds < 0 || ageSeconds > 15 * 60) {
    const error = new Error('Sign in again before connecting an account.');
    error.status = 401;
    throw error;
  }
  return { intent: 'link', linkUserId: String(decoded.user_id) };
};

const linkProviderIdentity = async ({ provider, identity, flow }) => {
  const existingOwner = await User.findOne({
    identities: { $elemMatch: { provider, subject: identity.subject } }
  });
  if (existingOwner) {
    return String(existingOwner._id) === flow.linkUserId
      ? { status: 'linked' }
      : { status: 'link-conflict' };
  }
  const user = await User.findById(flow.linkUserId);
  if (!user) return { status: 'failed' };
  user.identities.push({
    provider,
    subject: identity.subject,
    email: identity.email,
    emailVerified: identity.emailVerified === true
  });
  user[`${provider}Id`] = identity.subject;
  await user.save({ writeConcern: { w: 'majority' } });
  return { status: 'linked' };
};

const handleNativeProviderCallback = async ({
  provider,
  transaction,
  exchangeIdentity,
  res
}) => {
  try {
    const identity = await exchangeIdentity();
    if (transaction.intent !== 'link') {
      const identityOwner = await User.findOne({
        identities: { $elemMatch: { provider, subject: identity.subject } }
      });
      const emailOwner = identityOwner || await User.findOne({
        email: String(identity.email || '').trim().toLowerCase()
      });

      let result;
      if (transaction.intent === 'register') {
        result = emailOwner
          ? { status: 'account-exists' }
          : { status: 'registration-required', identity };
      } else if (!emailOwner) {
        result = { status: 'account-not-found' };
      } else {
        if (!identityOwner) {
          emailOwner[`${provider}Id`] = identity.subject;
          emailOwner.identities.push({
            provider,
            subject: identity.subject,
            email: identity.email,
            emailVerified: identity.emailVerified === true
          });
          await emailOwner.save({ writeConcern: { w: 'majority' } });
        }
        result = { status: 'authenticated', userId: emailOwner._id };
      }
      const resultCode = await completeNativeOAuthAuthentication(transaction, result);
      return redirectNativeOAuthResult(res, resultCode);
    }
    const linked = await linkProviderIdentity({
      provider,
      identity,
      flow: { linkUserId: String(transaction.userId) }
    });
    const resultCode = await completeNativeOAuthLink(transaction, linked.status);
    return redirectNativeOAuthResult(res, resultCode);
  } catch (error) {
    logger.warn(`${provider} native OAuth callback failed: ${error.message}`);
    try {
      const resultCode = await completeNativeOAuthLink(transaction, 'failed');
      return redirectNativeOAuthResult(res, resultCode);
    } catch {
      return redirectNativeOAuthError(res, 'failed');
    }
  }
};

router.get('/google', (req, res) => {
  try {
    const deviceId = typeof req.query.device_id === 'string' ? req.query.device_id.trim() : '';
    const flowIdentity = buildFlowIdentity(req);
    if (deviceId.length < 3 || deviceId.length > 128) {
      return res.status(400).json({ message: 'Invalid device_id' });
    }

    const returnOrigin = safeFrontendOrigin(req.query.return_to);
    const nonce = crypto.randomBytes(24).toString('base64url');
    const state = signFlow({ nonce, deviceId, returnOrigin, ...flowIdentity });
    res.cookie(STATE_COOKIE, state, cookieOptions);
    return res.redirect(302, googleOAuth.createAuthorizationUrl({ state, nonce }));
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Unable to start Google login.' });
  }
});

router.get('/google/callback', async (req, res) => {
  let flow;
  try {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const nativeTransaction = await claimNativeOAuthLink({ provider: 'google', state });
    if (nativeTransaction) {
      if (typeof req.query.code !== 'string') {
        const resultCode = await completeNativeOAuthLink(nativeTransaction, 'failed');
        return redirectNativeOAuthResult(res, resultCode);
      }
      return handleNativeProviderCallback({
        provider: 'google',
        transaction: nativeTransaction,
        exchangeIdentity: () => googleOAuth.exchangeCode(req.query.code, nativeTransaction.nonce),
        res
      });
    }
    if (isNativeOAuthState(state)) return redirectNativeOAuthError(res);
    if (!state || state !== req.cookies[STATE_COOKIE]) throw new Error('OAuth state mismatch.');
    flow = verifyFlow(state);
    res.clearCookie(STATE_COOKIE, { ...cookieOptions, maxAge: undefined });

    if (typeof req.query.code !== 'string') throw new Error('Google authorization was not completed.');
    const googleIdentity = await googleOAuth.exchangeCode(req.query.code, flow.nonce);
    if (flow.intent === 'link') {
      const linked = await linkProviderIdentity({
        provider: 'google',
        identity: googleIdentity,
        flow
      });
      return redirectWithStatus(res, flow.returnOrigin, '/settings/account', linked.status);
    }
    const identityQuery = {
      identities: { $elemMatch: { provider: 'google', subject: googleIdentity.subject } }
    };
    const user = await User.findOne(identityQuery);

    if (user) {
      if (flow.intent === 'register') {
        return redirectWithStatus(res, flow.returnOrigin, '/login', 'account-exists');
      }
      const tokens = await createSession(User, user, flow.deviceId);
      req.accessToken = tokens.accessToken;
      req.refreshToken = tokens.refreshToken;
      return setCookies(req, res, () =>
        redirectWithStatus(res, flow.returnOrigin, '/login', 'success')
      );
    }

    const emailOwner = await User.findOne({ email: googleIdentity.email });
    if (emailOwner) {
      if (flow.intent === 'register') {
        return redirectWithStatus(res, flow.returnOrigin, '/login', 'account-exists');
      }

      emailOwner.googleId = googleIdentity.subject;
      emailOwner.identities.push({
        provider: 'google',
        subject: googleIdentity.subject,
        email: googleIdentity.email,
        emailVerified: true
      });
      await emailOwner.save({ writeConcern: { w: 'majority' } });

      const tokens = await createSession(User, emailOwner, flow.deviceId);
      req.accessToken = tokens.accessToken;
      req.refreshToken = tokens.refreshToken;
      return setCookies(req, res, () =>
        redirectWithStatus(res, flow.returnOrigin, '/login', 'success')
      );
    }

    if (flow.intent === 'login') {
      return redirectWithStatus(res, flow.returnOrigin, '/register', 'account-not-found');
    }

    res.cookie(PENDING_COOKIE, signFlow({
      provider: 'google',
      subject: googleIdentity.subject,
      email: googleIdentity.email,
      emailVerified: true,
      deviceId: flow.deviceId
    }), cookieOptions);
    return redirectWithStatus(res, flow.returnOrigin, '/register', 'google');
  } catch (error) {
    logger.warn(`Google OAuth callback failed: ${error.message}`);
    return redirectWithStatus(
      res,
      safeFrontendOrigin(flow?.returnOrigin),
      '/login',
      'failed'
    );
  }
});

router.get('/google/pending', (req, res) => {
  try {
    const pending = verifyFlow(req.cookies[PENDING_COOKIE] || '');
    if (pending.provider !== 'google') throw new Error('Invalid provider.');
    return res.json({ provider: 'google', email: pending.email, emailVerified: true });
  } catch {
    return res.status(401).json({ message: 'Google registration has expired. Please try again.' });
  }
});

router.post('/google/complete-registration', async (req, res, next) => {
  try {
    const pending = verifyFlow(req.cookies[PENDING_COOKIE] || '');
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const pokemonGoNameResult = optionalString(req.body?.pokemonGoName, 64);
    const pokemonGoName = pokemonGoNameResult.value;
    const trainerCode = typeof req.body?.trainerCode === 'string' ? req.body.trainerCode.replace(/\s+/g, '') || null : null;
    const locationResult = optionalString(req.body?.location, 255);
    const location = locationResult.value;
    const allowLocation = req.body?.allowLocation ?? false;
    const coordinatesResult = parseCoordinates(req.body?.coordinates);

    if (pending.provider !== 'google' || !/^[A-Za-z0-9_]{3,15}$/.test(username)) {
      return res.status(400).json({ message: 'Invalid Google registration' });
    }
    if (!pokemonGoNameResult.ok) return res.status(400).json({ message: 'Invalid pokemonGoName' });
    if (trainerCode && !TRAINER_CODE_RE.test(trainerCode)) {
      return res.status(400).json({ message: 'Invalid Trainer Code' });
    }
    if (!locationResult.ok) return res.status(400).json({ message: 'Invalid location' });
    if (typeof allowLocation !== 'boolean') {
      return res.status(400).json({ message: 'allowLocation must be boolean' });
    }
    if (!coordinatesResult.ok) return res.status(400).json({ message: 'Invalid coordinates' });
    if (await User.findOne({ username })) return res.status(409).json({ message: 'Username already exists' });
    if (await User.findOne({ email: pending.email })) return res.status(409).json({ message: 'Email already exists' });
    if (pokemonGoName && await User.findOne({ pokemonGoName })) {
      return res.status(409).json({ message: 'Pokémon Go name already exists' });
    }
    if (trainerCode && await User.findOne({ trainerCode })) {
      return res.status(409).json({ message: 'Trainer Code already exists' });
    }

    const user = await new User({
      username,
      email: pending.email,
      pokemonGoName,
      trainerCode,
      allowLocation,
      location,
      ...(coordinatesResult.value !== undefined && { coordinates: coordinatesResult.value }),
      googleId: pending.subject,
      identities: [{
        provider: 'google',
        subject: pending.subject,
        email: pending.email,
        emailVerified: true
      }]
    }).save({ writeConcern: { w: 'majority' } });

    const tokens = await createSession(User, user, pending.deviceId);
    req.accessToken = tokens.accessToken;
    req.refreshToken = tokens.refreshToken;
    res.locals.user = user;
    res.locals.tokens = tokens;
    res.clearCookie(PENDING_COOKIE, { ...cookieOptions, maxAge: undefined });
    next();
  } catch (error) {
    logger.warn(`Google registration failed: ${error.message}`);
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'That account information is already in use.' });
    }
    return res.status(401).json({ message: 'Google registration has expired. Please try again.' });
  }
}, setCookies, (req, res) => {
  const { user, tokens } = res.locals;
  return res.status(201).json({
    user_id: user._id.toString(),
    username: user.username,
    email: user.email,
    pokemonGoName: user.pokemonGoName,
    trainerCode: user.trainerCode,
    allowLocation: user.allowLocation,
    location: user.location,
    coordinates: user.coordinates,
    accessTokenExpiry: tokens.accessTokenExpiry.toISOString(),
    refreshTokenExpiry: tokens.refreshTokenExpiry.toISOString(),
    message: 'Google account created successfully'
  });
});

router.get('/discord', (req, res) => {
  try {
    const deviceId = typeof req.query.device_id === 'string' ? req.query.device_id.trim() : '';
    const flowIdentity = buildFlowIdentity(req);
    if (deviceId.length < 3 || deviceId.length > 128) {
      return res.status(400).json({ message: 'Invalid device_id' });
    }

    const returnOrigin = safeFrontendOrigin(req.query.return_to);
    const state = signDiscordFlow({
      deviceId,
      returnOrigin,
      ...flowIdentity,
      nonce: crypto.randomBytes(24).toString('base64url')
    });
    res.cookie(DISCORD_STATE_COOKIE, state, cookieOptions);
    return res.redirect(302, discordOAuth.createAuthorizationUrl({ state }));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Unable to start Discord login.'
    });
  }
});

router.get('/discord/callback', async (req, res) => {
  let flow;
  try {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const nativeTransaction = await claimNativeOAuthLink({ provider: 'discord', state });
    if (nativeTransaction) {
      if (typeof req.query.code !== 'string') {
        const resultCode = await completeNativeOAuthLink(nativeTransaction, 'failed');
        return redirectNativeOAuthResult(res, resultCode);
      }
      return handleNativeProviderCallback({
        provider: 'discord',
        transaction: nativeTransaction,
        exchangeIdentity: () => discordOAuth.exchangeCode(req.query.code),
        res
      });
    }
    if (isNativeOAuthState(state)) return redirectNativeOAuthError(res);
    if (!state || state !== req.cookies[DISCORD_STATE_COOKIE]) {
      throw new Error('OAuth state mismatch.');
    }
    flow = verifyDiscordFlow(state);
    res.clearCookie(DISCORD_STATE_COOKIE, { ...cookieOptions, maxAge: undefined });

    if (typeof req.query.code !== 'string') {
      throw new Error('Discord authorization was not completed.');
    }
    const discordIdentity = await discordOAuth.exchangeCode(req.query.code);
    if (flow.intent === 'link') {
      const linked = await linkProviderIdentity({
        provider: 'discord',
        identity: discordIdentity,
        flow
      });
      return redirectWithStatus(res, flow.returnOrigin, '/settings/account', linked.status);
    }
    const user = await User.findOne({
      identities: {
        $elemMatch: { provider: 'discord', subject: discordIdentity.subject }
      }
    });

    if (user) {
      if (flow.intent === 'register') {
        return redirectWithStatus(res, flow.returnOrigin, '/login', 'account-exists');
      }
      const tokens = await createSession(User, user, flow.deviceId);
      req.accessToken = tokens.accessToken;
      req.refreshToken = tokens.refreshToken;
      return setCookies(req, res, () =>
        redirectWithStatus(res, flow.returnOrigin, '/login', 'success')
      );
    }

    const emailOwner = await User.findOne({ email: discordIdentity.email });
    if (emailOwner) {
      if (flow.intent === 'register') {
        return redirectWithStatus(res, flow.returnOrigin, '/login', 'account-exists');
      }

      emailOwner.discordId = discordIdentity.subject;
      emailOwner.identities.push({
        provider: 'discord',
        subject: discordIdentity.subject,
        email: discordIdentity.email,
        emailVerified: true
      });
      await emailOwner.save({ writeConcern: { w: 'majority' } });

      const tokens = await createSession(User, emailOwner, flow.deviceId);
      req.accessToken = tokens.accessToken;
      req.refreshToken = tokens.refreshToken;
      return setCookies(req, res, () =>
        redirectWithStatus(res, flow.returnOrigin, '/login', 'success')
      );
    }

    if (flow.intent === 'login') {
      return redirectWithStatus(res, flow.returnOrigin, '/register', 'account-not-found');
    }

    res.cookie(DISCORD_PENDING_COOKIE, signDiscordFlow({
      provider: 'discord',
      subject: discordIdentity.subject,
      email: discordIdentity.email,
      emailVerified: true,
      deviceId: flow.deviceId
    }), cookieOptions);
    return redirectWithStatus(res, flow.returnOrigin, '/register', 'discord');
  } catch (error) {
    logger.warn(`Discord OAuth callback failed: ${error.message}`);
    return redirectWithStatus(
      res,
      safeFrontendOrigin(flow?.returnOrigin),
      '/login',
      'failed'
    );
  }
});

router.get('/discord/pending', (req, res) => {
  try {
    const pending = verifyDiscordFlow(req.cookies[DISCORD_PENDING_COOKIE] || '');
    if (pending.provider !== 'discord') throw new Error('Invalid provider.');
    return res.json({ provider: 'discord', email: pending.email, emailVerified: true });
  } catch {
    return res.status(401).json({
      message: 'Discord registration has expired. Please try again.'
    });
  }
});

router.post('/discord/complete-registration', async (req, res, next) => {
  try {
    const pending = verifyDiscordFlow(req.cookies[DISCORD_PENDING_COOKIE] || '');
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const pokemonGoNameResult = optionalString(req.body?.pokemonGoName, 64);
    const pokemonGoName = pokemonGoNameResult.value;
    const trainerCode = typeof req.body?.trainerCode === 'string'
      ? req.body.trainerCode.replace(/\s+/g, '') || null
      : null;
    const locationResult = optionalString(req.body?.location, 255);
    const location = locationResult.value;
    const allowLocation = req.body?.allowLocation ?? false;
    const coordinatesResult = parseCoordinates(req.body?.coordinates);

    if (pending.provider !== 'discord' || !/^[A-Za-z0-9_]{3,15}$/.test(username)) {
      return res.status(400).json({ message: 'Invalid Discord registration' });
    }
    if (!pokemonGoNameResult.ok) return res.status(400).json({ message: 'Invalid pokemonGoName' });
    if (trainerCode && !TRAINER_CODE_RE.test(trainerCode)) {
      return res.status(400).json({ message: 'Invalid Trainer Code' });
    }
    if (!locationResult.ok) return res.status(400).json({ message: 'Invalid location' });
    if (typeof allowLocation !== 'boolean') {
      return res.status(400).json({ message: 'allowLocation must be boolean' });
    }
    if (!coordinatesResult.ok) return res.status(400).json({ message: 'Invalid coordinates' });
    if (await User.findOne({ username })) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    if (await User.findOne({ email: pending.email })) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    if (pokemonGoName && await User.findOne({ pokemonGoName })) {
      return res.status(409).json({ message: 'Pokémon Go name already exists' });
    }
    if (trainerCode && await User.findOne({ trainerCode })) {
      return res.status(409).json({ message: 'Trainer Code already exists' });
    }

    const user = await new User({
      username,
      email: pending.email,
      pokemonGoName,
      trainerCode,
      allowLocation,
      location,
      ...(coordinatesResult.value !== undefined && {
        coordinates: coordinatesResult.value
      }),
      discordId: pending.subject,
      identities: [{
        provider: 'discord',
        subject: pending.subject,
        email: pending.email,
        emailVerified: true
      }]
    }).save({ writeConcern: { w: 'majority' } });

    const tokens = await createSession(User, user, pending.deviceId);
    req.accessToken = tokens.accessToken;
    req.refreshToken = tokens.refreshToken;
    res.locals.user = user;
    res.locals.tokens = tokens;
    res.clearCookie(DISCORD_PENDING_COOKIE, {
      ...cookieOptions,
      maxAge: undefined
    });
    next();
  } catch (error) {
    logger.warn(`Discord registration failed: ${error.message}`);
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'That account information is already in use.'
      });
    }
    return res.status(401).json({
      message: 'Discord registration has expired. Please try again.'
    });
  }
}, setCookies, (req, res) => {
  const { user, tokens } = res.locals;
  return res.status(201).json({
    user_id: user._id.toString(),
    username: user.username,
    email: user.email,
    pokemonGoName: user.pokemonGoName,
    trainerCode: user.trainerCode,
    allowLocation: user.allowLocation,
    location: user.location,
    coordinates: user.coordinates,
    accessTokenExpiry: tokens.accessTokenExpiry.toISOString(),
    refreshTokenExpiry: tokens.refreshTokenExpiry.toISOString(),
    message: 'Discord account created successfully'
  });
});

router.get('/facebook', (req, res) => {
  try {
    const deviceId = typeof req.query.device_id === 'string' ? req.query.device_id.trim() : '';
    const flowIdentity = buildFlowIdentity(req);
    if (deviceId.length < 3 || deviceId.length > 128) {
      return res.status(400).json({ message: 'Invalid device_id' });
    }

    const returnOrigin = safeFrontendOrigin(req.query.return_to);
    const state = signFacebookFlow({
      deviceId,
      returnOrigin,
      ...flowIdentity,
      nonce: crypto.randomBytes(24).toString('base64url')
    });
    res.cookie(FACEBOOK_STATE_COOKIE, state, cookieOptions);
    const authorizationUrl = facebookOAuth.createAuthorizationUrl({ state });
    if (req.query.response_mode === 'json') {
      return res.json({ authorizationUrl });
    }
    return res.redirect(302, authorizationUrl);
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Unable to start Facebook login.'
    });
  }
});

router.get('/facebook/callback', async (req, res) => {
  let flow;
  try {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const nativeTransaction = await claimNativeOAuthLink({ provider: 'facebook', state });
    if (nativeTransaction) {
      if (typeof req.query.code !== 'string') {
        const resultCode = await completeNativeOAuthLink(nativeTransaction, 'failed');
        return redirectNativeOAuthResult(res, resultCode);
      }
      return handleNativeProviderCallback({
        provider: 'facebook',
        transaction: nativeTransaction,
        exchangeIdentity: () => facebookOAuth.exchangeCode(req.query.code),
        res
      });
    }
    if (isNativeOAuthState(state)) return redirectNativeOAuthError(res);
    if (!state || state !== req.cookies[FACEBOOK_STATE_COOKIE]) {
      throw new Error('OAuth state mismatch.');
    }
    flow = verifyFacebookFlow(state);
    res.clearCookie(FACEBOOK_STATE_COOKIE, {
      ...cookieOptions,
      maxAge: undefined
    });

    if (typeof req.query.code !== 'string') {
      throw new Error('Facebook authorization was not completed.');
    }
    const identity = await facebookOAuth.exchangeCode(req.query.code);
    if (flow.intent === 'link') {
      const linked = await linkProviderIdentity({
        provider: 'facebook',
        identity,
        flow
      });
      return redirectWithStatus(res, flow.returnOrigin, '/settings/account', linked.status);
    }
    const user = await User.findOne({
      identities: {
        $elemMatch: { provider: 'facebook', subject: identity.subject }
      }
    });

    if (user) {
      if (flow.intent === 'register') {
        return redirectWithStatus(res, flow.returnOrigin, '/login', 'account-exists');
      }
      const tokens = await createSession(User, user, flow.deviceId);
      req.accessToken = tokens.accessToken;
      req.refreshToken = tokens.refreshToken;
      return setCookies(req, res, () =>
        redirectWithStatus(res, flow.returnOrigin, '/login', 'success')
      );
    }

    const emailOwner = await User.findOne({ email: identity.email });
    if (emailOwner) {
      if (flow.intent === 'register') {
        return redirectWithStatus(res, flow.returnOrigin, '/login', 'account-exists');
      }

      emailOwner.facebookId = identity.subject;
      emailOwner.identities.push({
        provider: 'facebook',
        subject: identity.subject,
        email: identity.email,
        emailVerified: true
      });
      await emailOwner.save({ writeConcern: { w: 'majority' } });

      const tokens = await createSession(User, emailOwner, flow.deviceId);
      req.accessToken = tokens.accessToken;
      req.refreshToken = tokens.refreshToken;
      return setCookies(req, res, () =>
        redirectWithStatus(res, flow.returnOrigin, '/login', 'success')
      );
    }

    if (flow.intent === 'login') {
      return redirectWithStatus(res, flow.returnOrigin, '/register', 'account-not-found');
    }

    res.cookie(FACEBOOK_PENDING_COOKIE, signFacebookFlow({
      provider: 'facebook',
      subject: identity.subject,
      email: identity.email,
      emailVerified: true,
      deviceId: flow.deviceId
    }), cookieOptions);
    return redirectWithStatus(res, flow.returnOrigin, '/register', 'facebook');
  } catch (error) {
    logger.warn(`Facebook OAuth callback failed: ${error.message}`);
    return redirectWithStatus(
      res,
      safeFrontendOrigin(flow?.returnOrigin),
      '/login',
      'failed'
    );
  }
});

router.get('/facebook/pending', (req, res) => {
  try {
    const pending = verifyFacebookFlow(req.cookies[FACEBOOK_PENDING_COOKIE] || '');
    if (pending.provider !== 'facebook') throw new Error('Invalid provider.');
    return res.json({
      provider: 'facebook',
      email: pending.email,
      emailVerified: true
    });
  } catch {
    return res.status(401).json({
      message: 'Facebook registration has expired. Please try again.'
    });
  }
});

router.post('/facebook/complete-registration', async (req, res, next) => {
  try {
    const pending = verifyFacebookFlow(req.cookies[FACEBOOK_PENDING_COOKIE] || '');
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const pokemonGoNameResult = optionalString(req.body?.pokemonGoName, 64);
    const pokemonGoName = pokemonGoNameResult.value;
    const trainerCode = typeof req.body?.trainerCode === 'string'
      ? req.body.trainerCode.replace(/\s+/g, '') || null
      : null;
    const locationResult = optionalString(req.body?.location, 255);
    const location = locationResult.value;
    const allowLocation = req.body?.allowLocation ?? false;
    const coordinatesResult = parseCoordinates(req.body?.coordinates);

    if (pending.provider !== 'facebook' || !/^[A-Za-z0-9_]{3,15}$/.test(username)) {
      return res.status(400).json({ message: 'Invalid Facebook registration' });
    }
    if (!pokemonGoNameResult.ok) return res.status(400).json({ message: 'Invalid pokemonGoName' });
    if (trainerCode && !TRAINER_CODE_RE.test(trainerCode)) {
      return res.status(400).json({ message: 'Invalid Trainer Code' });
    }
    if (!locationResult.ok) return res.status(400).json({ message: 'Invalid location' });
    if (typeof allowLocation !== 'boolean') {
      return res.status(400).json({ message: 'allowLocation must be boolean' });
    }
    if (!coordinatesResult.ok) return res.status(400).json({ message: 'Invalid coordinates' });
    if (await User.findOne({ username })) {
      return res.status(409).json({ message: 'Username already exists' });
    }
    if (await User.findOne({ email: pending.email })) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    if (pokemonGoName && await User.findOne({ pokemonGoName })) {
      return res.status(409).json({ message: 'Pokémon Go name already exists' });
    }
    if (trainerCode && await User.findOne({ trainerCode })) {
      return res.status(409).json({ message: 'Trainer Code already exists' });
    }

    const user = await new User({
      username,
      email: pending.email,
      pokemonGoName,
      trainerCode,
      allowLocation,
      location,
      ...(coordinatesResult.value !== undefined && {
        coordinates: coordinatesResult.value
      }),
      facebookId: pending.subject,
      identities: [{
        provider: 'facebook',
        subject: pending.subject,
        email: pending.email,
        emailVerified: true
      }]
    }).save({ writeConcern: { w: 'majority' } });

    const tokens = await createSession(User, user, pending.deviceId);
    req.accessToken = tokens.accessToken;
    req.refreshToken = tokens.refreshToken;
    res.locals.user = user;
    res.locals.tokens = tokens;
    res.clearCookie(FACEBOOK_PENDING_COOKIE, {
      ...cookieOptions,
      maxAge: undefined
    });
    next();
  } catch (error) {
    logger.warn(`Facebook registration failed: ${error.message}`);
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'That account information is already in use.'
      });
    }
    return res.status(401).json({
      message: 'Facebook registration has expired. Please try again.'
    });
  }
}, setCookies, (req, res) => {
  const { user, tokens } = res.locals;
  return res.status(201).json({
    user_id: user._id.toString(),
    username: user.username,
    email: user.email,
    pokemonGoName: user.pokemonGoName,
    trainerCode: user.trainerCode,
    allowLocation: user.allowLocation,
    location: user.location,
    coordinates: user.coordinates,
    accessTokenExpiry: tokens.accessTokenExpiry.toISOString(),
    refreshTokenExpiry: tokens.refreshTokenExpiry.toISOString(),
    message: 'Facebook account created successfully'
  });
});

module.exports = router;
