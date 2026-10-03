import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { textContains } from '../../common/db.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publicUserInclude, toPublicUser } from './user.mapper.js';
import type { UpsertProfileDto } from './users.controller.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async upsertProfile(userId: string, dto: UpsertProfileDto, meta: RequestMeta) {
    const data = { displayName: dto.displayName, city: dto.city ?? null, bio: dto.bio ?? null };
    await this.prisma.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await this.audit.log({ actorId: userId, action: 'profile.update', entityType: 'user', entityId: userId, meta });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: publicUserInclude });
    return toPublicUser(user);
  }

  async setLocale(userId: string, locale: 'en' | 'ur') {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { locale }, include: publicUserInclude });
    return toPublicUser(user);
  }

  async list(query: PaginationQueryDto) {
    const where: Prisma.UserWhereInput = query.q
      ? { OR: [{ fullName: textContains(query.q) }, { email: textContains(query.q) }, { phone: { contains: query.q } }] }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: publicUserInclude,
        orderBy: { createdAt: query.order },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return new Paginated(items.map(toPublicUser), total, query);
  }
}
