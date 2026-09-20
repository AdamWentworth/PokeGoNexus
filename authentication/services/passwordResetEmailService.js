const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[char]);

const buildPasswordResetEmail = ({ username, resetUrl }) => {
  const safeName = escapeHtml(username);
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: 'Reset your Pokémon Go Nexus password',
    text: `Hi ${username},

We received a request to reset your Pokémon Go Nexus password.

Reset your password: ${resetUrl}

This link expires in 30 minutes and can only be used once. If you did not request this, you can safely ignore this email. Your password has not changed.

— The Pokémon Go Nexus team`,
    html: `<!doctype html>
<html><body style="margin:0;background:#eef2f7;font-family:Arial,sans-serif;color:#172033">
<div style="display:none;max-height:0;overflow:hidden">Your secure Pokémon Go Nexus password reset link expires in 30 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #dce3ec;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(23,32,51,.12)">
<tr><td style="padding:26px 32px;background:linear-gradient(135deg,#5b39c9,#315ec9);color:#fff">
<div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Pokémon Go Nexus</div>
<div style="font-size:26px;font-weight:800;margin-top:8px">Reset your password</div></td></tr>
<tr><td style="padding:32px">
<p style="font-size:17px;margin:0 0 18px">Hi ${safeName},</p>
<p style="font-size:16px;line-height:1.65;margin:0 0 24px;color:#44506a">We received a request to reset the password for your Pokémon Go Nexus account. Use the secure button below to choose a new password.</p>
<div style="text-align:center;margin:30px 0"><a href="${safeUrl}" style="display:inline-block;background:#5b39c9;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 28px;border-radius:10px">Reset my password</a></div>
<div style="background:#f5f7fb;border-left:4px solid #5b39c9;padding:14px 16px;border-radius:8px;color:#44506a;font-size:14px;line-height:1.55">This link expires in <strong>30 minutes</strong> and can only be used once.</div>
<p style="font-size:13px;line-height:1.55;color:#667085;margin:24px 0 8px">If the button does not work, copy this address into your browser:</p>
<p style="font-size:12px;line-height:1.5;word-break:break-all;margin:0"><a href="${safeUrl}" style="color:#315ec9">${safeUrl}</a></p>
<hr style="border:0;border-top:1px solid #e4e8ef;margin:28px 0">
<p style="font-size:14px;line-height:1.6;color:#667085;margin:0">Didn’t request this? You can safely ignore this email. Your password has not changed.</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#f8fafc;color:#778197;font-size:12px;text-align:center">Pokémon Go Nexus account security · <a href="mailto:accounts@pokegonexus.com" style="color:#315ec9">accounts@pokegonexus.com</a></td></tr>
</table></td></tr></table></body></html>`
  };
};

const sendPasswordResetEmail = async ({ email, username, resetUrl }) => {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const content = buildPasswordResetEmail({ username, resetUrl });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.PASSWORD_RESET_FROM || 'Pokémon Go Nexus Accounts <accounts@mail.pokegonexus.com>',
      reply_to: process.env.PASSWORD_RESET_REPLY_TO || 'accounts@pokegonexus.com',
      to: [email],
      ...content
    })
  });
  if (!response.ok) throw new Error(`Resend rejected password reset email (${response.status})`);
};

module.exports = { buildPasswordResetEmail, sendPasswordResetEmail };
