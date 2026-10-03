import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import { Errors } from '../errors/app.exception.js';
import { type AuthenticatedRequest, IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY, PERMISSIONS_KEY } from './decorators.js';
import type { Permission } from './permissions.js';

export interface AccessTokenPayload {
  sub: string;
}

/**
 * Global guard: verifies the bearer token, loads the user's current roles and permissions
 * from the database (so suspensions and role changes apply immediately), then enforces
 * @RequirePermissions. Routes marked @Public() skip it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      if (this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets) && req.headers.authorization) {
        await this.authenticate(req).catch(() => undefined);
      }
      return true;
    }

    await this.authenticate(req);
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets);
    if (required?.some((p) => !req.user!.permissions.has(p))) throw Errors.forbidden();
    return true;
  }

  private async authenticate(req: AuthenticatedRequest): Promise<void> {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw Errors.unauthenticated();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw Errors.sessionExpired();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        roles: { select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
      },
    });
    if (!user || user.status === UserStatus.DELETED) throw Errors.sessionExpired();
    if (user.status !== UserStatus.ACTIVE) throw Errors.accountBlocked();

    req.user = {
      id: user.id,
      roles: user.roles.map((r) => r.role.key),
      permissions: new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
    };
  }
}
