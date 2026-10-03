import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text; an HTML version is built from it. */
  text: string;
  /** Optional call-to-action link (absolute URL). */
  action?: { label: string; url: string };
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Simple branded HTML: maroon header, body text, one button. Works in every mail client. */
export function renderMail(m: MailMessage) {
  const paragraphs = m.text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button = m.action
    ? `<p style="margin:20px 0"><a href="${escape(m.action.url)}" style="background:#420000;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">${escape(m.action.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F6F6F6;font-family:Inter,Arial,sans-serif;color:#2A1616">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #D4D7DD;border-radius:8px" cellspacing="0" cellpadding="0">
<tr><td style="background:#420000;color:#ffffff;padding:16px 24px;font-weight:700;font-size:18px;border-radius:8px 8px 0 0">GetPatang</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 14px">${escape(m.subject)}</h1>${paragraphs}${button}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #EAE9E9;font-size:12px;color:#5E626B">You can change which emails you get in your account's notification settings.</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Sends email through SMTP (MAIL_TRANSPORT=smtp). With MAIL_TRANSPORT=console — development only,
 * refused in production by env validation — messages are written to the log and not sent.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transporter: Transporter | null;
  private readonly from: string;
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    const smtp = config.get<string>('MAIL_TRANSPORT') === 'smtp';
    this.enabled = smtp;
    this.transporter = smtp
      ? nodemailer.createTransport({
          host: config.getOrThrow<string>('SMTP_HOST'),
          port: Number(config.get('SMTP_PORT') ?? 587),
          secure: Number(config.get('SMTP_PORT') ?? 587) === 465,
          auth: config.get('SMTP_USER') ? { user: config.get<string>('SMTP_USER')!, pass: config.get<string>('SMTP_PASS') ?? '' } : undefined,
        })
      : null;
  }

  async send(m: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV — not sent] to ${m.to}: ${m.subject}${m.action ? ` (${m.action.url})` : ''}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: m.to,
      subject: m.subject,
      text: m.action ? `${m.text}\n\n${m.action.label}: ${m.action.url}` : m.text,
      html: renderMail(m),
    });
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
