import { Injectable } from '@nestjs/common';
import { OtpPurpose, User, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { Role } from '../../common/auth/roles.js';
import { Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publicUserInclude, toPublicUser } from '../users/user.mapper.js';
import {
  ForgotPasswordDto,
  LoginDto,
  normalizePkPhone,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';
import { OtpService } from './otp/otp.service.js';
import { TokenService } from './token.service.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the account does not exist, so response time does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates an unverified account and sends a verification code.
   * Registering again with an email that was never verified updates that pending account.
   */
  async register(dto: RegisterDto, meta: RequestMeta) {
    const phone = dto.phone ? normalizePkPhone(dto.phone) : null;
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing?.isVerified) throw Errors.emailTaken();

    if (phone) {
      const phoneOwner = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (phoneOwner && phoneOwner.id !== existing?.id) throw Errors.phoneTaken();
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { fullName: dto.fullName, phone, passwordHash },
        })
      : await this.prisma.user.create({
          data: {
            fullName: dto.fullName,
            email: dto.email,
            phone,
            passwordHash,
            roles: { create: { role: { connect: { key: Role.CUSTOMER } } } },
          },
        });

    await this.otp.issue(user, OtpPurpose.VERIFY_ACCOUNT, { silent: Boolean(existing) });
    await this.audit.log({ actorId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, meta });
    return { email: user.email, verificationRequired: true };
  }

  async verifyAccount(dto: VerifyOtpDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw Errors.otpInvalid();
    if (user.status !== UserStatus.ACTIVE) throw Errors.accountBlocked();

    await this.otp.consume(user.id, OtpPurpose.VERIFY_ACCOUNT, dto.code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, emailVerifiedAt: new Date(), lastLoginAt: new Date() },
    });
    await this.audit.log({ actorId: user.id, action: 'auth.verify_account', entityType: 'user', entityId: user.id, meta });
    return this.session(user.id, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const isEmail = dto.identifier.includes('@');
    const user = await this.prisma.user.findUnique({
      where: isEmail ? { email: dto.identifier.toLowerCase() } : { phone: normalizePkPhone(dto.identifier) },
    });

    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk || user.status === UserStatus.DELETED) {
      await this.audit.log({
        actorId: user?.id,
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user?.id,
        metadata: { identifierType: isEmail ? 'email' : 'phone' },
        meta,
      });
      throw Errors.invalidCredentials();
    }
    if (user.status !== UserStatus.ACTIVE) throw Errors.accountBlocked();
    if (!user.isVerified) {
      await this.otp.issue(user, OtpPurpose.VERIFY_ACCOUNT, { silent: true });
      throw Errors.accountNotVerified();
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, meta });
    return this.session(user.id, meta);
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Same response whether or not the account exists, to avoid revealing registered emails.
    if (!user || user.status !== UserStatus.ACTIVE) return { sent: true };
    if (dto.purpose === OtpPurpose.VERIFY_ACCOUNT && user.isVerified) return { sent: true };
    await this.otp.issue(user, dto.purpose);
    return { sent: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (user && user.status === UserStatus.ACTIVE) {
      await this.otp.issue(user, OtpPurpose.RESET_PASSWORD, { silent: true });
      await this.audit.log({ actorId: user.id, action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id, meta });
    }
    return { sent: true };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== UserStatus.ACTIVE) throw Errors.otpInvalid();

    await this.otp.consume(user.id, OtpPurpose.RESET_PASSWORD, dto.code);
    await this.prisma.user.update({
      where: { id: user.id },
      // Receiving the code by email proves ownership, so an unverified account becomes verified too.
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        isVerified: true,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });
    await this.tokens.revokeAllForUser(user.id);
    await this.audit.log({ actorId: user.id, action: 'auth.password_reset', entityType: 'user', entityId: user.id, meta });
    return { reset: true };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const { tokens } = await this.tokens.rotate(refreshToken, meta);
    return { tokens };
  }

  async logout(userId: string, refreshToken: string, meta: RequestMeta) {
    await this.tokens.revoke(refreshToken, userId);
    await this.audit.log({ actorId: userId, action: 'auth.logout', entityType: 'user', entityId: userId, meta });
    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { ...publicUserInclude, roles: { select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } } },
    });
    if (!user) throw Errors.sessionExpired();
    // Permissions let clients show only the tools a person can use; the API still checks every call.
    const permissions = [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))];
    return { ...toPublicUser(user), permissions };
  }

  private async session(userId: User['id'], meta: RequestMeta) {
    const { accessToken, refreshToken } = await this.tokens.issue(userId, meta);
    return { user: await this.me(userId), tokens: { accessToken, refreshToken } };
  }
}
