import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  meta?: RequestMeta;
}

/** Append-only audit trail. Writing a log entry never breaks the action being logged. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          ipAddress: entry.meta?.ipAddress,
          userAgent: entry.meta?.userAgent,
        },
      });
    } catch (e) {
      this.logger.error(`Failed to write audit log for ${entry.action}`, e instanceof Error ? e.stack : String(e));
    }
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
