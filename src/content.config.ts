import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** social-share image: a path like /og/my-post.png (in public/) or a full
     *  URL. Omit to fall back to the site-wide /og-default.png card.
     *  For best results make it 1200×630. */
    ogImage: z.string().optional(),
  }),
});

export const collections = { posts };
