import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';

export interface DeliveryMethodSetting {
  key: string;
  label: string;
  description: string;
  /** Fee charged per shop order, in rupees. */
  fee: number;
  /** A shop order at or above this subtotal ships free. null = never free. */
  freeAbove: number | null;
}

export interface BankTransferSetting {
  enabled: boolean;
  bankName: string;
  accountTitle: string;
  iban: string;
}

/** A JazzCash or Easypaisa mobile account customers send money to by hand. */
export interface WalletSetting {
  enabled: boolean;
  accountTitle: string;
  /** 03XXXXXXXXX */
  number: string;
}

/**
 * Platform settings and their defaults. Values in the `settings` table override these,
 * so admins can change them without a deploy (admin settings UI arrives in Phase 8).
 */
export const SETTING_DEFAULTS = {
  'checkout.delivery_methods': [
    { key: 'standard', label: 'Standard delivery', description: '3–5 working days', fee: 250, freeAbove: 5000 },
    { key: 'express', label: 'Express delivery', description: '1–2 working days in major cities', fee: 500, freeAbove: null },
  ] as DeliveryMethodSetting[],
  'payments.cod': { enabled: true },
  /** New and edited products wait for a moderator before going live. */
  'products.require_approval': true as boolean,
  /**
   * Words that block a product listing. Covers string and materials banned for kite flying
   * (glass- or metal-coated string, chemical/nylon "manjha"). Admins can extend the list.
   */
  'products.banned_keywords': [
    'manjha',
    'glass coated',
    'glass-coated',
    'metal wire',
    'steel wire',
    'metallic string',
    'chemical dor',
    'nylon dor',
    'chinese dor',
  ] as string[],
  /**
   * How ranking points are calculated for a completed tournament (see tournaments/bracket.ts).
   * Change it, then run POST /admin/rankings/recalculate to apply it to past tournaments.
   */
  'rankings.points': {
    placement: { '1': 100, '2': 70, '3': 45, '5': 25, '9': 12, '17': 6 },
    participation: 5,
    perWin: 3,
  } as { placement: Record<string, number>; participation: number; perWin: number },
  /** A post or comment with this many open reports is hidden until a moderator reviews it. */
  'community.auto_hide_reports': 5 as number,
  /** Platform commission on delivered orders, in percent. 0 until the business sets one. */
  'marketplace.commission_percent': 0 as number,
  // Disabled until an admin enters real account details.
  'payments.bank_transfer': { enabled: false, bankName: '', accountTitle: '', iban: '' } as BankTransferSetting,
  // Mobile wallets, paid by hand and verified by staff like bank transfers. Off until a number is entered.
  'payments.jazzcash': { enabled: false, accountTitle: '', number: '' } as WalletSetting,
  'payments.easypaisa': { enabled: false, accountTitle: '', number: '' } as WalletSetting,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return (row?.value as SettingValue<K> | undefined) ?? SETTING_DEFAULTS[key];
  }

  async set<K extends SettingKey>(key: K, value: SettingValue<K>, updatedById?: string) {
    const json = value as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: json, updatedById },
      update: { value: json, updatedById },
    });
  }
}

@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
