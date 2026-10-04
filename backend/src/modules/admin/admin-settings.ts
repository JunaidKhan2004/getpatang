import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsDefined } from 'class-validator';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SETTING_DEFAULTS, type SettingKey } from '../settings/settings.service.js';

type Check = (v: unknown) => { value: unknown } | { error: string };

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const str = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Safety words required by the platform rules; admins can add words but not remove these. */
export const REQUIRED_BANNED_KEYWORDS = SETTING_DEFAULTS['products.banned_keywords'];

/** JazzCash / Easypaisa: an account title and a Pakistani mobile number. */
function wallet(v: unknown, name: string): ReturnType<Check> {
  if (!obj(v) || typeof v.enabled !== 'boolean') return { error: `Choose whether ${name} is on.` };
  const value = { enabled: v.enabled, accountTitle: text(v.accountTitle).trim(), number: text(v.number).replace(/[\s-]/g, '') };
  if (value.number && !/^03\d{9}$/.test(value.number)) return { error: 'Enter the mobile number as 03XXXXXXXXX.' };
  if (value.enabled && (!value.accountTitle || !value.number)) return { error: `Enter the account title and number before turning ${name} on.` };
  if (value.accountTitle.length > 80) return { error: 'The account title is too long.' };
  return { value };
}

const CHECKS: Record<SettingKey, Check> = {
  'checkout.delivery_methods': (v) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > 5) return { error: 'Add between 1 and 5 delivery methods.' };
    const out = [];
    const keys = new Set<string>();
    for (const m of v) {
      if (!obj(m)) return { error: 'Each delivery method needs a key, label, description and fee.' };
      if (typeof m.key !== 'string' || !/^[a-z][a-z_]{1,19}$/.test(m.key) || keys.has(m.key)) return { error: 'Keys must be unique, lower-case words like "standard".' };
      if (!str(m.label, 2, 40) || !str(text(m.description), 0, 80)) return { error: `Check the label and description of "${m.key}".` };
      if (!isInt(m.fee, 0, 10_000)) return { error: `The fee for "${m.key}" must be 0–10,000 rupees.` };
      if (m.freeAbove !== null && !isInt(m.freeAbove, 1, 10_000_000)) return { error: `"Free above" for "${m.key}" must be empty or a positive amount.` };
      keys.add(m.key);
      out.push({ key: m.key, label: (m.label as string).trim(), description: text(m.description).trim(), fee: m.fee, freeAbove: m.freeAbove });
    }
    return { value: out };
  },
  'payments.cod': (v) => (obj(v) && typeof v.enabled === 'boolean' ? { value: { enabled: v.enabled } } : { error: 'Choose whether cash on delivery is on.' }),
  'payments.bank_transfer': (v) => {
    if (!obj(v) || typeof v.enabled !== 'boolean') return { error: 'Choose whether bank transfer is on.' };
    const value = {
      enabled: v.enabled,
      bankName: text(v.bankName).trim(),
      accountTitle: text(v.accountTitle).trim(),
      iban: text(v.iban).replace(/\s/g, '').toUpperCase(),
    };
    if (value.enabled && (!value.bankName || !value.accountTitle)) return { error: 'Enter the bank name and account title before turning bank transfer on.' };
    if (value.iban && !/^PK\d{2}[A-Z]{4}\d{16}$/.test(value.iban)) return { error: 'Enter a valid Pakistani IBAN (PK + 22 characters).' };
    if (value.enabled && !value.iban) return { error: 'Enter the IBAN before turning bank transfer on.' };
    if (value.bankName.length > 60 || value.accountTitle.length > 80) return { error: 'The bank name or account title is too long.' };
    return { value };
  },
  'payments.jazzcash': (v) => wallet(v, 'JazzCash'),
  'payments.easypaisa': (v) => wallet(v, 'Easypaisa'),
  'products.require_approval': (v) => (typeof v === 'boolean' ? { value: v } : { error: 'Choose on or off.' }),
  'products.banned_keywords': (v) => {
    if (!Array.isArray(v) || v.some((w) => typeof w !== 'string')) return { error: 'Enter one word or phrase per line.' };
    const words = [...new Set(v.map((w: string) => w.trim().toLowerCase()).filter(Boolean))];
    if (words.some((w) => w.length < 3 || w.length > 40)) return { error: 'Each word or phrase must be 3–40 characters.' };
    if (words.length > 300) return { error: 'Keep the list under 300 entries.' };
    const missing = REQUIRED_BANNED_KEYWORDS.filter((w) => !words.includes(w));
    if (missing.length) return { error: `These safety words cannot be removed: ${missing.join(', ')}.` };
    return { value: words };
  },
  'rankings.points': (v) => {
    if (!obj(v) || !obj(v.placement)) return { error: 'Enter points for placements, participation and wins.' };
    const placement: Record<string, number> = {};
    for (const [k, p] of Object.entries(v.placement)) {
      if (!/^[1-9]\d{0,2}$/.test(k) || !isInt(p, 0, 1000)) return { error: 'Placements must be positions (1, 2, 3, 5…) with 0–1000 points.' };
      placement[k] = p;
    }
    if (!Object.keys(placement).length) return { error: 'Give points for at least the winner.' };
    if (!isInt(v.participation, 0, 100) || !isInt(v.perWin, 0, 100)) return { error: 'Participation and per-win points must be 0–100.' };
    return { value: { placement, participation: v.participation, perWin: v.perWin } };
  },
  'community.auto_hide_reports': (v) => (isInt(v, 2, 100) ? { value: v } : { error: 'Use a number from 2 to 100.' }),
  'marketplace.commission_percent': (v) =>
    typeof v === 'number' && v >= 0 && v <= 50 && Math.round(v * 10) === v * 10 ? { value: v } : { error: 'Use a percentage from 0 to 50 (one decimal place).' },
};

