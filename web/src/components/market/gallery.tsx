"use client";

import { useState } from "react";

import type { ImageRef } from "@/lib/market";

import { ProductImage } from "./product-card";

export function Gallery({ images, title }: { images: ImageRef[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;
  return (
    <div className="grid gap-3">
      <ProductImage image={current} title={title} className="aspect-square w-full rounded-md border border-border" />
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Product photos">
          {images.map((img, i) => (
            <button
              key={img.url}
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1} of ${images.length}`}
              onClick={() => setIndex(i)}
              className="shrink-0 overflow-hidden rounded-md border-2 border-transparent aria-selected:border-primary"
            >
              <ProductImage image={img} title={title} className="size-16" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
