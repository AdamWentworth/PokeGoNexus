const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/googleOAuthService', () => ({
  createAuthorizationUrl: jest.fn(({ state }) => `https://accounts.google.test/authorize?state=${encodeURIComponent(state)}`),
  exchangeCode: jest.fn(async () => ({
    subject: 'google-subject-123',
    email: 'google.user@example.com',
    emailVerified: true
  }))
}));

jest.mock('../services/discordOAuthService', () => ({
  createAuthorizationUrl: jest.fn(({ state }) =>
    `https://discord.test/oauth2/authorize?state=${encodeURIComponent(state)}`),
  exchangeCode: jest.fn(async () => ({
    subject: 'discord-subject-456',
    email: 'discord.user@example.com',
    emailVerified: true
  }))
}));

jest.mock('../services/facebookOAuthService', () => ({
  createAuthorizationUrl: jest.fn(({ state }) =>
    `https://facebook.test/dialog/oauth?state=${encodeURIComponent(state)}`),
  exchangeCode: jest.fn(async () => ({
    subject: 'facebook-subject-789',
    email: 'facebook.user@example.com',
    emailVerified: true
  }))
}));

jest.mock('../services/passwordResetEmailService', () => ({
  sendPasswordResetEmail: jest.fn(async () => undefined)
}));

jest.mock('../services/emailChangeService', () => ({
  sendEmailChangeVerification: jest.fn(async () => undefined),
  sendEmailChangedNotice: jest.fn(async () => undefined)
}));
const { sendEmailChangedNotice } = require('../services/emailChangeService');

jest.setTimeout(120000);

let mongoServer;
let app;
let mongoConnectionPromise;
let User;
let OAuthLinkTransaction;
let validLoginId;
let validEmail;
let validPassphrase;
let validDeviceId;

function buildRegisterPayload(overrides = {}) {
  return {
    username: validLoginId,
    email: validEmail,
    password: validPassphrase,
    device_id: validDeviceId,
    ...overrides
  };
}

async function registerUser(payload = {}) {
  return request(app).post('/auth/register').send(buildRegisterPayload(payload));
}

