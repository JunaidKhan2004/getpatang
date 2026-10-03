import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { SettingsService } from '../settings/settings.service.js';

/** Safety rules every listing must pass (spec: no dangerous or prohibited kite-fighting materials). */
@Injectable()
export class ProductRules {
  constructor(private readonly settings: SettingsService) {}

  async assertAllowed(...texts: (string | undefined | null)[]) {
    return this.assertAllowedIn('title', ...texts);
  }

  /** Same check, reporting the problem on a specific form field. */
  async assertAllowedIn(field: string, ...texts: (string | undefined | null)[]) {
    const hit = findBannedWord(await this.settings.get('products.banned_keywords'), texts);
    if (hit) {
      throw new AppException(
        'PROHIBITED_ITEM',
        `Content promoting “${hit}” is not allowed. Metal, glass-coated and chemical strings are banned for safety.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        [{ field, message: `“${hit}” is not allowed on GetPatang` }],
      );
    }
  }
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The first banned word or phrase found as a whole word in any of the texts (case-insensitive),
 * so "manjha" matches "Sharp MANJHA!" but "glass" alone does not match "glassy".
 */
export function findBannedWord(banned: readonly string[], texts: (string | undefined | null)[]): string | undefined {
  const haystack = texts.filter(Boolean).join(' \n ').toLowerCase();
  return banned.find((word) => new RegExp(`(^|[^a-z])${escape(word.toLowerCase())}([^a-z]|$)`).test(haystack));
}
