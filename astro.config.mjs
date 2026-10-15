// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';

// Pages stay static (output: 'static' is the default). The clap API route opts
// into on-demand rendering via `export const prerender = false`. The adapter
// lets that route run on Cloudflare, and platformProxy emulates the KV binding
// locally so `astro dev` works without a deploy.
// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
});
