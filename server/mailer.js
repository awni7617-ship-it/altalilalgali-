import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';
import { config } from './config.js';

/* ==================================================================
 * A dependency-free SMTP client.
 *
 * Supports implicit TLS (port 465) and STARTTLS (port 587), with
 * AUTH LOGIN / AUTH PLAIN. That covers Gmail, iCloud, Zoho, Outlook,
 * Mailgun, SendGrid and every other mainstream provider.
 * ================================================================== */

class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.buffer = '';
    this.pending = null;
    this.closed = false;

    socket.setEncoding('utf8');
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('error', (err) => this._fail(err));
    socket.on('close', () => {
      this.closed = true;
      this._fail(new Error('The mail server closed the connection.'));
    });
  }

  _fail(err) {
    if (this.pending) {
      const { reject, timer } = this.pending;
      clearTimeout(timer);
      this.pending = null;
      reject(err);
    }
  }

  _onData(chunk) {
    this.buffer += chunk;
    if (!this.pending) return;
    /* An SMTP reply ends with a line "NNN <text>"; continuation lines
     * use "NNN-<text>". Wait until we see the final form. */
    const lines = this.buffer.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (/^\d{3} /.test(line)) {
        const raw = lines.slice(0, i + 1).join('\n');
        this.buffer = lines.slice(i + 1).join('\n');
        const { resolve, timer } = this.pending;
        clearTimeout(timer);
        this.pending = null;
        resolve({ code: Number.parseInt(line.slice(0, 3), 10), text: raw });
        return;
      }
    }
  }

  read(timeoutMs = 20_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this._fail(new Error('Timed out waiting for the mail server.')),
        timeoutMs,
      );
      this.pending = { resolve, reject, timer };
      /* Data may already be buffered from a previous read. */
      this._onData('');
    });
  }

  async send(command, { expect = [250], secret = false, timeoutMs = 20_000 } = {}) {
    if (command !== null) this.socket.write(command + '\r\n');
    const reply = await this.read(timeoutMs);
    if (!expect.includes(reply.code)) {
      const shown = secret ? '<hidden>' : command;
      throw new Error(
        `SMTP command rejected (${reply.code}): ${reply.text.split('\n')[0]}` +
          (shown ? ` — while sending: ${String(shown).slice(0, 60)}` : ''),
      );
    }
    return reply;
  }

  upgrade(host) {
    return new Promise((resolve, reject) => {
      this.socket.removeAllListeners('data');
      this.socket.removeAllListeners('error');
      this.socket.removeAllListeners('close');
      const secure = tls.connect({ socket: this.socket, servername: host }, () => {
        resolve(new SmtpSession(secure));
      });
      secure.once('error', reject);
    });
  }

  close() {
    try {
      this.socket.end();
    } catch { /* already gone */ }
  }
}

function connectSocket({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(20_000, () => {
      socket.destroy(new Error('Timed out connecting to the mail server.'));
    });
    socket.once('error', reject);
  });
}

async function sendViaSmtp({ to, subject, html, text }) {
  const { host, port, user, pass, secure } = config.mail.smtp;
  if (!host) throw new Error('SMTP_HOST is not set.');

  const socket = await connectSocket({ host, port, secure });
  let session = new SmtpSession(socket);
  const clientName = 'altalil-shop';

  try {
    await session.send(null, { expect: [220] });
    await session.send(`EHLO ${clientName}`);

    if (!secure) {
      await session.send('STARTTLS', { expect: [220] });
      session = await session.upgrade(host);
      await session.send(`EHLO ${clientName}`);
    }

    if (user) {
      /* AUTH LOGIN is the most widely supported form. */
      await session.send('AUTH LOGIN', { expect: [334] });
      await session.send(Buffer.from(user, 'utf8').toString('base64'), { expect: [334] });
      await session.send(Buffer.from(pass, 'utf8').toString('base64'), {
        expect: [235],
        secret: true,
      });
    }

    await session.send(`MAIL FROM:<${config.mail.from}>`);
    await session.send(`RCPT TO:<${to}>`, { expect: [250, 251] });
    await session.send('DATA', { expect: [354] });

    const message = buildMimeMessage({ to, subject, html, text });
    /* Dot-stuffing: a line that is just "." would end the message. */
    session.socket.write(message.replace(/\r\n\./g, '\r\n..'));
    await session.send('\r\n.', { expect: [250] });
    await session.send('QUIT', { expect: [221] }).catch(() => {});
  } finally {
    session.close();
  }
}

/* ------------------------------------------------------------------ *
 * MIME assembly
 * ------------------------------------------------------------------ */
