---
name: avoid-ai-look
description: Strict visual rules so informative videos and HyperFrames animations look human-directed and architectural, never like an AI/SaaS web template
metadata:
  type: feedback
---

Never use generic AI/SaaS dashboard tics in `ShortInfo.tsx` or `scripts/render-hyperframes.mjs`:

1. **Zero rounded callout boxes with colored borders:** Never use `border-radius: 12px/16px` paired with `border-left: 6px solid <accent>` or `border: 2px solid <accent>`, and never use floating drop shadows (`box-shadow: 0 12px 40px ...`). Use `0px` radius and a continuous `1px` architectural hairline grid (`rgba(248, 250, 252, 0.15)` on dark, `rgba(15, 23, 42, 0.14)` on paper).
2. **Zero synthetic pill badges:** Never add `.badge` pills with `•` dots, pulsing status indicators, fake HUD brackets, or decorative progress bars that represent qualitative ideas.
3. **One dominant tabular metric per block:** In HyperFrames animations, pair full-bleed dark (`--bg-dark`) and paper (`--bg-light`) blocks with a single oversized tabular figure (`font-variant-numeric: tabular-nums` in `800` weight) and a concise label.
4. **Borderless editorial subtitles:** Never wrap lower-third subtitles in a rounded dark player box. Place high-contrast typography over a subtle bottom gradient scrim (on camera) or inside a clean `1px`-bordered bottom grid cell (on animations), highlighting emphasized content words with color and a `3px` underline.
5. **Single persistent domain signature:** Keep the brand domain visible 100% of the time in the bottom-right footer cell — never duplicate it in header pills or fake CTA buttons.
6. **Grammatical Spanish splits:** Never end a subtitle page or upper kinetic card on a proclitic, article, preposition, or copula (`el`, `la`, `de`, `que`, `y`, `es`), and never isolate a function word on its own line.
