/**
 * Custom kite designs. Mirrors backend/src/modules/custom-orders/custom-orders.dto.ts.
 * The geometry here is the single source for how a design looks; mobile/lib/features/designer
 * draws the same shapes with the same numbers.
 */

export const KITE_SHAPES = ["diamond", "patang", "delta", "hexagon"] as const;
export const KITE_SIZES = ["small", "medium", "large"] as const;
export const KITE_PATTERNS = ["none", "stripes", "checks", "halves", "quarters", "border", "stars"] as const;
export const KITE_FONTS = ["sans", "display", "serif"] as const;

export type KiteShape = (typeof KITE_SHAPES)[number];
export type KiteSize = (typeof KITE_SIZES)[number];
export type KitePattern = (typeof KITE_PATTERNS)[number];
export type KiteFont = (typeof KITE_FONTS)[number];

export interface KiteDesign {
  shape: KiteShape;
  size: KiteSize;
  background: string;
  pattern: KitePattern;
  patternColor: string;
  text?: string | null;
  textColor: string;
  font: KiteFont;
  imageUploadId?: string | null;
  imageUrl?: string | null;
  tail: boolean;
  tailColor: string;
}

export interface SavedDesign {
  id: string;
  name: string;
  design: KiteDesign;
  updatedAt: string;
}

export const DEFAULT_DESIGN: KiteDesign = {
  shape: "patang",
  size: "medium",
  background: "#420000",
  pattern: "halves",
  patternColor: "#F6F6F6",
  text: "",
  textColor: "#F6F6F6",
  font: "display",
  tail: true,
  tailColor: "#D4D7DD",
};

export const SHAPE_LABEL: Record<KiteShape, string> = { diamond: "Diamond", patang: "Patang (square)", delta: "Delta", hexagon: "Hexagon" };
export const SIZE_LABEL: Record<KiteSize, string> = { small: "Small (about 45 cm)", medium: "Medium (about 60 cm)", large: "Large (about 75 cm)" };
export const PATTERN_LABEL: Record<KitePattern, string> = {
  none: "Plain",
  stripes: "Stripes",
  checks: "Checks",
  halves: "Halves",
  quarters: "Quarters",
  border: "Border",
  stars: "Stars",
};
export const FONT_LABEL: Record<KiteFont, string> = { sans: "Clean", display: "Bold", serif: "Classic" };

export const COLOR_FIELDS: { key: "background" | "patternColor" | "textColor" | "tailColor"; label: string }[] = [
  { key: "background", label: "Kite colour" },
  { key: "patternColor", label: "Pattern colour" },
  { key: "textColor", label: "Text colour" },
  { key: "tailColor", label: "Tail colour" },
];

/** Kite paper colours offered as swatches; any colour can still be picked. */
export const SWATCHES = ["#420000", "#7A1C1C", "#B3261E", "#E07A1F", "#F2C230", "#2E7D32", "#1565C0", "#4A148C", "#111111", "#D4D7DD", "#EAE9E9", "#F6F6F6"];

// ─── Geometry (viewBox 0 0 200 260; body drawn in the top 200×200) ───────────

type Pt = [number, number];

const BODY: Record<KiteShape, Pt[]> = {
  diamond: [[100, 8], [178, 80], [100, 192], [22, 80]],
  patang: [[100, 14], [186, 100], [100, 186], [14, 100]],
  delta: [[100, 14], [190, 168], [100, 148], [10, 168]],
  hexagon: [[100, 10], [178, 55], [178, 145], [100, 190], [22, 145], [22, 55]],
};

export const SIZE_SCALE: Record<KiteSize, number> = { small: 0.8, medium: 0.9, large: 1 };

const scalePt = ([x, y]: Pt, s: number): Pt => [100 + (x - 100) * s, 100 + (y - 100) * s];

export function bodyPoints(shape: KiteShape, size: KiteSize): Pt[] {
  return BODY[shape].map((p) => scalePt(p, SIZE_SCALE[size]));
}

/** Where the tail starts: the lowest point of the body. */
export function tailAnchor(shape: KiteShape, size: KiteSize): Pt {
  const pts = bodyPoints(shape, size);
  return shape === "delta" ? pts[2] : pts.reduce((a, b) => (b[1] > a[1] ? b : a));
}

/** Wavy tail from the anchor to the bottom of the canvas, with bows every 36px. */
export function tailPath([x, y]: Pt): { line: string; bows: Pt[] } {
  let d = `M ${x} ${y}`;
  const bows: Pt[] = [];
  let cy = y;
  let dir = 1;
  while (cy < 250) {
    const ny = Math.min(cy + 36, 256);
    d += ` Q ${x + 14 * dir} ${(cy + ny) / 2} ${x} ${ny}`;
    if (ny < 256) bows.push([x, ny]);
    cy = ny;
    dir = -dir;
  }
  return { line: d, bows };
}

export const STAR_POINTS: Pt[] = [[70, 60], [130, 60], [100, 100], [70, 140], [130, 140]];

export function starPath([cx, cy]: Pt, r = 11): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(1)},${(cy + rr * Math.sin(rad)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

export const textSize = (text: string) => (text.length > 16 ? 12 : text.length > 10 ? 15 : 19);

// ─── Custom order requests ─────────────────────────────────────────────────

export type CustomOrderStatus = "REQUESTED" | "CLARIFICATION_NEEDED" | "QUOTED" | "ACCEPTED" | "DECLINED" | "REJECTED" | "CANCELLED";

export const CUSTOM_STATUS_LABEL: Record<CustomOrderStatus, string> = {
  REQUESTED: "Waiting for the shop",
  CLARIFICATION_NEEDED: "Shop has a question",
  QUOTED: "Quote received",
  ACCEPTED: "Accepted, order placed",
  DECLINED: "Quote declined",
  REJECTED: "Shop declined",
  CANCELLED: "Cancelled",
};

export const CUSTOM_STATUS_TONE: Record<CustomOrderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  REQUESTED: "info",
  CLARIFICATION_NEEDED: "warning",
  QUOTED: "warning",
  ACCEPTED: "success",
  DECLINED: "neutral",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export interface CustomOrder {
  id: string;
  number: string;
  status: CustomOrderStatus;
  quoteExpired: boolean;
  designName: string;
  design: KiteDesign;
  quantity: number;
  requirements: string;
  budget: number | null;
  deadline: string | null;
  quote: { price: number; deliveryDays: number; note: string | null; validUntil: string; quotedAt: string } | null;
  shop: { id: string; name: string; slug: string; city: string; phone: string | null };
  customer: { id: string; name: string };
  order: { orderNumber: string; status: string } | null;
  messages: { id: string; role: "customer" | "seller" | "system"; body: string; createdAt: string; author: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomShop {
  id: string;
  name: string;
  slug: string;
  city: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
}
