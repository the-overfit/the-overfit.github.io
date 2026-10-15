import type { APIRoute } from 'astro';

// On-demand (runs on Cloudflare), not prerendered.
export const prerender = false;

const MAX_DELTA = 50; // mirrors the per-reader cap on the client
const ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** Cloudflare KV binding, exposed by the adapter on locals.runtime.env. */
function getKV(locals: any): any | null {
  return locals?.runtime?.env?.CLAPS ?? null;
}

const keyFor = (post: string) => `claps:${post}`;

export const GET: APIRoute = async ({ params, locals }) => {
  const post = params.post ?? '';
  if (!ID_RE.test(post)) return json({ error: 'invalid post id' }, 400);

  const kv = getKV(locals);
  if (!kv) return json({ total: 0, unavailable: true });

  const raw = await kv.get(keyFor(post));
  return json({ total: parseInt(raw || '0', 10) || 0 });
};

export const POST: APIRoute = async ({ params, locals, request }) => {
  const post = params.post ?? '';
  if (!ID_RE.test(post)) return json({ error: 'invalid post id' }, 400);

  const kv = getKV(locals);
  if (!kv) return json({ total: 0, unavailable: true });

  let delta = 0;
  try {
    const body = (await request.json()) as { delta?: unknown };
    delta = Number(body?.delta) || 0;
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  delta = Math.max(0, Math.min(MAX_DELTA, Math.floor(delta)));

  const key = keyFor(post);
  const current = parseInt((await kv.get(key)) || '0', 10) || 0;
  const next = current + delta;
  if (delta > 0) await kv.put(key, String(next));

  return json({ total: next });
};
