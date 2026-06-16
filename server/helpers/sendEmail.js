import nodemailer from 'nodemailer';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

let cachedTransporter = null;
let cachedCredentialsKey = '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCredentials() {
  const fromEmail = process.env.CONTACT_EMAIL;
  const pass = process.env.CONTACT_EMAIL_PASS;
  if (!fromEmail || !pass) {
    throw new Error('Липсват CONTACT_EMAIL / CONTACT_EMAIL_PASS в .env');
  }
  return { fromEmail, pass };
}

function formatSender(fromEmail) {
  return `Happy Colors | Creative Studio <${fromEmail}>`;
}

function maskEmail(value) {
  const email = String(value || '').trim();
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email ? '[redacted-recipient]' : '';
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

function maskRecipients(value) {
  if (Array.isArray(value)) {
    return value.map(maskEmail);
  }

  return maskEmail(value);
}

function createTransporter(fromEmail, pass) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: fromEmail,
      pass,
    },
    connectionTimeout: DEFAULT_TIMEOUT_MS,
    greetingTimeout: DEFAULT_TIMEOUT_MS,
    socketTimeout: DEFAULT_TIMEOUT_MS,
  });
}

function getTransporter() {
  const { fromEmail, pass } = getCredentials();
  const credentialsKey = `${fromEmail}:${pass}`;
  if (!cachedTransporter || cachedCredentialsKey !== credentialsKey) {
    cachedTransporter = createTransporter(fromEmail, pass);
    cachedCredentialsKey = credentialsKey;
  }
  return {
    transporter: cachedTransporter,
    fromEmail,
  };
}

function isTransientEmailError(error) {
  const transientCodes = new Set([
    'ETIMEDOUT',
    'ECONNECTION',
    'ECONNRESET',
    'ESOCKET',
    'EAI_AGAIN',
    'EPROTOCOL',
  ]);
  return transientCodes.has(String(error?.code || '').trim());
}

async function sendWithRetry(mailOptions) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const { transporter } = getTransporter();
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      console.error('Email send attempt failed:', {
        attempt,
        to: maskRecipients(mailOptions.to),
        subject: mailOptions.subject,
        code: error?.code || 'UNKNOWN',
        message: error?.message || 'Unknown email error',
      });
      if (!isTransientEmailError(error) || attempt === MAX_RETRIES) {
        break;
      }
      cachedTransporter = null;
      cachedCredentialsKey = '';
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

function isEmailDeliveryDisabled() {
  return process.env.DISABLE_EMAIL_DELIVERY === 'true';
}

/**
 * sendEmail({ to?, subject, text, html, headers })
 * - Ако "to" липсва -> праща към CONTACT_EMAIL (admin)
 * - Ако "to" е подаден -> праща към него
 */
export async function sendEmail({ to, subject, text, html, headers }) {
  if (isEmailDeliveryDisabled()) {
    return {
      messageId: 'email-delivery-disabled',
      skipped: true,
      to: to || 'admin',
      subject,
    };
  }

  const { fromEmail } = getTransporter();
  const mailOptions = {
    from: formatSender(fromEmail),
    to: to || fromEmail,
    subject,
    ...(text !== undefined ? { text } : {}),
    ...(html !== undefined ? { html } : {}),
    ...(headers ? { headers } : {}),
  };
  return sendWithRetry(mailOptions);
}
