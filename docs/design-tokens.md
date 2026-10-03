# GetPatang — Design Tokens

Single source of truth for colors, type and shape. The web app (`web/src/app/globals.css`)
and the mobile app (`mobile/lib/core/theme/`) both implement these values. Change them here first.

## Brand palette (client-provided)

| Token          | Hex       | Use                                                        |
|----------------|-----------|------------------------------------------------------------|
| `maroon-900`   | `#420000` | Primary brand: app bar, hero, primary buttons, links, logo |
| `neutral-50`   | `#F6F6F6` | Page / screen background                                   |
| `neutral-100`  | `#EAE9E9` | Surfaces: inputs, chips, image placeholders                |
| `neutral-200`  | `#D4D7DD` | Borders, dividers, disabled states                         |

## Derived shades (same maroon hue — no new colors)

| Token          | Hex       | Use                                         |
|----------------|-----------|---------------------------------------------|
| `maroon-950`   | `#2A0000` | Pressed state, deepest gradient stop        |
| `maroon-700`   | `#6B1A1A` | Hover, gradients, highlighted text          |
| `maroon-500`   | `#9B3B3B` | Badges, selected icons, rank #1, sale tags  |
| `maroon-100`   | `#F2E4E4` | Soft tint: selected rows, info notes        |
| `ink`          | `#2A1616` | Body text (warm near-black)                 |
| `muted`        | `#5E626B` | Secondary/small text — 5.7:1 on `#F6F6F6`   |
| `white`        | `#FFFFFF` | Cards, sheets, dialogs                      |

The three client neutrals are too light for text. Never put text in `#D4D7DD` or `#EAE9E9`.

## Status colors (meaning only, never decoration)

| Token     | Light     | Dark      |
|-----------|-----------|-----------|
| success   | `#1E7A4F` | `#4CC38A` |
| warning   | `#A15C00` | `#F0A640` |
| danger    | `#C62828` | `#F0716A` |
| info      | `#2F5BD3` | `#8EA8FF` |

## Dark theme

| Token      | Hex       |
|------------|-----------|
| background | `#140606` |
| surface    | `#221010` |
| surface-2  | `#311818` |
| border     | `#4A2423` |
| text       | `#F6F6F6` |
| muted      | `#BBAEAE` |
| primary    | `#E8A7A0` (maroon lightened for contrast on dark) |

## Typography

- **Poppins** 500/600/700 — headings, buttons, scores
- **Inter** 400/500/600 — body, forms, prices (use tabular numbers for prices/rankings)
- **Noto Nastaliq Urdu** 400/600 — Urdu locale

Scale: H1 32 · H2 24 · H3 18 · Body 15 · Small 13 · Label 12 (uppercase, +0.08em)

## Shape

Radius: sm 8 · md 12 (cards, inputs, buttons) · lg 20 (sheets, dialogs) · full (pills).
Hairline borders (`neutral-200`); shadows only on floating elements.
Brand motif: the kite diamond (rotated square) for logo, rank badges, active nav icon.
Geometric kite pattern at 5–7% opacity on maroon surfaces only.
