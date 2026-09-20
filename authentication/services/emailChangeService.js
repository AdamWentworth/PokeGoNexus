const { buildPasswordResetEmail } = require('./passwordResetEmailService');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[char]);

const buildEmailChangeEmail = ({ username, verifyUrl, newEmail }) => {
  const base = buildPasswordResetEmail({ username, resetUrl: verifyUrl });
  const safeEmail = escapeHtml(newEmail);
  return {
    subject: 'Confirm your new Pokémon Go Nexus email',
    text: `Hi ${username},

Confirm ${newEmail} as the new email for your Pokémon Go Nexus account:

${verifyUrl}

This secure link expires in 30 minutes and can only be used once. If you did not request this change, ignore this email and your account email will remain unchanged.`,
    html: base.html
      .replaceAll(
        'Your secure Pokémon Go Nexus password reset link expires in 30 minutes.',
        'Confirm your new Pokémon Go Nexus email within 30 minutes.',
      )
      .replaceAll('Reset your password', 'Confirm your new email')
      .replaceAll('reset the password for', 'change the email address for')
      .replaceAll('choose a new password', `confirm ${safeEmail} as your new sign-in email`)
      .replaceAll('Reset my password', 'Confirm new email')
      .replaceAll('password reset link', 'email verification link')
      .replaceAll('Your password has not changed.', 'Your account email has not changed.'),
  };
};

const buildEmailChangedNotice = ({ username, oldEmail, newEmail }) => {
  const safeName = escapeHtml(username);
  const safeOldEmail = escapeHtml(oldEmail);
  const safeNewEmail = escapeHtml(newEmail);
  return {
    subject: 'Your Pokémon Go Nexus email was changed',
    text: `Hi ${username},

The sign-in email for your Pokémon Go Nexus account was changed from ${oldEmail} to ${newEmail}.

If you made this change, no action is needed. If you did not make it, contact accounts@pokegonexus.com immediately and reset your password.

— The Pokémon Go Nexus team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#172033">
<div style="display:none;max-height:0;overflow:hidden">Security notice: your Pokémon Go Nexus sign-in email was changed.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #dce3ec;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(23,32,51,.12)">
<tr><td style="padding:26px 32px;background:linear-gradient(135deg,#5b39c9,#315ec9);color:#fff">
<div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Pokémon Go Nexus</div>
<div style="font-size:26px;font-weight:800;margin-top:8px">Your email was changed</div></td></tr>
<tr><td style="padding:32px">
<p style="font-size:17px;margin:0 0 18px">Hi ${safeName},</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 20px;color:#44506a">The sign-in email for your Pokémon Go Nexus account was changed.</p>
<div style="background:#f5f7fb;border-left:4px solid #5b39c9;padding:14px 16px;border-radius:8px;color:#44506a;font-size:14px;line-height:1.7">
<strong>Previous email:</strong> ${safeOldEmail}<br><strong>New email:</strong> ${safeNewEmail}
</div>
<p style="font-size:14px;line-height:1.65;color:#667085;margin:24px 0 0">If you made this change, no action is needed. If you did not, contact <a href="mailto:accounts@pokegonexus.com" style="color:#315ec9">accounts@pokegonexus.com</a> immediately and reset your password.</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#f8fafc;color:#778197;font-size:12px;text-align:center">Pokémon Go Nexus account security · <a href="mailto:accounts@pokegonexus.com" style="color:#315ec9">accounts@pokegonexus.com</a></td></tr>
</table></td></tr></table></body></html>`
  };
};

const sendEmail = async ({ email, content, failureLabel }) => {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.PASSWORD_RESET_FROM ||
        'Pokémon Go Nexus Accounts <accounts@mail.pokegonexus.com>',
      reply_to: process.env.PASSWORD_RESET_REPLY_TO || 'accounts@pokegonexus.com',
      to: [email],
      ...content,
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected ${failureLabel} (${response.status})`);
};

const sendEmailChangeVerification = async ({ email, username, verifyUrl }) => {
  const content = buildEmailChangeEmail({
    username,
    verifyUrl,
    newEmail: email,
  });
  await sendEmail({
    email,
    content,
    failureLabel: 'email verification',
  });
};

const sendEmailChangedNotice = async ({ email, username, newEmail }) => {
  await sendEmail({
    email,
    content: buildEmailChangedNotice({ username, oldEmail: email, newEmail }),
    failureLabel: 'email change notice',
  });
};

module.exports = {
  buildEmailChangeEmail,
  buildEmailChangedNotice,
  sendEmailChangeVerification,
  sendEmailChangedNotice,
};
