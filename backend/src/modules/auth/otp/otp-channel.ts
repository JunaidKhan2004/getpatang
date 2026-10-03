import { Logger } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';

import type { MailService } from '../../notifications/mail.js';

export interface OtpRecipient {
  email: string;
  phone?: string | null;
  name: string;
}

/** Delivers one-time codes. */
export interface OtpChannel {
  send(to: OtpRecipient, code: string, purpose: OtpPurpose): Promise<void>;
}

export const OTP_CHANNEL = Symbol('OTP_CHANNEL');

/**
 * DEVELOPMENT ONLY. Prints codes to the server log instead of sending them.
 * Startup refuses this channel when NODE_ENV=production (see config/env.validation.ts).
 */
export class ConsoleOtpChannel implements OtpChannel {
  private readonly logger = new Logger('DevOtpChannel');

  async send(to: OtpRecipient, code: string, purpose: OtpPurpose): Promise<void> {
    this.logger.warn(`[DEV ONLY — not sent] ${purpose} code for ${to.email}: ${code}`);
  }
}

const PURPOSE_TEXT: Record<OtpPurpose, string> = {
  VERIFY_ACCOUNT: 'verify your Kite Platform account',
  RESET_PASSWORD: 'reset your Kite Platform password',
};

/** Sends codes by email through MailService (needs MAIL_TRANSPORT=smtp; checked at startup). */
export class EmailOtpChannel implements OtpChannel {
  constructor(private readonly mail: MailService) {}

  async send(to: OtpRecipient, code: string, purpose: OtpPurpose): Promise<void> {
    await this.mail.send({
      to: to.email,
      subject: `Your code: ${code}`,
      text: `Hi ${to.name},

Use ${code} to ${PURPOSE_TEXT[purpose]}. The code expires in 10 minutes.

If you did not ask for this, you can ignore this email.`,
    });
  }
}

export function createOtpChannel(kind: string, mail: MailService): OtpChannel {
  switch (kind) {
    case 'console':
      return new ConsoleOtpChannel();
    case 'email':
      return new EmailOtpChannel(mail);
    default:
      throw new Error(`OTP_CHANNEL "${kind}" has no provider yet. Use "console" (development) or "email".`);
  }
}
