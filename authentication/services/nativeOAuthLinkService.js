const crypto = require('crypto');

const OAuthLinkTransaction = require('../models/oauthLinkTransaction');

const FLOW_LIFETIME_MS = 10 * 60 * 1000;
const RESULT_LIFETIME_MS = 5 * 60 * 1000;
const NATIVE_STATE_PREFIX = 'native.';
const DEFAULT_REDIRECT_URI = 'pokegonexus://native/account';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const createOpaqueValue = (prefix = '') =>
  `${prefix}${crypto.randomBytes(32).toString('base64url')}`;

const getNativeRedirectUri = () =>
  process.env.MOBILE_OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;

const isNativeOAuthState = (state) =>
  typeof state === 'string' && state.startsWith(NATIVE_STATE_PREFIX);

const createNativeOAuthFlow = async ({ userId, provider, deviceId, intent }) => {
  const state = createOpaqueValue(NATIVE_STATE_PREFIX);
  const nonce = provider === 'google' ? createOpaqueValue() : null;
  await OAuthLinkTransaction.create({
    ...(userId ? { userId } : {}),
    provider,
    deviceId,
    intent,
    stateHash: digest(state),
    nonce,
    expiresAt: new Date(Date.now() + FLOW_LIFETIME_MS)
  });
  return { state, nonce };
};

const createNativeOAuthLink = (input) => createNativeOAuthFlow({
  ...input,
  intent: 'link'
});

const createNativeOAuthAuthentication = ({ provider, deviceId, intent }) =>
  createNativeOAuthFlow({ provider, deviceId, intent });

const claimNativeOAuthLink = async ({ provider, state }) => {
  if (!isNativeOAuthState(state)) return null;
  return OAuthLinkTransaction.findOneAndUpdate({
    provider,
    stateHash: digest(state),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }, {
    $set: { status: 'processing' }
  }, {
    returnDocument: 'after'
  });
};

const completeNativeOAuthLink = async (transaction, resultStatus) => {
  const resultCode = createOpaqueValue();
  const updated = await OAuthLinkTransaction.findOneAndUpdate({
    _id: transaction._id,
    status: 'processing'
  }, {
    $set: {
      status: 'completed',
      resultHash: digest(resultCode),
      resultStatus,
      expiresAt: new Date(Date.now() + RESULT_LIFETIME_MS)
    }
  }, {
    returnDocument: 'after'
  });
  if (!updated) throw new Error('Native OAuth link transaction is no longer active.');
  return resultCode;
};

const completeNativeOAuthAuthentication = async (transaction, result) => {
  const resultCode = createOpaqueValue();
  const updated = await OAuthLinkTransaction.findOneAndUpdate({
    _id: transaction._id,
    status: 'processing'
  }, {
    $set: {
      status: 'completed',
      resultHash: digest(resultCode),
      resultStatus: result.status,
      resultUserId: result.userId || null,
      identitySubject: result.identity?.subject || null,
      identityEmail: result.identity?.email || null,
      identityEmailVerified: result.identity?.emailVerified === true,
      expiresAt: new Date(Date.now() + RESULT_LIFETIME_MS)
    }
  }, {
    returnDocument: 'after'
  });
  if (!updated) throw new Error('Native OAuth transaction is no longer active.');
  return resultCode;
};

const consumeNativeOAuthLink = async ({ resultCode, userId, deviceId }) =>
  OAuthLinkTransaction.findOneAndUpdate({
    resultHash: digest(resultCode),
    userId,
    deviceId,
    status: 'completed',
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }, {
    $set: { consumedAt: new Date() }
  }, {
    returnDocument: 'after'
  });

const exchangeNativeOAuthAuthentication = async ({ resultCode, deviceId }) =>
  OAuthLinkTransaction.findOneAndUpdate({
    resultHash: digest(resultCode),
    intent: { $in: ['login', 'register'] },
    deviceId,
    status: 'completed',
    exchangedAt: null,
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }, {
    $set: { exchangedAt: new Date() }
  }, {
    returnDocument: 'after'
  });

const consumeNativeOAuthRegistration = async ({ resultCode, deviceId }) =>
  OAuthLinkTransaction.findOneAndUpdate({
    resultHash: digest(resultCode),
    intent: 'register',
    resultStatus: 'registration-required',
    deviceId,
    status: 'completed',
    exchangedAt: { $ne: null },
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }, {
    $set: { consumedAt: new Date() }
  }, {
    returnDocument: 'after'
  });

const getNativeOAuthRegistration = async ({ resultCode, deviceId }) =>
  OAuthLinkTransaction.findOne({
    resultHash: digest(resultCode),
    intent: 'register',
    resultStatus: 'registration-required',
    deviceId,
    status: 'completed',
    exchangedAt: { $ne: null },
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  });

const consumeNativeOAuthSession = async (transactionId) =>
  OAuthLinkTransaction.findOneAndUpdate({
    _id: transactionId,
    status: 'completed',
    consumedAt: null
  }, {
    $set: { consumedAt: new Date() }
  }, {
    returnDocument: 'after'
  });

const nativeOAuthResultUrl = ({ resultCode, error }) => {
  const url = new URL(getNativeRedirectUri());
  if (resultCode) url.searchParams.set('oauth_code', resultCode);
  if (error) url.searchParams.set('oauth_error', error);
  return url.toString();
};

const redirectNativeOAuthResult = (res, resultCode) =>
  res.redirect(302, nativeOAuthResultUrl({ resultCode }));

const redirectNativeOAuthError = (res, error = 'expired') =>
  res.redirect(302, nativeOAuthResultUrl({ error }));

module.exports = {
  completeNativeOAuthLink,
  completeNativeOAuthAuthentication,
  consumeNativeOAuthLink,
  consumeNativeOAuthRegistration,
  consumeNativeOAuthSession,
  createNativeOAuthLink,
  createNativeOAuthAuthentication,
  exchangeNativeOAuthAuthentication,
  getNativeOAuthRegistration,
  isNativeOAuthState,
  claimNativeOAuthLink,
  redirectNativeOAuthError,
  redirectNativeOAuthResult
};
