import { langFromHeader, t, translate, translateDeep } from './i18n.js';
import { UR } from './ur.js';

describe('Urdu translations', () => {
  it('picks the language from Accept-Language', () => {
    expect(langFromHeader('ur-PK,ur;q=0.9,en;q=0.8')).toBe('ur');
    expect(langFromHeader('en-US,ur;q=0.5')).toBe('en');
    expect(langFromHeader('fr-FR,ur;q=0.7')).toBe('ur');
    expect(langFromHeader('de')).toBe('en');
    expect(langFromHeader(undefined)).toBe('en');
  });

  it('translates exact sentences and leaves unknown text alone', () => {
    expect(translate('Your cart is empty.', 'ur')).toBe(UR['Your cart is empty.']);
    expect(translate('Your cart is empty.', 'en')).toBe('Your cart is empty.');
    expect(translate('Some shop name nobody translated', 'ur')).toBe('Some shop name nobody translated');
  });

  it('fills placeholders and translates the captured parts', () => {
    expect(translate('Order KP-261003-ABC123 placed', 'ur')).toBe('آرڈر KP-261003-ABC123 لگ گیا');
    expect(translate('Order KP-1: shipped', 'ur')).toBe('آرڈر KP-1: روانہ');
    expect(translate('Order was not found.', 'ur')).toBe('آرڈر نہیں ملا۔');
    expect(translate('Your order is on its way with TCS (tracking 77).', 'ur')).toBe('آپ کا آرڈر TCS کے ذریعے روانہ ہو گیا ہے (ٹریکنگ 77)۔');
    expect(t('ur', 'Hi {name},\n\n{body}', { name: 'Ali', body: 'Your cart is empty.' })).toBe(`السلام علیکم Ali،\n\n${UR['Your cart is empty.']}`);
  });

  it('translates only platform-text fields in responses', () => {
    const body = { data: { message: 'Your cart is empty.', title: 'Order KP-9 placed', email: 'Your cart is empty.', items: [{ label: 'Cash on delivery' }] } };
    translateDeep(body, 'ur');
    expect(body.data.message).toBe(UR['Your cart is empty.']);
    expect(body.data.title).toBe('آرڈر KP-9 لگ گیا');
    expect(body.data.email).toBe('Your cart is empty.');
    expect(body.data.items[0].label).toBe('کیش آن ڈیلیوری');
  });

  it('every Urdu text uses only placeholders that its English key provides', () => {
    const broken = Object.entries(UR).filter(([en, ur]) => {
      const keys = new Set(en.match(/\{\w+\}/g) ?? []);
      return (ur.match(/\{\w+\}/g) ?? []).some((p) => !keys.has(p));
    });
    expect(broken).toEqual([]);
  });

  it('has no empty translations', () => {
    expect(Object.entries(UR).filter(([, ur]) => !ur.trim())).toEqual([]);
  });
});
