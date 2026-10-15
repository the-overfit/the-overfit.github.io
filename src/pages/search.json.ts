import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Prerendered: a static search index built from the posts at build time.
export const prerender = true;

/** Roughly strip Markdown/MDX down to plain, searchable text. */
function toPlainText(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/^\s*import .*$/gm, ' ') // mdx imports
    .replace(/^---[\s\S]*?---/m, ' ') // stray frontmatter
    .replace(/<[^>]+>/g, ' ') // jsx / html tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[#>*_~|-]/g, ' ') // md punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const items = posts
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((p) => ({
      slug: p.id,
      title: p.data.title,
      description: p.data.description,
      tags: p.data.tags,
      date: new Date(p.data.pubDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      body: toPlainText((p as unknown as { body?: string }).body || '').slice(0, 2500),
    }));

  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json' },
  });
};
