import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import type { Permission } from './permissions.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'requiredPermissions';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/** Skips authentication for this route. Everything else requires a valid access token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Public route that still identifies the caller when a valid token is sent
 * (e.g. to show "in your wishlist"). An invalid or missing token is ignored.
 */
export const OptionalAuth = () => applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), SetMetadata(OPTIONAL_AUTH_KEY, true));

/** In controllers: the caller on @OptionalAuth routes, or undefined for guests. */
export const MaybeUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

/** Requires ALL listed permissions. Checked on the server for every request. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export interface AuthUser {
  id: string;
  roles: string[];
  permissions: Set<string>;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user!;
});

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export const ReqMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ipAddress: req.ip, userAgent: req.get('user-agent')?.slice(0, 255) };
});
