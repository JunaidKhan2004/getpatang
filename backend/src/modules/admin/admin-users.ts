import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, ReportStatus, UserStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length } from 'class-validator';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { Role } from '../../common/auth/roles.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { publicUserInclude, toPublicUser } from '../users/user.mapper.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Roles granted by other flows (shop approval, sign-up), so they are not edited here. */
const MANAGED_ELSEWHERE: string[] = [Role.SELLER, Role.CUSTOMER];
/** Only a Super Admin may grant or take away these. */
const PROTECTED: string[] = [Role.SUPER_ADMIN, Role.ADMIN];

export class AdminUserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsIn(Object.values(UserStatus)) status?: UserStatus;
  @ApiPropertyOptional({ enum: Object.values(Role) }) @IsOptional() @IsIn(Object.values(Role)) role?: string;
}

export class UserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'BANNED'] })
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED])
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';

  @ApiProperty({ description: 'Shown to the person and kept in the audit log' })
  @Transform(trim)
  @IsString()
  @Length(5, 500, { message: 'Give a reason (5–500 characters)' })
  reason: string;
}

export class UserRolesDto {
  @ApiProperty({ type: [String], description: 'Staff roles the user should have; Seller and Customer are kept as they are' })
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(Object.values(Role), { each: true })
  roles: string[];
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: AdminUserQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : { status: { not: UserStatus.DELETED } }),
      ...(q.role && { roles: { some: { role: { key: q.role } } } }),
      ...(q.q && { OR: [{ fullName: textContains(q.q) }, { email: textContains(q.q) }, { phone: { contains: q.q } }] }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, include: publicUserInclude, orderBy: { createdAt: q.order }, skip: q.skip, take: q.pageSize }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(rows.map(toPublicUser), total, q);
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        ...publicUserInclude,
        shop: { select: { id: true, name: true, slug: true, status: true } },
        _count: { select: { orders: true, posts: true, reviews: true, tournamentEntries: true, reportsFiled: true } },
      },
    });
    if (!user) throw Errors.notFound('User');
    const [reportsAgainst, sessions, history, spent] = await Promise.all([
      this.prisma.report.count({ where: { targetType: 'user', targetId: id } }),
      this.prisma.refreshToken.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ entityType: 'user', entityId: id }, { actorId: id }] },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { action: true, entityType: true, metadata: true, ipAddress: true, createdAt: true, actor: { select: { id: true, fullName: true } } },
      }),
      this.prisma.order.aggregate({ where: { userId: id, status: 'DELIVERED' }, _sum: { total: true } }),
    ]);
    return {
      ...toPublicUser(user),
      lastLoginAt: user.lastLoginAt,
      shop: user.shop,
      counts: { ...user._count, reportsAgainst, activeSessions: sessions },
      deliveredSpend: spent._sum.total ?? 0,
      history,
    };
  }

  private async assertCanManage(actor: AuthUser, targetId: string) {
    if (actor.id === targetId) throw new AppException('SELF', 'You cannot change your own account here.', HttpStatus.BAD_REQUEST);
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, include: { roles: { select: { role: { select: { key: true } } } } } });
    if (!target || target.status === UserStatus.DELETED) throw Errors.notFound('User');
    const roles = target.roles.map((r) => r.role.key);
    if (roles.some((r) => PROTECTED.includes(r)) && !actor.roles.includes(Role.SUPER_ADMIN)) {
      throw new AppException('NOT_ALLOWED', 'Only a Super Admin can change an admin account.', HttpStatus.FORBIDDEN);
    }
    return { target, roles };
  }

  async setStatus(actor: AuthUser, id: string, dto: UserStatusDto, meta: RequestMeta) {
    const { target } = await this.assertCanManage(actor, id);
    if (target.status === dto.status) throw new AppException('NO_CHANGE', `This account is already ${dto.status.toLowerCase()}.`, HttpStatus.CONFLICT);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: dto.status } });
      // Suspended or banned people are signed out everywhere at once.
      if (dto.status !== UserStatus.ACTIVE) await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      // Their open user reports are now handled.
      if (dto.status !== UserStatus.ACTIVE) {
        await tx.report.updateMany({
          where: { targetType: 'user', targetId: id, status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } },
          data: { status: ReportStatus.RESOLVED, action: dto.status === UserStatus.BANNED ? 'banned' : 'suspended', resolution: dto.reason, resolvedById: actor.id, resolvedAt: new Date() },
        });
      }
    });
    await this.audit.log({ actorId: actor.id, action: `user.${dto.status.toLowerCase()}`, entityType: 'user', entityId: id, metadata: { from: target.status, reason: dto.reason }, meta });
    this.notifications.send({
      userIds: id,
      category: 'account',
      type: `account.${dto.status.toLowerCase()}`,
      title: dto.status === UserStatus.ACTIVE ? 'Your account is active again' : dto.status === UserStatus.BANNED ? 'Your account has been closed' : 'Your account is suspended',
      body: dto.status === UserStatus.ACTIVE ? `You can sign in again. ${dto.reason}` : `Reason: ${dto.reason} If you think this is a mistake, contact support.`,
    });
    return this.detail(id);
  }

  async verify(actor: AuthUser, id: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw Errors.notFound('User');
    if (user.isVerified) return this.detail(id);
    await this.prisma.user.update({ where: { id }, data: { isVerified: true, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
    await this.audit.log({ actorId: actor.id, action: 'user.verify', entityType: 'user', entityId: id, meta });
    return this.detail(id);
  }

  /** Replaces the user's staff roles. Seller/Customer stay as they are. */
  async setRoles(actor: AuthUser, id: string, dto: UserRolesDto, meta: RequestMeta) {
    const { roles: current } = await this.assertCanManage(actor, id);
    const wanted = [...new Set(dto.roles.filter((r) => !MANAGED_ELSEWHERE.includes(r)))];
    const keep = current.filter((r) => MANAGED_ELSEWHERE.includes(r));
    const next = [...new Set([...keep, ...wanted])];
    const changed = [...next.filter((r) => !current.includes(r)), ...current.filter((r) => !next.includes(r))];
    if (changed.some((r) => PROTECTED.includes(r)) && !actor.roles.includes(Role.SUPER_ADMIN)) {
      throw new AppException('NOT_ALLOWED', 'Only a Super Admin can grant or remove admin roles.', HttpStatus.FORBIDDEN);
    }
    if (!changed.length) return this.detail(id);

    const roleRows = await this.prisma.role.findMany({ where: { key: { in: next } }, select: { id: true, key: true } });
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({ data: roleRows.map((r) => ({ userId: id, roleId: r.id, assignedById: actor.id })) }),
    ]);
    await this.audit.log({ actorId: actor.id, action: 'user.roles', entityType: 'user', entityId: id, metadata: { from: current, to: next }, meta });
    return this.detail(id);
  }

  async roles() {
    const rows = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: { key: true, name: true, description: true, permissions: { select: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
    });
    return rows.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      users: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key),
      assignable: !MANAGED_ELSEWHERE.includes(r.key),
      protected: PROTECTED.includes(r.key),
    }));
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get('users')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list(@Query() q: AdminUserQueryDto) {
    return this.users.list(q);
  }

  @Get('users/:id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  detail(@Param('id') id: string) {
    return this.users.detail(id);
  }

  @Post('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Suspend, ban or restore an account (signs them out everywhere)' })
  setStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UserStatusDto, @ReqMeta() meta: RequestMeta) {
    return this.users.setStatus(actor, id, dto, meta);
  }

  @Post('users/:id/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  verify(@CurrentUser() actor: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.users.verify(actor, id, meta);
  }

  @Put('users/:id/roles')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  setRoles(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UserRolesDto, @ReqMeta() meta: RequestMeta) {
    return this.users.setRoles(actor, id, dto, meta);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  roles() {
    return this.users.roles();
  }
}
