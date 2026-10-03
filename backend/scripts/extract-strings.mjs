#!/usr/bin/env node
/**
 * Lists the human-readable English strings in TypeScript sources, as translation keys.
 * Template literals become keys with {placeholders}: `Order ${o.orderNumber} placed` → "Order {orderNumber} placed".
 *
 *   node scripts/extract-strings.mjs <dir> [more dirs…]      prints a JSON array of keys
 *
 * Used to build and check the Urdu dictionaries (src/common/i18n/ur.ts and the web/mobile ones).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const dirs = process.argv.slice(2);
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (!['node_modules', '.next', 'generated'].includes(f)) walk(p);
    } else if (/\.(ts|tsx)$/.test(f) && !/\.(spec|test|e2e-spec|d)\.tsx?$/.test(f)) files.push(p);
  }
};
dirs.forEach(walk);

/** Placeholder name for an embedded expression: the last identifier, e.g. o.orderNumber → orderNumber. */
const nameFor = (expr) => {
  const ids = expr.getText().match(/[A-Za-z_]\w*/g) ?? ['value'];
  return ids[ids.length - 1];
};

/** Sentences people read: words with a space and a capital or sentence punctuation; not code, classes or paths. */
const looksHuman = (s) => {
  const t = s.trim();
  if (!/[A-Za-z]{2}/.test(t) || !/\s/.test(t)) return false;
  if (!/[A-Z]|[.!?]$/.test(t)) return false;
  if (/=>|https?:\/\/|^[.#@/]|^\w+\.\w+\(|select.+from/i.test(t)) return false;
  // Utility class lists (Tailwind) and similar tokens: every word lower-case with -, :, [, ], /, %.
  if (/^[a-z0-9!\-:[\]/%.()#,'"]+( [a-z0-9!\-:[\]/%.()#,'"]+)*$/.test(t)) return false;
  return true;
};

const keys = new Set();
for (const file of files) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    // Skip logger calls and imports.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isCallExpression(node) && /\b(logger|console)\.\w+$/.test(node.expression.getText())) return;
    let text;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateExpression(node)) {
      text = node.head.text + node.templateSpans.map((s) => `{${nameFor(s.expression)}}${s.literal.text}`).join('');
    } else if (ts.isJsxText(node)) text = node.getText().replace(/\s+/g, ' ').trim();
    if (text !== undefined) {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (clean && looksHuman(clean) && !/^[A-Z_]+$/.test(clean)) keys.add(clean);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}
console.log(JSON.stringify([...keys].sort(), null, 1));