describe('authentication service integration', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    mongoServer = await MongoMemoryServer.create();
    process.env.DATABASE_URL = mongoServer.getUri('auth_test');

    ({ app, mongoConnectionPromise } = require('../app'));
    await mongoConnectionPromise;

    User = require('../models/user');
    OAuthLinkTransaction = require('../models/oauthLinkTransaction');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const seed = Date.now().toString(36);
    validLoginId = `ci_user_${seed}`;
    validEmail = `ci_${seed}@example.invalid`;
    validPassphrase = `ci_pass_${seed}_ok`;
    validDeviceId = `ci_device_${seed}`;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await OAuthLinkTransaction.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test('register creates user, hashes password, and sets auth cookies', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account created successfully.');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'].some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(res.headers['set-cookie'].some((c) => c.startsWith('refreshToken='))).toBe(true);

    const user = await User.findOne({ username: validLoginId }).lean();
    expect(user).toBeTruthy();
    expect(user.password).not.toBe(validPassphrase);
    expect(Array.isArray(user.refreshToken)).toBe(true);
    expect(user.refreshToken.length).toBe(1);
  });

  test('register rejects duplicate username', async () => {
    await registerUser();
    const second = await registerUser({ email: 'new@example.com' });

    expect(second.status).toBe(409);
    expect(second.body.message).toBe('Username already exists');
  });

  test('login succeeds with valid credentials and sets cookies', async () => {
    await registerUser();

    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });

    expect(login.status).toBe(200);
    expect(login.body.message).toBe('Logged in successfully');
    expect(login.headers['set-cookie']).toBeDefined();
    expect(login.headers['set-cookie'].some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  test('mobile session login, bearer access, rotation, and logout work without cookies', async () => {
    await registerUser();

    const login = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-native`
    });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']).toBeUndefined();
    expect(login.headers['cache-control']).toContain('no-store');
    expect(login.body.user).toMatchObject({
      username: validLoginId,
      email: validEmail
    });
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));

    const security = await request(app)
      .get('/auth/account/security')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(security.status).toBe(200);
    expect(security.body.email).toBe(validEmail);

    const refreshed = await request(app).post('/auth/mobile/refresh').send({
      refreshToken: login.body.refreshToken
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers['set-cookie']).toBeUndefined();
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    const reused = await request(app).post('/auth/mobile/refresh').send({
      refreshToken: login.body.refreshToken
    });
    expect(reused.status).toBe(401);

    const logout = await request(app).post('/auth/mobile/logout').send({
      refreshToken: refreshed.body.refreshToken
    });
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await request(app).post('/auth/mobile/refresh').send({
      refreshToken: refreshed.body.refreshToken
    });
    expect(refreshAfterLogout.status).toBe(401);
  });

  test('mobile session endpoints reject invalid credentials and missing tokens', async () => {
    await registerUser();

    const badLogin = await request(app).post('/auth/mobile/login').send({
      username: validLoginId,
      password: 'invalid_passphrase_for_ci',
      device_id: `${validDeviceId}-native`
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.message).toBe('Invalid credentials');

    expect((await request(app).post('/auth/mobile/refresh').send({})).status).toBe(401);
    expect((await request(app).post('/auth/mobile/logout').send({})).status).toBe(400);
  });

  test('native OAuth linking uses a one-use bearer-bound result without browser cookies', async () => {
    await registerUser();
    const login = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-native-link`
    });

    const start = await request(app)
      .post('/auth/mobile/oauth/link/start')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ provider: 'google' });
    expect(start.status).toBe(201);
    expect(start.headers['set-cookie']).toBeUndefined();
    expect(start.body).toMatchObject({ provider: 'google' });

    const authorizationUrl = new URL(start.body.authorizationUrl);
    const state = authorizationUrl.searchParams.get('state');
    expect(state).toMatch(/^native\./);

    const callback = await request(app)
      .get('/auth/google/callback')
      .query({ code: 'native-google-code', state });
    expect(callback.status).toBe(302);
    const callbackUrl = new URL(callback.headers.location);
    expect(`${callbackUrl.protocol}//${callbackUrl.host}${callbackUrl.pathname}`).toBe(
      'pokegonexus://native/account'
    );
    const resultCode = callbackUrl.searchParams.get('oauth_code');
    expect(resultCode).toEqual(expect.any(String));
    expect(callback.headers.location).not.toContain(login.body.accessToken);
    expect(callback.headers.location).not.toContain(login.body.refreshToken);

    const exchange = await request(app)
      .post('/auth/mobile/oauth/link/exchange')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ code: resultCode });
    expect(exchange.status).toBe(200);
    expect(exchange.body).toEqual({ provider: 'google', status: 'linked' });

    const user = await User.findOne({ username: validLoginId }).lean();
    expect(user.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'google', subject: 'google-subject-123' })
    ]));

    const replay = await request(app)
      .post('/auth/mobile/oauth/link/exchange')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ code: resultCode });
    expect(replay.status).toBe(409);
  });

  test('native OAuth link results cannot be exchanged by another device session', async () => {
    await registerUser();
    const firstLogin = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-first`
    });
    const secondLogin = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-second`
    });
    const start = await request(app)
      .post('/auth/mobile/oauth/link/start')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .send({ provider: 'discord' });
    const state = new URL(start.body.authorizationUrl).searchParams.get('state');
    const callback = await request(app)
      .get('/auth/discord/callback')
      .query({ code: 'native-discord-code', state });
    const resultCode = new URL(callback.headers.location).searchParams.get('oauth_code');

    const wrongDevice = await request(app)
      .post('/auth/mobile/oauth/link/exchange')
      .set('Authorization', `Bearer ${secondLogin.body.accessToken}`)
      .send({ code: resultCode });
    expect(wrongDevice.status).toBe(409);

    const correctDevice = await request(app)
      .post('/auth/mobile/oauth/link/exchange')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .send({ code: resultCode });
    expect(correctDevice.status).toBe(200);
    expect(correctDevice.body).toEqual({ provider: 'discord', status: 'linked' });
  });

  test('native OAuth linking permits concurrent pending provider transactions', async () => {
    await registerUser();
    const login = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-parallel-links`
    });
    const bearer = { Authorization: `Bearer ${login.body.accessToken}` };

    const [google, discord, facebook] = await Promise.all([
      request(app).post('/auth/mobile/oauth/link/start').set(bearer).send({ provider: 'google' }),
      request(app).post('/auth/mobile/oauth/link/start').set(bearer).send({ provider: 'discord' }),
      request(app).post('/auth/mobile/oauth/link/start').set(bearer).send({ provider: 'facebook' })
    ]);

    expect([google.status, discord.status, facebook.status]).toEqual([201, 201, 201]);
    expect(await OAuthLinkTransaction.countDocuments({ status: 'pending' })).toBe(3);
  });

  test('native OAuth linking rejects unsupported providers and unauthenticated starts', async () => {
    expect((await request(app)
      .post('/auth/mobile/oauth/link/start')
      .send({ provider: 'google' })).status).toBe(401);

    await registerUser();
    const login = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-native-link`
    });
    const unsupported = await request(app)
      .post('/auth/mobile/oauth/link/start')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ provider: 'twitter' });
    expect(unsupported.status).toBe(400);
  });

  test('native Facebook linking returns to the app and exchanges the canonical result', async () => {
    await registerUser();
    const login = await request(app).post('/auth/mobile/login').send({
      username: validEmail,
      password: validPassphrase,
      device_id: `${validDeviceId}-native-facebook`
    });
    const start = await request(app)
      .post('/auth/mobile/oauth/link/start')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ provider: 'facebook' });
    const state = new URL(start.body.authorizationUrl).searchParams.get('state');
    const callback = await request(app)
      .get('/auth/facebook/callback')
      .query({ code: 'native-facebook-code', state });
    const resultCode = new URL(callback.headers.location).searchParams.get('oauth_code');
    const exchange = await request(app)
      .post('/auth/mobile/oauth/link/exchange')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ code: resultCode });

    expect(exchange.status).toBe(200);
    expect(exchange.body).toEqual({ provider: 'facebook', status: 'linked' });
    expect((await User.findOne({ username: validLoginId }).lean()).identities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'facebook', subject: 'facebook-subject-789' })
      ])
    );
  });

  for (const provider of ['google', 'discord', 'facebook']) {
    test(`native ${provider} OAuth registration creates a bearer mobile session`, async () => {
      const deviceId = `${validDeviceId}-${provider}-register`;
      const start = await request(app).post('/auth/mobile/oauth/start').send({
        provider,
        intent: 'register',
        device_id: deviceId
      });
      expect(start.status).toBe(201);
      expect(start.headers['set-cookie']).toBeUndefined();
      const state = new URL(start.body.authorizationUrl).searchParams.get('state');
      const callback = await request(app)
        .get(`/auth/${provider}/callback`)
        .query({ code: `${provider}-native-register`, state });
      const code = new URL(callback.headers.location).searchParams.get('oauth_code');

      const exchange = await request(app).post('/auth/mobile/oauth/exchange').send({
        code,
        device_id: deviceId
      });
      expect(exchange.status).toBe(200);
      expect(exchange.body).toMatchObject({
        provider,
        status: 'registration-required',
        email: `${provider}.user@example.com`
      });

      const completed = await request(app)
        .post('/auth/mobile/oauth/complete-registration')
        .send({
          code,
          device_id: deviceId,
          username: `native_${provider}`,
          pokemonGoName: `pogo_${provider}`
        });
      expect(completed.status).toBe(201);
      expect(completed.headers['set-cookie']).toBeUndefined();
      expect(completed.headers['cache-control']).toContain('no-store');
      expect(completed.body).toMatchObject({
        provider,
        status: 'authenticated',
        session: {
          user: { username: `native_${provider}` },
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
      const user = await User.findOne({ username: `native_${provider}` }).lean();
      expect(user.identities).toEqual(expect.arrayContaining([
        expect.objectContaining({ provider })
      ]));

      const replay = await request(app)
        .post('/auth/mobile/oauth/complete-registration')
        .send({ code, device_id: deviceId, username: `again_${provider}` });
      expect(replay.status).toBe(409);
    });
  }

  test('native OAuth login links a verified matching email and returns a bearer session', async () => {
    await registerUser({ email: 'google.user@example.com' });
    const deviceId = `${validDeviceId}-google-login`;
    const start = await request(app).post('/auth/mobile/oauth/start').send({
      provider: 'google',
      intent: 'login',
      device_id: deviceId
    });
    const state = new URL(start.body.authorizationUrl).searchParams.get('state');
    const callback = await request(app).get('/auth/google/callback')
      .query({ code: 'native-google-login', state });
    const code = new URL(callback.headers.location).searchParams.get('oauth_code');
    const exchange = await request(app).post('/auth/mobile/oauth/exchange').send({
      code,
      device_id: deviceId
    });

    expect(exchange.status).toBe(200);
    expect(exchange.body).toMatchObject({
      provider: 'google',
      status: 'authenticated',
      session: {
        user: { username: validLoginId, email: 'google.user@example.com' },
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      }
    });
    expect((await User.findOne({ username: validLoginId }).lean()).identities).toEqual(
      expect.arrayContaining([expect.objectContaining({ provider: 'google' })])
    );
    expect((await request(app).post('/auth/mobile/oauth/exchange').send({
      code,
      device_id: deviceId
    })).status).toBe(409);
  });

  test('native OAuth preserves login versus registration intent and device binding', async () => {
    const loginDevice = `${validDeviceId}-unknown-login`;
    const loginStart = await request(app).post('/auth/mobile/oauth/start').send({
      provider: 'discord', intent: 'login', device_id: loginDevice
    });
    const loginState = new URL(loginStart.body.authorizationUrl).searchParams.get('state');
    const loginCallback = await request(app).get('/auth/discord/callback')
      .query({ code: 'unknown-login', state: loginState });
    const loginCode = new URL(loginCallback.headers.location).searchParams.get('oauth_code');
    const wrongDevice = await request(app).post('/auth/mobile/oauth/exchange').send({
      code: loginCode, device_id: `${loginDevice}-wrong`
    });
    expect(wrongDevice.status).toBe(409);
    const unknown = await request(app).post('/auth/mobile/oauth/exchange').send({
      code: loginCode, device_id: loginDevice
    });
    expect(unknown.body).toEqual({ provider: 'discord', status: 'account-not-found' });

    await registerUser({ email: 'facebook.user@example.com' });
    const registerDevice = `${validDeviceId}-existing-register`;
    const registerStart = await request(app).post('/auth/mobile/oauth/start').send({
      provider: 'facebook', intent: 'register', device_id: registerDevice
    });
    const registerState = new URL(registerStart.body.authorizationUrl).searchParams.get('state');
    const registerCallback = await request(app).get('/auth/facebook/callback')
      .query({ code: 'existing-register', state: registerState });
    const registerCode = new URL(registerCallback.headers.location).searchParams.get('oauth_code');
    const existing = await request(app).post('/auth/mobile/oauth/exchange').send({
      code: registerCode, device_id: registerDevice
    });
    expect(existing.body).toEqual({ provider: 'facebook', status: 'account-exists' });
    expect((await User.findOne({ username: validLoginId }).lean()).identities).toHaveLength(0);
  });

  test('native OAuth rejects malformed starts and registration conflicts without consuming retry state', async () => {
    expect((await request(app).post('/auth/mobile/oauth/start').send({
      provider: 'twitter', intent: 'login', device_id: validDeviceId
    })).status).toBe(400);
    expect((await request(app).post('/auth/mobile/oauth/start').send({
      provider: 'google', intent: 'link', device_id: validDeviceId
    })).status).toBe(400);

    const deviceId = `${validDeviceId}-retry-register`;
    const start = await request(app).post('/auth/mobile/oauth/start').send({
      provider: 'google', intent: 'register', device_id: deviceId
    });
    const state = new URL(start.body.authorizationUrl).searchParams.get('state');
    const callback = await request(app).get('/auth/google/callback')
      .query({ code: 'retry-register', state });
    const code = new URL(callback.headers.location).searchParams.get('oauth_code');
    await request(app).post('/auth/mobile/oauth/exchange').send({ code, device_id: deviceId });
    await registerUser({ username: 'taken_native' });
    const conflict = await request(app).post('/auth/mobile/oauth/complete-registration').send({
      code, device_id: deviceId, username: 'taken_native'
    });
    expect(conflict.status).toBe(409);
    const retried = await request(app).post('/auth/mobile/oauth/complete-registration').send({
      code, device_id: deviceId, username: 'retry_native'
    });
    expect(retried.status).toBe(201);
  });

  test('refresh succeeds with valid refresh token cookie', async () => {
    await registerUser();

    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });

    const cookies = login.headers['set-cookie'];
    const refreshed = await request(app)
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({});

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.username).toBe(validLoginId);
    expect(refreshed.headers['set-cookie']).toBeDefined();
    expect(refreshed.headers['set-cookie'].some((c) => c.startsWith('accessToken='))).toBe(true);

    const refreshUsingOldCookie = await request(app)
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({});
    expect(refreshUsingOldCookie.status).toBe(401);
  });

  test('logout revokes refresh token and blocks future refresh', async () => {
    await registerUser();

    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const logout = await request(app)
      .post('/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({});
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await request(app)
      .post('/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({});
    expect(refreshAfterLogout.status).toBe(401);
  });

  test('login fails with invalid password', async () => {
    await registerUser();

    const badLogin = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: 'invalid_passphrase_for_ci',
      device_id: validDeviceId
    });

    expect(badLogin.status).toBe(401);
    expect(badLogin.body.message).toBe('Invalid credentials');
  });

  test('update rejects unauthenticated request', async () => {
    await registerUser();
    const user = await User.findOne({ username: validLoginId }).lean();

    const update = await request(app).put(`/auth/update/${user._id}`).send({
      location: 'Pallet Town'
    });

    expect(update.status).toBe(401);
    expect(update.body.message).toBe('Authentication required');
  });

  test('update forbids modifying another user', async () => {
    await registerUser();
    const firstUser = await User.findOne({ username: validLoginId }).lean();

    const secondUsername = `${validLoginId}_other`;
    const secondEmail = `other_${Date.now().toString(36)}@example.invalid`;
    const secondPass = `${validPassphrase}_x`;
    const secondDevice = `${validDeviceId}_other`;

    await registerUser({
      username: secondUsername,
      email: secondEmail,
      password: secondPass,
      device_id: secondDevice
    });

    const secondUser = await User.findOne({ username: secondUsername }).lean();

    const login = await request(app).post('/auth/login').send({
      username: firstUser.username,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const update = await request(app)
      .put(`/auth/update/${secondUser._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({ location: 'Viridian City' });

    expect(update.status).toBe(403);
    expect(update.body.message).toBe('Forbidden');
  });

  test('delete forbids removing another user', async () => {
    await registerUser();
    const firstUser = await User.findOne({ username: validLoginId }).lean();

    const secondUsername = `${validLoginId}_target`;
    const secondEmail = `target_${Date.now().toString(36)}@example.invalid`;
    const secondPass = `${validPassphrase}_target`;
    const secondDevice = `${validDeviceId}_target`;

    await registerUser({
      username: secondUsername,
      email: secondEmail,
      password: secondPass,
      device_id: secondDevice
    });

    const secondUser = await User.findOne({ username: secondUsername }).lean();

    const login = await request(app).post('/auth/login').send({
      username: firstUser.username,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const deletion = await request(app)
      .delete(`/auth/delete/${secondUser._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send();

    expect(deletion.status).toBe(403);
    expect(deletion.body.message).toBe('Forbidden');
  });

  test('security summary exposes connected providers and active sessions', async () => {
    await registerUser();
    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });

    const response = await request(app)
      .get('/auth/account/security')
      .set('Cookie', login.headers['set-cookie']);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      email: validEmail,
      hasPassword: true,
      providers: []
    });
    expect(response.body.activeSessions).toBeGreaterThanOrEqual(1);
  });

  test('password changes require the current password', async () => {
    await registerUser();
    const user = await User.findOne({ username: validLoginId }).lean();
    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const rejected = await request(app)
      .put(`/auth/update/${user._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({ password: 'Different_valid_42!' });
    expect(rejected.status).toBe(401);

    const accepted = await request(app)
      .put(`/auth/update/${user._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({
        password: 'Different_valid_42!',
        currentPassword: validPassphrase
      });
    expect(accepted.status).toBe(200);
    expect(accepted.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringMatching(/^accessToken=;/),
      expect.stringMatching(/^refreshToken=;/)
    ]));
    expect((await User.findById(user._id)).refreshToken).toHaveLength(0);
  });

  test('email changes require proof and a one-time verification link', async () => {
    await registerUser();
    const user = await User.findOne({ username: validLoginId }).lean();
    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];
    const newEmail = `verified_${Date.now().toString(36)}@example.invalid`;

    expect((await request(app)
      .post('/auth/email-change')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({ email: newEmail })).status).toBe(401);

    const requested = await request(app)
      .post('/auth/email-change')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({ email: newEmail, currentPassword: validPassphrase });
    expect(requested.status).toBe(202);

    const pending = await User.findById(user._id).lean();
    expect(pending.email).toBe(validEmail);
    expect(pending.pendingEmail).toBe(newEmail);

    const rawToken = 'a'.repeat(64);
    await User.updateOne({ _id: user._id }, {
      $set: {
        emailChangeToken: crypto.createHash('sha256').update(rawToken).digest('hex')
      }
    });
    const confirmed = await request(app)
      .post('/auth/email-change/confirm')
      .send({ token: rawToken });
    expect(confirmed.status).toBe(200);
    expect((await User.findById(user._id)).email).toBe(newEmail);
    expect(sendEmailChangedNotice).toHaveBeenCalledWith({
      email: validEmail,
      username: validLoginId,
      newEmail
    });

    const reused = await request(app)
      .post('/auth/email-change/confirm')
      .send({ token: rawToken });
    expect(reused.status).toBe(400);
  });

  test('an authenticated user can explicitly connect and disconnect an OAuth provider', async () => {
    await registerUser();
    const user = await User.findOne({ username: validLoginId }).lean();
    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const start = await request(app)
      .get('/auth/google')
      .set('Cookie', cookies)
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'link'
      });
    expect(start.status).toBe(302);
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app)
      .get('/auth/google/callback')
      .set('Cookie', [...cookies, stateCookie])
      .query({ code: 'google-code', state });
    expect(callback.headers.location).toBe(
      'http://localhost:3000/settings/account?oauth=linked'
    );
    expect((await User.findById(user._id)).identities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'google', subject: 'google-subject-123' })
      ])
    );

    const disconnected = await request(app)
      .delete('/auth/account/identities/google')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({ currentPassword: validPassphrase });
    expect(disconnected.status).toBe(200);
    expect((await User.findById(user._id)).identities).toHaveLength(0);
  });

  test('deletion and all-session revocation require recent authentication proof', async () => {
    await registerUser();
    const user = await User.findOne({ username: validLoginId }).lean();
    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const rejected = await request(app)
      .post('/auth/sessions/revoke-all')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({});
    expect(rejected.status).toBe(401);

    const revoked = await request(app)
      .post('/auth/sessions/revoke-all')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .send({ currentPassword: validPassphrase });
    expect(revoked.status).toBe(200);
    expect((await User.findById(user._id)).refreshToken).toHaveLength(0);

    const relogin = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const deletion = await request(app)
      .delete(`/auth/delete/${user._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', relogin.headers['set-cookie'])
      .send({ currentPassword: validPassphrase });
    expect(deletion.status).toBe(200);
  });

  test('csrf origin guard blocks mutating auth-cookie request without origin', async () => {
    await registerUser();

    const login = await request(app).post('/auth/login').send({
      username: validLoginId,
      password: validPassphrase,
      device_id: validDeviceId
    });
    const cookies = login.headers['set-cookie'];

    const refreshNoOrigin = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookies)
      .send({});

    expect(refreshNoOrigin.status).toBe(403);
    expect(refreshNoOrigin.body.message).toBe('CSRF origin check failed');
  });

  test('password reset is one-time and revokes existing sessions', async () => {
    const registration = await registerUser();
    const requested = await request(app).post('/auth/reset-password').send({ identifier: validEmail });
    expect(requested.status).toBe(202);
    const user = await User.findOne({ email: validEmail });
    expect(user.resetPasswordToken).toMatch(/^[a-f0-9]{64}$/);
    const mailer = require('../services/passwordResetEmailService');
    const resetUrl = mailer.sendPasswordResetEmail.mock.calls.at(-1)[0].resetUrl;
    const token = new URL(resetUrl).searchParams.get('token');
    expect(user.resetPasswordToken).not.toBe(token);

    const newPassword = 'New_secure_password_42!';
    expect((await request(app).post('/auth/reset-password/confirm')
      .send({ token, password: newPassword })).status).toBe(200);
    expect((await request(app).post('/auth/reset-password/confirm')
      .send({ token, password: 'Another_secure_password_43!' })).status).toBe(400);
    expect((await request(app).post('/auth/refresh').set('Origin', 'http://localhost:3000')
      .set('Cookie', registration.headers['set-cookie']).send({})).status).toBe(401);
    expect((await request(app).post('/auth/login').send({
      username: validEmail, password: newPassword, device_id: `${validDeviceId}-reset`
    })).status).toBe(200);
  });

  test('password reset does not reveal whether an account exists', async () => {
    const response = await request(app).post('/auth/reset-password')
      .send({ identifier: 'missing@example.invalid' });
    expect(response.status).toBe(202);
    expect(response.body.message).toMatch(/If an account matches/);
  });

  test('a newer password reset request invalidates the previous link', async () => {
    await registerUser();
    const mailer = require('../services/passwordResetEmailService');
    await request(app).post('/auth/reset-password').send({ identifier: validEmail });
    const firstToken = new URL(mailer.sendPasswordResetEmail.mock.calls.at(-1)[0].resetUrl)
      .searchParams.get('token');
    await request(app).post('/auth/reset-password').send({ identifier: validEmail });
    const secondToken = new URL(mailer.sendPasswordResetEmail.mock.calls.at(-1)[0].resetUrl)
      .searchParams.get('token');

    expect(firstToken).not.toBe(secondToken);
    expect((await request(app).post('/auth/reset-password/confirm')
      .send({ token: firstToken, password: 'Valid_password_42!' })).status).toBe(400);
    expect((await request(app).post('/auth/reset-password/confirm')
      .send({ token: secondToken, password: 'Valid_password_42!' })).status).toBe(200);
  });

  test('expired password reset links are rejected', async () => {
    await registerUser();
    const mailer = require('../services/passwordResetEmailService');
    await request(app).post('/auth/reset-password').send({ identifier: validEmail });
    const token = new URL(mailer.sendPasswordResetEmail.mock.calls.at(-1)[0].resetUrl)
      .searchParams.get('token');
    await User.updateOne({ email: validEmail }, {
      $set: { resetPasswordExpires: new Date(Date.now() - 1000) }
    });

    const response = await request(app).post('/auth/reset-password/confirm')
      .send({ token, password: 'Valid_password_42!' });
    expect(response.status).toBe(400);
  });

  test.each([
    ['malformed token', { token: 'not-a-token', password: 'Valid_password_42!' }],
    ['short password', { token: 'a'.repeat(64), password: 'Short1!' }],
    ['password without uppercase', { token: 'a'.repeat(64), password: 'lowercase_42!' }],
    ['password without number', { token: 'a'.repeat(64), password: 'No_number_here!' }],
    ['password without symbol', { token: 'a'.repeat(64), password: 'NoSymbolHere42' }]
  ])('password reset rejects %s', async (_name, payload) => {
    expect((await request(app).post('/auth/reset-password/confirm').send(payload)).status).toBe(400);
  });

  test('metrics endpoint exposes Prometheus metrics', async () => {
    await registerUser();

    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });

  test('Google OAuth starts with a state cookie and authorization redirect', async () => {
    const res = await request(app)
      .get('/auth/google')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000'
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://accounts.google.test/authorize');
    expect(res.headers['set-cookie'].some((cookie) => cookie.startsWith('googleOAuthState='))).toBe(true);
    expect(res.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('googleOAuthState='))).toContain('Path=/');
  });

  test('Google OAuth creates a pending registration and completes it without a password', async () => {
    const start = await request(app)
      .get('/auth/google')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register'
      });
    const stateCookie = start.headers['set-cookie'].find((cookie) => cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/google/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'google-code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/register?oauth=google');
    const pendingCookie = callback.headers['set-cookie'].find((cookie) => cookie.startsWith('googleOAuthPending='));
    expect(pendingCookie).toBeDefined();

    const pending = await request(app)
      .get('/auth/google/pending')
      .set('Cookie', pendingCookie);
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({
      provider: 'google',
      email: 'google.user@example.com',
      emailVerified: true
    });

    const completed = await request(app)
      .post('/auth/google/complete-registration')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', pendingCookie)
      .send({ username: 'google_user' });

    expect(completed.status).toBe(201);
    expect(completed.headers['set-cookie'].some((cookie) => cookie.startsWith('accessToken='))).toBe(true);
    const user = await User.findOne({ username: 'google_user' }).lean();
    expect(user.password).toBeFalsy();
    expect(user.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'google', subject: 'google-subject-123' })
    ]));
  });

  test('Google OAuth logs in an existing linked identity', async () => {
    await User.create({
      username: validLoginId,
      email: 'google.user@example.com',
      identities: [{
        provider: 'google',
        subject: 'google-subject-123',
        email: 'google.user@example.com',
        emailVerified: true
      }]
    });
    const start = await request(app)
      .get('/auth/google')
      .query({ device_id: validDeviceId, return_to: 'http://localhost:3000' });
    const stateCookie = start.headers['set-cookie'].find((cookie) => cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/google/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'google-code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=success');
    expect(callback.headers['set-cookie'].some((cookie) => cookie.startsWith('refreshToken='))).toBe(true);
  });

  test('Google registration rejects an already-linked identity without logging it in', async () => {
    await User.create({
      username: validLoginId,
      email: 'google.user@example.com',
      identities: [{
        provider: 'google',
        subject: 'google-subject-123',
        email: 'google.user@example.com',
        emailVerified: true
      }]
    });
    const start = await request(app).get('/auth/google').query({
      device_id: validDeviceId,
      return_to: 'http://localhost:3000',
      intent: 'register'
    });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app).get('/auth/google/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'google-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=account-exists');
    expect(callback.headers['set-cookie']?.some((cookie) =>
      cookie.startsWith('refreshToken='))).not.toBe(true);
  });

  test('Google login directs an unknown account to registration without creating pending state', async () => {
    const start = await request(app).get('/auth/google').query({
      device_id: validDeviceId,
      return_to: 'http://localhost:3000',
      intent: 'login'
    });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app).get('/auth/google/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'google-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/register?oauth=account-not-found');
    expect(callback.headers['set-cookie']?.some((cookie) =>
      cookie.startsWith('googleOAuthPending='))).not.toBe(true);
  });

  test('Google OAuth links a verified matching email to the existing password account', async () => {
    await registerUser({ email: 'google.user@example.com' });
    const existingUser = await User.findOne({ email: 'google.user@example.com' }).lean();
    const start = await request(app)
      .get('/auth/google')
      .query({ device_id: validDeviceId, return_to: 'http://localhost:3000' });
    const stateCookie = start.headers['set-cookie'].find((cookie) => cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/google/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'google-code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=success');
    expect(callback.headers['set-cookie'].some((cookie) => cookie.startsWith('refreshToken='))).toBe(true);

    const linkedUser = await User.findOne({ email: 'google.user@example.com' }).lean();
    expect(linkedUser._id.toString()).toBe(existingUser._id.toString());
    expect(linkedUser.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'google',
        subject: 'google-subject-123',
        email: 'google.user@example.com',
        emailVerified: true
      })
    ]));

    const passwordLogin = await request(app).post('/auth/login').send({
      username: 'google.user@example.com',
      password: validPassphrase,
      device_id: `${validDeviceId}-password`
    });
    expect(passwordLogin.status).toBe(200);
  });

  test('Google registration rejects a verified email that already has an account', async () => {
    await registerUser({ email: 'google.user@example.com' });
    const start = await request(app)
      .get('/auth/google')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register'
      });
    const stateCookie = start.headers['set-cookie'].find((cookie) => cookie.startsWith('googleOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/google/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'google-code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=account-exists');
    expect(callback.headers['set-cookie']?.some((cookie) => cookie.startsWith('refreshToken='))).not.toBe(true);

    const existingUser = await User.findOne({ email: 'google.user@example.com' }).lean();
    expect(existingUser.identities).toHaveLength(0);
    expect(await User.countDocuments({ email: 'google.user@example.com' })).toBe(1);
  });

  test('Discord OAuth creates and completes a pending registration', async () => {
    const start = await request(app)
      .get('/auth/discord')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register'
      });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('discordOAuthState='));
    expect(stateCookie).toContain('Path=/');
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/discord/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'discord-code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('http://localhost:3000/register?oauth=discord');
    const pendingCookie = callback.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('discordOAuthPending='));

    const pending = await request(app)
      .get('/auth/discord/pending')
      .set('Cookie', pendingCookie);
    expect(pending.body).toEqual({
      provider: 'discord',
      email: 'discord.user@example.com',
      emailVerified: true
    });

    const completed = await request(app)
      .post('/auth/discord/complete-registration')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', pendingCookie)
      .send({ username: 'discord_user' });
    expect(completed.status).toBe(201);
    const user = await User.findOne({ username: 'discord_user' }).lean();
    expect(user.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'discord',
        subject: 'discord-subject-456'
      })
    ]));
  });

  test('Discord login unifies a verified matching email account', async () => {
    await registerUser({ email: 'discord.user@example.com' });
    const existing = await User.findOne({ email: 'discord.user@example.com' }).lean();
    const start = await request(app)
      .get('/auth/discord')
      .query({ device_id: validDeviceId, return_to: 'http://localhost:3000' });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('discordOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/discord/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'discord-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=success');
    const linked = await User.findOne({ email: 'discord.user@example.com' }).lean();
    expect(linked._id.toString()).toBe(existing._id.toString());
    expect(linked.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'discord',
        subject: 'discord-subject-456'
      })
    ]));
  });

  test('Discord registration rejects an email that already has an account', async () => {
    await registerUser({ email: 'discord.user@example.com' });
    const start = await request(app)
      .get('/auth/discord')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register'
      });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('discordOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get('/auth/discord/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'discord-code', state });

    expect(callback.headers.location).toBe(
      'http://localhost:3000/login?oauth=account-exists'
    );
    const existing = await User.findOne({ email: 'discord.user@example.com' }).lean();
    expect(existing.identities).toHaveLength(0);
  });

  test('Discord registration rejects an already-linked identity without logging it in', async () => {
    await User.create({
      username: validLoginId,
      email: 'discord.user@example.com',
      identities: [{
        provider: 'discord',
        subject: 'discord-subject-456',
        email: 'discord.user@example.com',
        emailVerified: true
      }]
    });
    const start = await request(app).get('/auth/discord').query({
      device_id: validDeviceId,
      return_to: 'http://localhost:3000',
      intent: 'register'
    });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('discordOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app).get('/auth/discord/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'discord-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=account-exists');
    expect(callback.headers['set-cookie']?.some((cookie) =>
      cookie.startsWith('refreshToken='))).not.toBe(true);
  });

  test('Discord login directs an unknown account to registration', async () => {
    const start = await request(app).get('/auth/discord').query({
      device_id: validDeviceId,
      return_to: 'http://localhost:3000',
      intent: 'login'
    });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('discordOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app).get('/auth/discord/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'discord-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/register?oauth=account-not-found');
  });

  test('Facebook OAuth creates and completes a pending registration', async () => {
    const start = await request(app)
      .get('/auth/facebook')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register'
      });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('facebookOAuthState='));
    expect(stateCookie).toContain('Path=/');
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app)
      .get('/auth/facebook/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'facebook-code', state });

    expect(callback.headers.location).toBe(
      'http://localhost:3000/register?oauth=facebook'
    );
    const pendingCookie = callback.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('facebookOAuthPending='));
    const completed = await request(app)
      .post('/auth/facebook/complete-registration')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', pendingCookie)
      .send({ username: 'facebook_user' });

    expect(completed.status).toBe(201);
    const user = await User.findOne({ username: 'facebook_user' }).lean();
    expect(user.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'facebook',
        subject: 'facebook-subject-789'
      })
    ]));
  });

  test('Facebook OAuth can return a direct authorization URL for standalone PWAs', async () => {
    const start = await request(app)
      .get('/auth/facebook')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register',
        response_mode: 'json'
      });

    expect(start.status).toBe(200);
    expect(start.body.authorizationUrl).toMatch(/^https:\/\/facebook\.test\/dialog\/oauth\?/);
    expect(new URL(start.body.authorizationUrl).searchParams.get('state')).toBeTruthy();
    expect(start.headers['set-cookie'].some((cookie) =>
      cookie.startsWith('facebookOAuthState='))).toBe(true);
  });

  test('Facebook login unifies a matching email account', async () => {
    await registerUser({ email: 'facebook.user@example.com' });
    const existing = await User.findOne({ email: 'facebook.user@example.com' }).lean();
    const start = await request(app)
      .get('/auth/facebook')
      .query({ device_id: validDeviceId, return_to: 'http://localhost:3000' });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('facebookOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app)
      .get('/auth/facebook/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'facebook-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=success');
    const linked = await User.findOne({ email: 'facebook.user@example.com' }).lean();
    expect(linked._id.toString()).toBe(existing._id.toString());
    expect(linked.identities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'facebook',
        subject: 'facebook-subject-789'
      })
    ]));
  });

  test('Facebook registration rejects an email that already has an account', async () => {
    await User.create({
      username: validLoginId,
      email: 'facebook.user@example.com',
      password: 'existing-password-hash'
    });
    const start = await request(app)
      .get('/auth/facebook')
      .query({
        device_id: validDeviceId,
        return_to: 'http://localhost:3000',
        intent: 'register'
      });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('facebookOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app)
      .get('/auth/facebook/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'facebook-code', state });

    expect(callback.headers.location).toBe(
      'http://localhost:3000/login?oauth=account-exists'
    );
    const existing = await User.findOne({ email: 'facebook.user@example.com' }).lean();
    expect(existing.identities).toHaveLength(0);
  });

  test('Facebook registration rejects an already-linked identity without logging it in', async () => {
    await User.create({
      username: validLoginId,
      email: 'facebook.user@example.com',
      identities: [{
        provider: 'facebook',
        subject: 'facebook-subject-789',
        email: 'facebook.user@example.com',
        emailVerified: true
      }]
    });
    const start = await request(app).get('/auth/facebook').query({
      device_id: validDeviceId,
      return_to: 'http://localhost:3000',
      intent: 'register'
    });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('facebookOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app).get('/auth/facebook/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'facebook-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/login?oauth=account-exists');
    expect(callback.headers['set-cookie']?.some((cookie) =>
      cookie.startsWith('refreshToken='))).not.toBe(true);
  });

  test('Facebook login directs an unknown account to registration', async () => {
    const start = await request(app).get('/auth/facebook').query({
      device_id: validDeviceId,
      return_to: 'http://localhost:3000',
      intent: 'login'
    });
    const stateCookie = start.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('facebookOAuthState='));
    const state = new URL(start.headers.location).searchParams.get('state');
    const callback = await request(app).get('/auth/facebook/callback')
      .set('Cookie', stateCookie)
      .query({ code: 'facebook-code', state });

    expect(callback.headers.location).toBe('http://localhost:3000/register?oauth=account-not-found');
  });

  for (const provider of ['google', 'discord', 'facebook']) {
    test(`${provider} OAuth registration can immediately delete its own account`, async () => {
      const start = await request(app)
        .get(`/auth/${provider}`)
        .query({
          device_id: validDeviceId,
          return_to: 'http://localhost:3000',
          intent: 'register'
        });
      const stateCookie = start.headers['set-cookie'].find((cookie) =>
        cookie.startsWith(`${provider}OAuthState=`));
      const state = new URL(start.headers.location).searchParams.get('state');
      const callback = await request(app)
        .get(`/auth/${provider}/callback`)
        .set('Cookie', stateCookie)
        .query({ code: `${provider}-code`, state });
      const pendingCookie = callback.headers['set-cookie'].find((cookie) =>
        cookie.startsWith(`${provider}OAuthPending=`));

      const completed = await request(app)
        .post(`/auth/${provider}/complete-registration`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', pendingCookie)
        .send({ username: `delete_${provider}` });

      expect(completed.status).toBe(201);
      const user = await User.findOne({ username: `delete_${provider}` }).lean();
      expect(user).toBeTruthy();

      const deletion = await request(app)
        .delete(`/auth/delete/${user._id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', completed.headers['set-cookie']);

      expect(deletion.status).toBe(200);
      expect(await User.findById(user._id)).toBeNull();

      const refresh = await request(app)
        .post('/auth/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', completed.headers['set-cookie'])
        .send({});
      expect(refresh.status).toBe(401);
    });
  }
});
