const {
  buildPasswordResetEmail,
  sendPasswordResetEmail
} = require('../services/passwordResetEmailService');

describe('password reset email service', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RESEND_API_KEY = originalKey;
    delete process.env.PASSWORD_RESET_FROM;
    delete process.env.PASSWORD_RESET_REPLY_TO;
  });

  test('builds useful HTML and plain-text content without tracking redirects', () => {
    const resetUrl = 'https://pokegonexus.com/reset-password?token=abc123';
    const email = buildPasswordResetEmail({
      username: 'Trainer',
      resetUrl
    });

    expect(email.subject).toBe('Reset your Pokémon Go Nexus password');
    expect(email.html).toContain('Reset my password');
    expect(email.html).toContain('30 minutes');
    expect(email.html).toContain(resetUrl.replaceAll('&', '&amp;'));
    expect(email.text).toContain(resetUrl);
    expect(email.text).toContain('can only be used once');
    expect(email.html).not.toMatch(/click|track/i);
  });

  test('escapes user-controlled values in HTML', () => {
    const email = buildPasswordResetEmail({
      username: '<img src=x onerror=alert(1)>',
      resetUrl: 'https://pokegonexus.com/reset-password?token=a&next="bad"'
    });
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img');
    expect(email.html).toContain('&amp;next=&quot;bad&quot;');
  });

  test('sends the expected Resend payload with sender and reply-to', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    global.fetch = jest.fn(async () => ({ ok: true, status: 200 }));
    await sendPasswordResetEmail({
      email: 'trainer@example.com',
      username: 'Trainer',
      resetUrl: 'https://pokegonexus.com/reset-password?token=abc'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test_key' })
      })
    );
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      from: 'Pokémon Go Nexus Accounts <accounts@mail.pokegonexus.com>',
      reply_to: 'accounts@pokegonexus.com',
      to: ['trainer@example.com'],
      subject: 'Reset your Pokémon Go Nexus password'
    });
    expect(payload.html).toContain('Reset my password');
    expect(payload.text).toContain('Reset your password:');
  });

  test('fails closed when Resend rejects the request', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    global.fetch = jest.fn(async () => ({ ok: false, status: 403 }));
    await expect(sendPasswordResetEmail({
      email: 'trainer@example.com',
      username: 'Trainer',
      resetUrl: 'https://pokegonexus.com/reset-password?token=abc'
    })).rejects.toThrow('Resend rejected');
  });
});
