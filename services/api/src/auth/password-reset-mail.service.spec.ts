import { Logger } from '@nestjs/common';
import { PasswordResetMailService } from './password-reset-mail.service';

describe('Password reset in free staging', () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
    jest.restoreAllMocks();
  });

  it('runs without SMTP in staging and never logs recovery secrets', async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'staging';
    process.env.EMAIL_DELIVERY_MODE = 'disabled';
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await new PasswordResetMailService().sendPasswordReset(
      'private@example.invalid',
      'Teste',
      'private-recovery-token',
    );
    const logs = JSON.stringify(warn.mock.calls);
    expect(logs).not.toContain('private@example.invalid');
    expect(logs).not.toContain('private-recovery-token');
  });

  it('does not allow staging email mode to silently disable production email', () => {
    process.env.APP_ENV = 'production';
    process.env.EMAIL_DELIVERY_MODE = 'disabled';
    expect(() => new PasswordResetMailService()).toThrow('homologação');
  });
});
