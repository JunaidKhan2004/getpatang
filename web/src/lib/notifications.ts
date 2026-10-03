/** Notification types. Mirror backend/src/modules/notifications/notifications.ts. */

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
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}
