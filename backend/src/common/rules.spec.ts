import { validateSetting } from '../modules/admin/admin-settings.js';
import { renderMail } from '../modules/notifications/mail.js';
import { newOrderNumber } from '../modules/orders/checkout.service.js';
import { canTransition, CUSTOMER_CANCELLABLE, ORDER_TRANSITIONS } from '../modules/orders/order-status.js';
import { findBannedWord } from '../modules/seller/product-rules.js';
import { SETTING_DEFAULTS } from '../modules/settings/settings.service.js';
import { sniffType } from '../modules/storage/uploads.js';

describe('banned materials', () => {
  const banned = SETTING_DEFAULTS['products.banned_keywords'];

  it('finds banned words as whole words, in any case, across fields', () => {
    expect(findBannedWord(banned, ['Kite pack', 'Comes with sharp MANJHA!'])).toBe('manjha');
    expect(findBannedWord(banned, ['Glass-coated string'])).toBe('glass-coated');
    expect(findBannedWord(banned, [null, undefined, 'Plain cotton string'])).toBeUndefined();
  });

  it('does not flag words that merely contain a banned word', () => {
    expect(findBannedWord(['dor'], ['Dorothy flies paper kites'])).toBeUndefined();
    expect(findBannedWord(['dor'], ['Cotton dor, 500 m'])).toBe('dor');
  });

  it('treats special characters in banned phrases literally', () => {
    expect(findBannedWord(['c++ wire'], ['c++ wire spool'])).toBe('c++ wire');
    expect(findBannedWord(['a.b'], ['axb'])).toBeUndefined();
  });
});

describe('order status rules', () => {
  it('never leaves a final state except to refund', () => {
    expect(ORDER_TRANSITIONS.REFUNDED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual(['REFUNDED']);
  });

  it('cannot cancel once shipped', () => {
    for (const s of ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const) expect(canTransition(s, 'CANCELLED')).toBe(false);
    expect(canTransition('PREPARING', 'CANCELLED')).toBe(true);
  });

  it('lets customers cancel only before preparation', () => {
    expect(CUSTOMER_CANCELLABLE).toEqual(['PENDING', 'CONFIRMED']);
  });

  it('makes order numbers that are readable and distinct', () => {
    const numbers = new Set(Array.from({ length: 500 }, () => newOrderNumber()));
    expect(numbers.size).toBe(500);
    expect([...numbers][0]).toMatch(/^KP-\d{6}-[A-Z0-9]{6}$/);
    expect(newOrderNumber('CO')).toMatch(/^CO-/);
  });
});

describe('upload type detection', () => {
  it('trusts file bytes, not names', () => {
    expect(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffType(Buffer.from('89504e470d0a1a0a00', 'hex'))).toBe('png');
    expect(sniffType(Buffer.from('%PDF-1.7'))).toBe('pdf');
    expect(sniffType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('webp');
    expect(sniffType(Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  ')]))).toBe('mov');
    expect(sniffType(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(sniffType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });
});

describe('settings validation', () => {
  const ok = (key: Parameters<typeof validateSetting>[0], v: unknown) => validateSetting(key, v);

  it('keeps the core safety words and normalises the list', () => {
    const base = [...SETTING_DEFAULTS['products.banned_keywords']];
    expect(ok('products.banned_keywords', base.filter((w) => w !== 'manjha'))).toEqual({ error: expect.stringContaining('manjha') });
    expect(ok('products.banned_keywords', [...base, '  Razor String ', 'razor string'])).toEqual({ value: [...base, 'razor string'] });
  });

  it('checks delivery methods', () => {
    expect(ok('checkout.delivery_methods', [])).toHaveProperty('error');
    expect(ok('checkout.delivery_methods', [{ key: 'std', label: 'Standard', description: '', fee: 100, freeAbove: null }, { key: 'std', label: 'Again', description: '', fee: 1, freeAbove: null }])).toHaveProperty('error');
    expect(ok('checkout.delivery_methods', [{ key: 'standard', label: ' Standard ', fee: 250, freeAbove: 5000 }])).toEqual({
      value: [{ key: 'standard', label: 'Standard', description: '', fee: 250, freeAbove: 5000 }],
    });
  });

  it('requires real bank details before bank transfer is turned on', () => {
    expect(ok('payments.bank_transfer', { enabled: true, bankName: '', accountTitle: '', iban: '' })).toHaveProperty('error');
    expect(ok('payments.bank_transfer', { enabled: false, bankName: 'X', accountTitle: 'Y', iban: 'PK00' })).toHaveProperty('error');
    expect(ok('payments.bank_transfer', { enabled: true, bankName: 'Meezan', accountTitle: 'GetPatang', iban: 'pk36 scbl 0000 0011 2345 6702' })).toEqual({
      value: { enabled: true, bankName: 'Meezan', accountTitle: 'GetPatang', iban: 'PK36SCBL0000001123456702' },
    });
  });

  it('bounds numbers', () => {
    expect(ok('community.auto_hide_reports', 1)).toHaveProperty('error');
    expect(ok('community.auto_hide_reports', 5)).toEqual({ value: 5 });
    expect(ok('marketplace.commission_percent', 12.5)).toEqual({ value: 12.5 });
    expect(ok('marketplace.commission_percent', 12.55)).toHaveProperty('error');
    expect(ok('rankings.points', { placement: { first: 10 }, participation: 1, perWin: 1 })).toHaveProperty('error');
  });
});

describe('email rendering', () => {
  it('escapes user-supplied text and links', () => {
    const html = renderMail({ to: 'a@b.c', subject: '<script>alert(1)</script>', text: 'Hi "you" & <b>me</b>', action: { label: 'Open', url: 'https://x.test/?a=1&b="2"' } });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Hi &quot;you&quot; &amp; &lt;b&gt;me&lt;/b&gt;');
    expect(html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
  });
});
