/** Notification types. Mirror backend/src/modules/notifications/notifications.ts. */

import { intlLocale, type Lang, makeT } from "./i18n/core";
import { currentLang } from "./i18n/current";

export interface NotificationItem {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  channels: { inApp: boolean; email: boolean; push: boolean };
  categories: { key: string; label: string; description: string; inApp: boolean; email: boolean; push: boolean }[];
}

/** "5 min ago", "Yesterday", or a date. */
export function timeAgo(iso: string, now = Date.now(), lang: Lang = currentLang()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const t = makeT(lang);
  if (s < 60) return t("Just now");
  if (s < 3600) return t("{n} min ago", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n} h ago", { n: Math.floor(s / 3600) });
  if (s < 172800) return t("Yesterday");
  return new Date(iso).toLocaleDateString(intlLocale(lang), { day: "numeric", month: "short", year: "numeric" });
}
