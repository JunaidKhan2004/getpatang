import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_DESIGN } from "@/lib/designer";

import { PageBody } from "./content/page-body";
import { KitePreview } from "./designer/kite-preview";

afterEach(cleanup);

describe("PageBody", () => {
  it("renders headings, paragraphs and lists", () => {
    render(<PageBody body={"## Safety first\n\nFly in open fields.\nNever near wires.\n\n- Cotton string only\n- No metal or glass"} />);
    expect(screen.getByRole("heading", { level: 2, name: "Safety first" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Cotton string only", "No metal or glass"]);
    expect(screen.getByText(/Fly in open fields/).textContent).toContain("Never near wires.");
  });

  it("never turns staff text into HTML", () => {
    const { container } = render(<PageBody body={'<img src=x onerror="alert(1)"> <script>alert(2)</script>'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });
});

describe("KitePreview", () => {
  it("draws the body, pattern, tail and text", () => {
    const { container } = render(<KitePreview design={{ ...DEFAULT_DESIGN, shape: "diamond", pattern: "stripes", text: "FALCON" }} title="My kite" />);
    expect(screen.getByRole("img", { name: "My kite" })).toBeTruthy();
    const body = container.querySelector("polygon");
    expect(body?.getAttribute("points")?.split(" ")).toHaveLength(4);
    expect(container.querySelectorAll("rect").length).toBe(9);
    expect(container.querySelector("text")?.textContent).toBe("FALCON");
    expect(container.querySelector("path")).toBeTruthy(); // tail
  });

  it("omits the tail and logo when not chosen", () => {
    const { container } = render(<KitePreview design={{ ...DEFAULT_DESIGN, tail: false, text: "", imageUrl: null }} />);
    expect(container.querySelector("image")).toBeNull();
    expect(container.querySelector("text")).toBeNull();
    expect(container.querySelectorAll("path").length).toBe(0);
  });

  it("places an uploaded logo", () => {
    const { container } = render(<KitePreview design={{ ...DEFAULT_DESIGN, imageUrl: "https://cdn.test/logo.png" }} />);
    expect(container.querySelector("image")?.getAttribute("href")).toBe("https://cdn.test/logo.png");
  });
});
