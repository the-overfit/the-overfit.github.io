// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import pagefind from 'astro-pagefind';

// Fully static site (output: 'static' is the default), deployed to GitHub Pages
// at the org root URL.
// https://astro.build/config
export default defineConfig({
  site: 'https://the-overfit.github.io',
  integrations: [react(), mdx(), pagefind()],
});
