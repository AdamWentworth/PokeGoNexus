jest.mock('../services/tokenService', () => ({
  verifyAccessToken: jest.fn()
}));

const tokenService = require('../services/tokenService');
const requireAuth = require('../middlewares/requireAuth');

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('requireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    {
      name: 'HTTP-only cookie',
      request: {
        cookies: { accessToken: 'cookie-token' },
        get: jest.fn()
      },
      expectedToken: 'cookie-token'
    },
    {
      name: 'bearer header',
      request: {
        cookies: {},
        get: jest.fn(() => 'bEaReR \t mobile-token ')
      },
      expectedToken: 'mobile-token'
    }
  ])('accepts a valid $name session', ({ request, expectedToken }) => {
    tokenService.verifyAccessToken.mockReturnValue({
      user_id: 'user-1',
      username: 'misty',
      device_id: 'device-1',
      iat: 123
    });
    const res = response();
    const next = jest.fn();

    requireAuth(request, res, next);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(expectedToken);
    expect(request.auth).toEqual({
      userId: 'user-1',
      username: 'misty',
      issuedAt: 123,
      deviceId: 'device-1'
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test.each([
    'Basic credentials',
    'Bearer-token',
    'Bearer',
    `Bearer ${' '.repeat(20_000)}`
  ])('rejects a missing or malformed bearer session', (authorization) => {
    const req = {
      cookies: {},
      get: jest.fn(() => authorization)
    };
    const res = response();

    requireAuth(req, res, jest.fn());

    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
  });
});
