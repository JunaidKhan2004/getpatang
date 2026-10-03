import type { Request } from 'express';

import { UR } from './ur.js';

/**
 * Urdu support. English sentences are the keys; src/common/i18n/ur.ts holds their Urdu.
 * Keys may contain {placeholders}: "Order {orderNumber} placed" matches "Order KP-1 placed",
 * and each captured part is itself translated when it is a known phrase.
 * Anything without a translation stays in English.
 */
export type Lang = 'en' | 'ur';
export const LANGS: Lang[] = ['en', 'ur'];

/** First supported language in an Accept-Language header (e.g. "ur-PK,ur;q=0.9,en;q=0.8"). */
export function langFromHeader(header: string | undefined | null): Lang {
  if (!header) return 'en';
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { lang: tag.trim().toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  return (ranked.find((r) => LANGS.includes(r.lang as Lang))?.lang as Lang | undefined) ?? 'en';
}

export const langOf = (req: Pick<Request, 'headers'>): Lang => langFromHeader(req.headers['accept-language']);

interface Pattern {
  re: RegExp;
  names: string[];
  ur: string;
}

let patterns: Pattern[] | null = null;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compiled(): Pattern[] {
  if (patterns) return patterns;
  patterns = Object.entries(UR)
    .filter(([en]) => /\{\w+\}/.test(en))
    .map(([en, ur]) => {
      const names: string[] = [];
      const source = en
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (!m) return escapeRe(part);
          names.push(m[1]);
          return '([\\s\\S]*?)';
        })
        .join('');
      return { re: new RegExp(`^${source}$`), names, ur };
    })
    // More literal text first, so specific sentences win over general ones.
    .sort((a, b) => b.re.source.replace(/\(\[\\s\\S\]\*\?\)/g, '').length - a.re.source.replace(/\(\[\\s\\S\]\*\?\)/g, '').length);
  return patterns;
}

/** Translates one piece of text. Unknown text is returned unchanged. */
export function translate(text: string, lang: Lang, depth = 0): string {
  if (lang === 'en' || !text || depth > 3) return text;
  const exact = UR[text];
  if (exact !== undefined) return exact;
  const trimmed = text.trim();
  if (trimmed !== text && UR[trimmed] !== undefined) return text.replace(trimmed, UR[trimmed]);
  for (const p of compiled()) {
    const m = p.re.exec(text);
    if (!m) continue;
    return p.names.reduce((out, name, i) => out.replaceAll(`{${name}}`, translate(m[i + 1], lang, depth + 1)), p.ur);
  }
  return text;
}

/** Fills {placeholders} in an English template, then translates the result. */
export function t(lang: Lang, template: string, values: Record<string, string | number> = {}): string {
  const filled = Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
  return translate(filled, lang);
}

/** Response fields whose values are platform text (not user content) and get translated. */
const TRANSLATED_KEYS = new Set([
  'message',
  'instructions',
  'paymentInstructions',
  'label',
  'providerLabel',
  'paymentLabel',
  'description',
  'title',
  'body',
  'note',
  'reason',
  'statusNote',
  'moderationNote',
  'resolution',
  'reviewNote',
  'name',
  'roundName',
  'text',
  'group',
]);

/** Translates the platform-text fields of a JSON response, in place, for Urdu requests. */
export function translateDeep<T>(value: T, lang: Lang): T {
  if (lang === 'en') return value;
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i]);
      return v;
    }
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if (seen.has(v)) return v;
      seen.add(v);
      for (const [k, child] of Object.entries(v)) {
        (v as Record<string, unknown>)[k] = typeof child === 'string' && TRANSLATED_KEYS.has(k) ? translate(child, lang) : walk(child);
      }
    }
    return v;
  };
  return walk(value) as T;
}
