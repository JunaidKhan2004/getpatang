import { randomBytes } from 'node:crypto';

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'item'
  );
}

/** A slug that `exists` reports as free, adding a short random suffix when the plain one is taken. */
export async function uniqueSlug(text: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(text);
  if (!(await exists(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(3).toString('hex')}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
