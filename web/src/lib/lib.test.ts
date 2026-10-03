import { describe, expect, it } from "vitest";

import { bodyPoints, DEFAULT_DESIGN, KITE_SHAPES, KITE_SIZES, starPath, tailAnchor, tailPath, textSize } from "./designer";
import { EVENT_TYPE_LABEL, EVENT_TYPES } from "./events";
import { formatPKR, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "./market";
import { timeAgo } from "./notifications";
import { safeNext } from "./validation";

describe("safeNext (open-redirect guard)", () => {
  it("allows only same-site paths", () => {
    expect(safeNext("/account/orders")).toBe("/account/orders");
    expect(safeNext("https://evil.test")).toBe("/account");
    expect(safeNext("//evil.test")).toBe("/account");
    expect(safeNext("/\\evil.test")).toBe("/account");
    expect(safeNext(null, "/")).toBe("/");
  });
});

describe("kite geometry", () => {
  // The same numbers are asserted in mobile/test/kite_design_test.dart, so both apps draw identical kites.
  it("matches the mobile painter", () => {
    expect(bodyPoints("diamond", "large")[0]).toEqual([100, 8]);
    expect(bodyPoints("patang", "small")[1][0]).toBeCloseTo(168.8);
    expect(tailAnchor("delta", "large")).toEqual([100, 148]);
    expect(tailAnchor("hexagon", "medium")[1]).toBeCloseTo(181);
  });

  it("keeps every shape and size inside the canvas", () => {
    for (const shape of KITE_SHAPES) {
      for (const size of KITE_SIZES) {
        for (const [x, y] of bodyPoints(shape, size)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(200);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(200);
        }
      }
    }
  });

  it("draws the tail to the bottom with bows along it", () => {
    const { line, bows } = tailPath(tailAnchor(DEFAULT_DESIGN.shape, DEFAULT_DESIGN.size));
    expect(line.startsWith("M 100 ")).toBe(true);
    expect(line.trim().endsWith(" 256")).toBe(true);
    expect(bows.length).toBeGreaterThan(0);
    expect(bows.every(([x, y]) => x === 100 && y < 256)).toBe(true);
  });

  it("builds a closed ten-point star and shrinks long text", () => {
    expect(starPath([100, 100]).match(/L/g)).toHaveLength(9);
    expect(starPath([100, 100]).endsWith("Z")).toBe(true);
    expect(textSize("TEAM")).toBeGreaterThan(textSize("A very long team name"));
  });
});

describe("labels and formatting", () => {
  it("formats rupees with thousands separators", () => {
    expect(formatPKR(1500)).toBe("Rs 1,500");
    expect(formatPKR(150000)).toBe("Rs 150,000");
  });

  it("has a label for every status the API can return", () => {
    for (const s of ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"] as const) {
      expect(ORDER_STATUS_LABEL[s]).toBeTruthy();
    }
    for (const s of ["PENDING", "VERIFYING", "PAID", "FAILED", "REFUNDED"] as const) expect(PAYMENT_STATUS_LABEL[s]).toBeTruthy();
    for (const t of EVENT_TYPES) expect(EVENT_TYPE_LABEL[t]).toBeTruthy();
  });

  it("describes notification times simply", () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    expect(timeAgo("2026-10-02T11:59:30Z", now)).toBe("Just now");
    expect(timeAgo("2026-10-02T11:45:00Z", now)).toBe("15 min ago");
    expect(timeAgo("2026-10-02T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-01T09:00:00Z", now)).toBe("Yesterday");
    expect(timeAgo("2026-09-20T09:00:00Z", now)).toMatch(/2026/);
  });
});
