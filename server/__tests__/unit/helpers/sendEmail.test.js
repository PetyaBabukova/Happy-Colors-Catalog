import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createTransport, sendMail } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport,
  },
}));

async function importSendEmail() {
  return import('../../../helpers/sendEmail.js');
}

describe('sendEmail', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();

    process.env.CONTACT_EMAIL = 'admin@example.com';
    process.env.CONTACT_EMAIL_PASS = 'email-pass';

    sendMail.mockResolvedValue({ messageId: 'message-1' });
    createTransport.mockReturnValue({ sendMail });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.CONTACT_EMAIL;
    delete process.env.CONTACT_EMAIL_PASS;
  });

  it('requires email credentials before creating a transporter', async () => {
    delete process.env.CONTACT_EMAIL_PASS;
    const { sendEmail } = await importSendEmail();

    await expect(sendEmail({ subject: 'Hello', text: 'Body' })).rejects.toThrow(/CONTACT_EMAIL/);

    expect(createTransport).not.toHaveBeenCalled();
  });

  it('sends to the configured admin address when no recipient is provided', async () => {
    const { sendEmail } = await importSendEmail();

    await expect(sendEmail({ subject: 'New order', text: 'Order details' })).resolves.toEqual({
      messageId: 'message-1',
    });

    expect(createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: {
        user: 'admin@example.com',
        pass: 'email-pass',
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'admin@example.com',
      to: 'admin@example.com',
      subject: 'New order',
      text: 'Order details',
    });
  });

  it('reuses the transporter for the same credentials and honors explicit recipients', async () => {
    const { sendEmail } = await importSendEmail();

    await sendEmail({ to: 'customer@example.com', subject: 'Accepted', text: 'Thanks' });
    await sendEmail({ to: 'owner@example.com', subject: 'Admin copy', text: 'Details' });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ to: 'customer@example.com', subject: 'Accepted' })
    );
    expect(sendMail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ to: 'owner@example.com', subject: 'Admin copy' })
    );
  });

  it('recreates the transporter when credentials change', async () => {
    const { sendEmail } = await importSendEmail();

    await sendEmail({ subject: 'First', text: 'Body' });
    process.env.CONTACT_EMAIL_PASS = 'rotated-pass';
    await sendEmail({ subject: 'Second', text: 'Body' });

    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        auth: {
          user: 'admin@example.com',
          pass: 'rotated-pass',
        },
      })
    );
  });

  it('retries transient email failures with a fresh transporter', async () => {
    vi.useFakeTimers();
    sendMail
      .mockRejectedValueOnce(Object.assign(new Error('Socket timeout'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce({ messageId: 'retry-ok' });
    const { sendEmail } = await importSendEmail();

    const resultPromise = sendEmail({ to: 'customer@example.com', subject: 'Retry', text: 'Body' });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ messageId: 'retry-ok' });
    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Email send attempt failed:',
      expect.objectContaining({ attempt: 1, code: 'ETIMEDOUT' })
    );
  });

  it('does not retry non-transient email failures', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { code: 'EAUTH' }));
    const { sendEmail } = await importSendEmail();

    await expect(sendEmail({ subject: 'No retry', text: 'Body' })).rejects.toMatchObject({
      code: 'EAUTH',
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
