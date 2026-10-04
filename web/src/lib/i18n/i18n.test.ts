import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatDate, formatPKR } from "../market";
import { timeAgo } from "../notifications";
import { pickLang, translate } from "./core";
import { ur } from "./ur";

/** Literal keys passed to t(), tr(), translate(lang, …) and <Tx text="…" /> anywhere in src/. */
function keysInSource(): Set<string> {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !p.includes(join("lib", "i18n"))) files.push(p);
    }
  };
  walk(join(process.cwd(), "src"));
  const string = String.raw`"((?:[^"\\]|\\.)*)"`;
  const patterns = [
    new RegExp(String.raw`\b(?:t|tr)\(\s*` + string, "g"),
    new RegExp(String.raw`\(await getT\(\)\)\(\s*` + string, "g"),
    new RegExp(String.raw`\btranslate\(\s*\w+,\s*` + string, "g"),
    new RegExp(String.raw`<Tx text=` + string, "g"),
  ];
  const keys = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const re of patterns) for (const m of src.matchAll(re)) keys.add(JSON.parse(`"${m[1]}"`));
  }
  return keys;
}

const holes = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

describe("Urdu dictionary", () => {
  it("has a translation for every sentence on the website", () => {
    const keys = keysInSource();
    expect(keys.size).toBeGreaterThan(800);
    const missing = [...keys].filter((k) => !(k in ur) && /[A-Za-z]{2}/.test(k.replace(/\{\w+\}/g, "")));
    expect(missing).toEqual([]);
  });

  it("keeps the placeholders of each English sentence", () => {
    for (const [en, urdu] of Object.entries(ur)) {
      const a = holes(en);
      const b = holes(urdu);
      // Plural suffixes such as guest{s} have no Urdu form and may be dropped.
      expect([...b].filter((h) => !a.has(h)), en).toEqual([]);
      expect([...a].filter((h) => !b.has(h) && h !== "s"), en).toEqual([]);
    }
  });
});

describe("translate", () => {
  it("falls back to English and fills placeholders", () => {
    expect(translate("en", "Cart")).toBe("Cart");
    expect(translate("ur", "Cart")).toBe("کارٹ");
    expect(translate("ur", "Not a real sentence")).toBe("Not a real sentence");
    expect(translate("en", "Order {orderNumber}", { orderNumber: "GP-1" })).toBe("Order GP-1");
    // Urdu isolates each value so "GP-1" keeps its direction inside the sentence.
    expect(translate("ur", "Order {orderNumber}", { orderNumber: "GP-1" })).toBe("آرڈر ⁨GP-1⁩");
  });

  it("picks the saved language, then the browser's", () => {
    expect(pickLang("ur", "en-US")).toBe("ur");
    expect(pickLang(undefined, "ur-PK,ur;q=0.9,en;q=0.8")).toBe("ur");
    expect(pickLang(undefined, "en-GB,en")).toBe("en");
    expect(pickLang("xx", null)).toBe("en");
  });

  it("formats money, dates and times in Urdu", () => {
    expect(formatPKR(1250, "en")).toBe("Rs 1,250");
    expect(formatPKR(1250, "ur")).toBe("⁨1,250⁩ روپے");
    expect(formatDate("2026-01-15T10:00:00Z", false, "ur")).toContain("جنوری");
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString(), Date.now(), "ur")).toBe("⁨5⁩ منٹ پہلے");
  });
});
