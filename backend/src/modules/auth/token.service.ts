import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';

import type { AccessTokenPayload } from '../../common/auth/auth.guard.js';
import type { RequestMeta } from '../../common/auth/decorators.js';
import { Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Short-lived JWT access tokens + opaque, rotating refresh tokens.
 * Refresh tokens are stored hashed. Re-using a rotated token revokes the whole login (token family).
 */
@Injectable()
export class TokenService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.refreshTtlMs = config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  async issue(userId: string, meta: RequestMeta, familyId: string = randomUUID()): Promise<TokenPair & { id: string }> {
    const refreshToken = randomBytes(48).toString('base64url');
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    const payload: AccessTokenPayload = { sub: userId };
    return { id: record.id, accessToken: await this.jwt.signAsync(payload), refreshToken };
  }

  async rotate(rawToken: string, meta: RequestMeta): Promise<{ userId: string; tokens: TokenPair }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: { select: { status: true } } },
    });
    if (!existing) throw Errors.sessionExpired();

    if (existing.revokedAt) {
      // A token that was already rotated is being replayed: assume theft, end that login everywhere.
      await this.revokeFamily(existing.familyId);
      await this.audit.log({
        actorId: existing.userId,
        action: 'auth.refresh_token_reuse',
        entityType: 'user',
        entityId: existing.userId,
        meta,
      });
      throw Errors.sessionExpired();
    }
    if (existing.expiresAt.getTime() < Date.now()) throw Errors.sessionExpired();
    if (existing.user.status !== UserStatus.ACTIVE) throw Errors.accountBlocked();

    const next = await this.issue(existing.userId, meta, existing.familyId);
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: next.id },
    });
    if (count === 0) {
      // Lost a race with a concurrent refresh using the same token.
      await this.prisma.refreshToken.delete({ where: { id: next.id } });
      throw Errors.sessionExpired();
    }
    return { userId: existing.userId, tokens: { accessToken: next.accessToken, refreshToken: next.refreshToken } };
  }

  async revoke(rawToken: string, userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