function encodeHeader(value) {
  /* RFC 2047 for anything outside plain ASCII (Arabic shop names). */
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function buildMimeMessage({ to, subject, html, text }) {
  const boundary = `_b_${randomBytes(16).toString('hex')}`;
  const fromHeader = `${encodeHeader(config.mail.fromName)} <${config.mail.from}>`;
  const messageId = `<${randomBytes(12).toString('hex')}@${config.mail.from.split('@')[1] || 'localhost'}>`;
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');

  return [
    `From: ${fromHeader}`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/* ------------------------------------------------------------------ *
 * HTTP providers — no SMTP ports needed, easiest to set up.
 * ------------------------------------------------------------------ */
async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch(config.mail.resendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mail.resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${config.mail.fromName} <${config.mail.from}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend refused the message (${res.status}): ${await res.text()}`);
}

async function sendViaBrevo({ to, subject, html, text }) {
  const res = await fetch(config.mail.brevoUrl, {
    method: 'POST',
    headers: { 'api-key': config.mail.brevoKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: config.mail.fromName, email: config.mail.from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo refused the message (${res.status}): ${await res.text()}`);
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */
export async function sendMail({ to, subject, html, text }) {
  const provider = config.mail.provider;

  if (provider === 'console' || (provider === 'smtp' && !config.mail.smtp.host)) {
    console.log(
      `\n${'='.repeat(62)}\n  E-MAIL (not actually sent — MAIL_PROVIDER=${provider})\n` +
        `  To      : ${to}\n  Subject : ${subject}\n${'-'.repeat(62)}\n` +
        `${text}\n${'='.repeat(62)}\n`,
    );
    return { delivered: false, provider: 'console' };
  }

  if (provider === 'resend') {
    await sendViaResend({ to, subject, html, text });
    return { delivered: true, provider };
  }
  if (provider === 'brevo') {
    await sendViaBrevo({ to, subject, html, text });
    return { delivered: true, provider };
  }
  await sendViaSmtp({ to, subject, html, text });
  return { delivered: true, provider: 'smtp' };
}

/* ------------------------------------------------------------------ *
 * The login-code e-mail.
 * ------------------------------------------------------------------ */
export function loginCodeEmail({ code, shopName, minutes, isAdmin }) {
  const spaced = code.split('').join(' ');
  const text = [
    `${shopName}`,
    '',
    `رمز الدخول الخاص بك هو: ${code}`,
    `Your sign-in code is: ${code}`,
    '',
    `هذا الرمز صالح لمدة ${minutes} دقائق. / This code expires in ${minutes} minutes.`,
    '',
    'إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.',
    'If you did not request this code, you can safely ignore this e-mail.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f6f1ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(90,40,60,.10);">
    <tr><td style="background:linear-gradient(135deg,#7d2b48,#b8546f);padding:28px 24px;text-align:center;">
      <div style="color:#fff;font-size:21px;font-weight:700;letter-spacing:.3px;">${escapeHtml(shopName)}</div>
      <div style="color:#f3d7de;font-size:13px;margin-top:6px;">رمز تسجيل الدخول · Sign-in code</div>
    </td></tr>
    <tr><td style="padding:30px 26px;text-align:center;">
      <p style="margin:0 0 6px;color:#4a3a40;font-size:15px;">استخدم هذا الرمز لتسجيل الدخول:</p>
      <p style="margin:0 0 20px;color:#8a7a80;font-size:13px;">Use this code to sign in:</p>
      <div style="display:inline-block;background:#fbf5f6;border:1px solid #eddde2;border-radius:14px;padding:16px 26px;">
        <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:33px;font-weight:700;color:#7d2b48;letter-spacing:9px;">${escapeHtml(spaced)}</span>
      </div>
      <p style="margin:20px 0 0;color:#8a7a80;font-size:13px;line-height:1.7;">
        صالح لمدة ${minutes} دقائق فقط.<br>Valid for ${minutes} minutes.
      </p>
      ${
        isAdmin
          ? `<p style="margin:18px 0 0;padding:11px 14px;background:#fdf4e6;border-radius:10px;color:#8a6220;font-size:13px;">
               👑 هذا حساب المدير — لديك صلاحية كاملة على المتجر.<br>
               <span style="font-size:12px;">This is the owner account — full store access.</span>
             </p>`
          : ''
      }
    </td></tr>
    <tr><td style="padding:0 26px 26px;">
      <div style="border-top:1px solid #f0e6e9;padding-top:16px;color:#a2949a;font-size:12px;line-height:1.7;text-align:center;">
        إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.<br>
        If you did not request this code, you can safely ignore this e-mail.
      </div>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
