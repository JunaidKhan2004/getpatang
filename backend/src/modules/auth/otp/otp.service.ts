import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose, User } from '@prisma/client';

import { Errors } from '../../../common/errors/app.exception.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { OTP_CHANNEL, type OtpChannel } from './otp-channel.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_CHANNEL) private readonly channel: OtpChannel,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('OTP_SECRET');
  }

  private hash(code: string): string {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }

  /**
   * Creates and delivers a new code, replacing any open code for the same purpose.
   * With `silent`, a request inside the cooldown is ignored instead of rejected.
   */
  async issue(user: Pick<User, 'id' | 'email' | 'phone' | 'fullName'>, purpose: OtpPurpose, opts: { silent?: boolean } = {}) {
    const last = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const waitMs = last ? RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime()) : 0;
    if (waitMs > 0) {
      if (opts.silent) return;
      throw Errors.otpCooldown(Math.ceil(waitMs / 1000));
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { userId: user.id, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({
        data: { userId: user.id, purpose, codeHash: this.hash(code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      }),
    ]);
    await this.channel.send({ email: user.email, phone: user.phone, name: user.fullName }, code, purpose);
  }

  /** Checks and consumes the latest open code. Throws a user-safe error when it does not match. */
  async consume(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw Errors.otpInvalid();
    if (otp.expiresAt.getTime() < Date.now()) throw Errors.otpExpired();
    if (otp.attempts >= MAX_ATTEMPTS) throw Errors.otpTooManyAttempts();

    const matches = timingSafeEqual(Buffer.from(this.hash(code)), Buffer.from(otp.codeHash));
    if (!matches) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw otp.attempts + 1 >= MAX_ATTEMPTS ? Errors.otpTooManyAttempts() : Errors.otpInvalid();
    }

    // Conditional update guards against the same code being used twice concurrently.
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw Errors.otpInvalid();
  }
}
