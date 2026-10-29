# The Overfit

A hand-drawn, illustrated blog for breaking down the hard parts of machine learning —
sketchy diagrams, little animations, and as little jargon as it can get away with.

Built with **[Astro](https://astro.build/)** (static, fast, zero-JS by default),
**React islands** for the interactive bits, and **[rough.js](https://roughjs.com/)**
for the hand-drawn look.

## Quick start

```bash
npm install
npm run dev      # local dev at http://localhost:4321
npm run build    # static build into dist/
npm run preview  # preview the production build
```

Requires [Node.js](https://nodejs.org/) 18 or newer.

## How it's organized

```
src/
  styles/global.css          ← the whole visual identity (design tokens at the top)
  content.config.ts          ← post schema (title, description, pubDate, tags, draft)
  content/posts/*.mdx        ← the posts — Markdown with components dropped in
  components/
    LossCurve.tsx            ← React island: sketchy diagram with a rolling ball
    Annotate.tsx             ← React island: self-drawing underline / circle / etc.
    Figure.astro             ← captioned card with a sketched border
    MarginNote.astro         ← rotated aside with a sketched border
  layouts/
    BaseLayout.astro         ← page shell, fonts, and the sketch-border script
    PostLayout.astro         ← post header + prose
  pages/
    index.astro              ← post list (home)
    about.astro
    posts/[...slug].astro    ← renders each post
```

## Writing a post

Create `src/content/posts/my-post.mdx`:

```mdx
---
title: My explainer
description: One-line summary for the home page.
pubDate: 2026-10-20
tags: ['intuition']
draft: false
---

import Annotate from '../../components/Annotate.tsx';

Plain Markdown, plus <Annotate client:visible type="circle">a circled phrase</Annotate>.
```

Interactive components need a `client:*` directive — `client:visible` is a good default.

## Making it yours

- **Colors & fonts** — edit the design tokens at the top of `src/styles/global.css`.
- **New diagram types** — copy `LossCurve.tsx`; it shows the rough.js + theme-aware +
  replay pattern.
- **Sketchy borders** — add `data-sketch-frame` to any element.

## License

© The Overfit. All rights reserved.
