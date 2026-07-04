import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import {
  renderDocumentRejectedEmail,
  renderStageAdvancedEmail,
  type DocumentRejectedEmailInput,
  type RenderedEmail,
  type StageAdvancedEmailInput,
} from './email-templates';

/**
 * SMTP-backed transactional email service (self-hosted, nodemailer only — no
 * third-party APIs). Configured entirely from standard SMTP_* env vars.
 *
 * Sending is best-effort and fire-and-forget: every failure is caught and
 * logged so a flaky mail server can never break an API request or roll back a
 * committed transaction. Callers dispatch AFTER their `$transaction` commits.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private from = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      // No SMTP configured (e.g. local dev): disable sending, don't crash.
      this.logger.warn(
        'SMTP_HOST is not set — email notifications are disabled.',
      );
      return;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from =
      this.config.get<string>('SMTP_FROM') ??
      user ??
      'no-reply@alsasvize.local';

    this.transporter = createTransport({
      host,
      port,
      // Implicit TLS on 465 (SMTPS); STARTTLS is negotiated on other ports.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`Email transport ready (host=${host}, port=${port}).`);
  }

  /** Notifies a customer that a document was rejected and must be re-uploaded. */
  async sendDocumentRejected(input: DocumentRejectedEmailInput): Promise<void> {
    await this.dispatch(input.to, () => renderDocumentRejectedEmail(input));
  }

  /** Notifies a customer that their application advanced (incl. completion). */
  async sendStageAdvanced(input: StageAdvancedEmailInput): Promise<void> {
    await this.dispatch(input.to, () => renderStageAdvancedEmail(input));
  }

  /**
   * Renders and delivers an email, swallowing every error. Rendering happens
   * inside the try so callers can safely `void` the returned promise without
   * risking an unhandled rejection.
   */
  private async dispatch(
    to: string,
    render: () => RenderedEmail,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.debug(`Email suppressed (transport disabled) -> ${to}`);
      return;
    }

    try {
      const { subject, html, text } = render();
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
      this.logger.log(`Sent "${subject}" -> ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email -> ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
