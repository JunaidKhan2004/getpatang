/** Community types. Mirror backend/src/modules/community. */

export interface Author {
  id: string;
  name: string;
  city: string | null;
  avatarUrl: string | null;
}

export interface PostView {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: Author;
  media: { kind: "image" | "video"; url: string; mimeType: string }[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  isMine: boolean;
}

export interface CommentView {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
  isMine: boolean;
  replies?: CommentView[];
}

export interface CommunityProfile extends Author {
  bio: string | null;
  followers: number;
  following: number;
  posts: number;
  isFollowing: boolean;
  isBlocked: boolean;
  isMe: boolean;
  memberSince: string;
}

export interface ModerationItem {
  targetType: string;
  targetId: string;
  reportCount: number;
  latestAt: string;
  reasons: Record<string, number>;
  reports: { id: string; reason: string; details: string | null; status: string; action: string | null; resolution: string | null; createdAt: string; reporter: { id: string; fullName: string } }[];
  preview: { text: string; status: string | null; note?: string | null; author?: { id: string; fullName: string }; media?: { kind: string; url: string }[]; link: string | null; adminLink?: string } | null;
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "dangerous", label: "Dangerous or illegal kite materials" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "misinformation", label: "False information" },
  { value: "other", label: "Something else" },
];

/** "5m", "3h", "2d", or a date for older items. */
export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}
