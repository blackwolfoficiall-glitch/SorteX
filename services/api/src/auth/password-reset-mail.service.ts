import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class PasswordResetMailService {
  private readonly logger = new Logger(PasswordResetMailService.name);
  private readonly transporter?: Transporter;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('As configurações SMTP são obrigatórias em produção.');
    }
  }

  async sendPasswordReset(email: string, name: string, token: string) {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const resetUrl = `${webUrl}/recuperar-senha?token=${encodeURIComponent(token)}`;

    if (!this.transporter) {
      this.logger.warn(
        `SMTP não configurado. Link de desenvolvimento para ${email}: ${resetUrl}`,
      );
      return;
    }

    const safeName = this.escapeHtml(name);

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'SorteX <no-reply@sortex.com.br>',
      to: email,
      subject: 'Recuperação de senha da SorteX',
      text: `Olá, ${name}. Redefina sua senha acessando: ${resetUrl}. O link é temporário e só pode ser usado uma vez.`,
      html: `<p>Olá, ${safeName}.</p><p>Use o link abaixo para redefinir sua senha:</p><p><a href="${resetUrl}">Redefinir minha senha</a></p><p>O link é temporário e só pode ser usado uma vez.</p>`,
    });
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }
}