/** Validates and normalises a new value for a setting. Exported for unit tests. */
export const validateSetting = (key: SettingKey, value: unknown) => CHECKS[key](value);

const META: Record<SettingKey, { group: string; label: string; description: string }> = {
  'checkout.delivery_methods': { group: 'Checkout', label: 'Delivery methods', description: 'Options and fees shown at checkout. The fee applies per shop order.' },
  'payments.cod': { group: 'Payments', label: 'Cash on delivery', description: 'Let customers pay the rider in cash.' },
  'payments.bank_transfer': { group: 'Payments', label: 'Bank transfer', description: 'Account customers transfer to. Orders wait until staff verify the transfer.' },
  'payments.jazzcash': { group: 'Payments', label: 'JazzCash', description: 'Mobile account customers send money to. Orders wait until staff check the transaction ID.' },
  'payments.easypaisa': { group: 'Payments', label: 'Easypaisa', description: 'Mobile account customers send money to. Orders wait until staff check the transaction ID.' },
  'marketplace.commission_percent': { group: 'Payments', label: 'Platform commission (%)', description: 'Taken from delivered orders when computing seller earnings.' },
  'products.require_approval': { group: 'Marketplace', label: 'Approve products before they go live', description: 'New and edited products wait for a moderator.' },
  'products.banned_keywords': {
    group: 'Safety',
    label: 'Banned words',
    description: 'Listings, posts, comments, tournaments and events containing these are refused. The core safety words cannot be removed.',
  },
  'community.auto_hide_reports': { group: 'Safety', label: 'Auto-hide after reports', description: 'Posts and comments with this many open reports from different people are hidden until reviewed.' },
  'rankings.points': { group: 'Tournaments', label: 'Ranking points', description: 'Applied when a tournament completes. Recalculate rankings afterwards to apply to past tournaments.' },
};

export class SettingValueDto {
  @ApiProperty({ description: 'The new value; its shape depends on the setting' })
  @IsDefined()
  value: unknown;
}

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private key(key: string): SettingKey {
    if (!(key in SETTING_DEFAULTS)) throw Errors.notFound('Setting');
    return key as SettingKey;
  }

  async list() {
    const rows = await this.prisma.setting.findMany();
    const editors = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.updatedById).filter((x): x is string => Boolean(x)) } },
      select: { id: true, fullName: true },
    });
    return (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => {
      const row = rows.find((r) => r.key === key);
      return {
        key,
        ...META[key],
        value: row?.value ?? SETTING_DEFAULTS[key],
        default: SETTING_DEFAULTS[key],
        isDefault: !row,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: editors.find((e) => e.id === row?.updatedById)?.fullName ?? null,
        ...(key === 'products.banned_keywords' && { required: REQUIRED_BANNED_KEYWORDS }),
      };
    });
  }

  async update(actor: AuthUser, rawKey: string, dto: SettingValueDto, meta: RequestMeta) {
    const key = this.key(rawKey);
    const checked = CHECKS[key](dto.value);
    if ('error' in checked) throw new AppException('SETTING_INVALID', checked.error, 400, [{ field: 'value', message: checked.error }]);
    const before = (await this.prisma.setting.findUnique({ where: { key } }))?.value ?? SETTING_DEFAULTS[key];
    const json = checked.value as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key }, create: { key, value: json, updatedById: actor.id }, update: { value: json, updatedById: actor.id } });
    await this.audit.log({ actorId: actor.id, action: 'setting.update', entityType: 'setting', entityId: key, metadata: { before, after: json } as Prisma.InputJsonValue, meta });
    return (await this.list()).find((s) => s.key === key);
  }

  async reset(actor: AuthUser, rawKey: string, meta: RequestMeta) {
    const key = this.key(rawKey);
    const { count } = await this.prisma.setting.deleteMany({ where: { key } });
    if (count) await this.audit.log({ actorId: actor.id, action: 'setting.reset', entityType: 'setting', entityId: key, meta });
    return (await this.list()).find((s) => s.key === key);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Put(':key')
  @ApiOperation({ summary: 'Change a platform setting (validated per setting, audited)' })
  update(@CurrentUser() actor: AuthUser, @Param('key') key: string, @Body() dto: SettingValueDto, @ReqMeta() meta: RequestMeta) {
    return this.settings.update(actor, key, dto, meta);
  }

  @Post(':key/reset')
  @HttpCode(HttpStatus.OK)
  reset(@CurrentUser() actor: AuthUser, @Param('key') key: string, @ReqMeta() meta: RequestMeta) {
    return this.settings.reset(actor, key, meta);
  }
}
