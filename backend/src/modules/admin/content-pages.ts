import { Body, Controller, Get, Injectable, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length } from 'class-validator';

import { type AuthUser, CurrentUser, Public, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

/** The public pages that exist. Their text is written by staff; nothing is published until they do. */
export const CONTENT_PAGES = {
  about: 'About',
  contact: 'Contact',
  faq: 'FAQ',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
} as const;
export type ContentSlug = keyof typeof CONTENT_PAGES;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ContentPageDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 80) title: string;
  @ApiProperty({ description: 'Plain text. Blank line between paragraphs; "## " starts a heading; "- " starts a list item.' })
  @Transform(trim)
  @IsString()
  @Length(20, 50_000, { message: 'Write at least a few sentences (20–50,000 characters)' })
  body: string;
  @ApiProperty() @IsBoolean() published: boolean;
}

@Injectable()
export class ContentPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private slug(slug: string): ContentSlug {
    if (!(slug in CONTENT_PAGES)) throw Errors.notFound('Page');
    return slug as ContentSlug;
  }

  async public(raw: string) {
    const slug = this.slug(raw);
    const page = await this.prisma.contentPage.findUnique({ where: { slug } });
    if (!page?.published) throw Errors.notFound('Page');
    return { slug, title: page.title, body: page.body, updatedAt: page.updatedAt };
  }

  async list() {
    const rows = await this.prisma.contentPage.findMany();
    return (Object.entries(CONTENT_PAGES) as [ContentSlug, string][]).map(([slug, title]) => {
      const row = rows.find((r) => r.slug === slug);
      return { slug, title: row?.title ?? title, body: row?.body ?? '', published: row?.published ?? false, updatedAt: row?.updatedAt ?? null };
    });
  }

  async save(actor: AuthUser, raw: string, dto: ContentPageDto, meta: RequestMeta) {
    const slug = this.slug(raw);
    await this.prisma.contentPage.upsert({
      where: { slug },
      create: { slug, title: dto.title, body: dto.body, published: dto.published, updatedById: actor.id },
      update: { title: dto.title, body: dto.body, published: dto.published, updatedById: actor.id },
    });
    await this.audit.log({ actorId: actor.id, action: 'content.update', entityType: 'content_page', entityId: slug, metadata: { published: dto.published }, meta });
    return (await this.list()).find((p) => p.slug === slug);
  }
}

@ApiTags('Content')
@Controller()
export class ContentPagesController {
  constructor(private readonly pages: ContentPagesService) {}

  @Public()
  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.pages.public(slug);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  @Get('admin/pages')
  list() {
    return this.pages.list();
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.CONTENT_MANAGE)
  @Put('admin/pages/:slug')
  save(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Body() dto: ContentPageDto, @ReqMeta() meta: RequestMeta) {
    return this.pages.save(actor, slug, dto, meta);
  }
}
