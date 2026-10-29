import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Full-text search backed by Pagefind.
 *
 * Pagefind indexes the built HTML at `astro build` time and shards the index
 * into fragments, so the browser only downloads the pieces a given query needs.
 * That keeps search fast whether the site has four posts or forty thousand —
 * nothing like the whole-index-in-the-browser approach a client-side fuzzy
 * matcher needs. The runtime lives at `/pagefind/pagefind.js`; we load it lazily
 * the first time search opens so it never ships in the main bundle.
 */

interface Result {
  url: string;
  title: string;
  excerpt: string; // sanitized HTML from Pagefind, with matches wrapped in <mark>
}

// Loaded once, the first time the user opens search.
let pagefindPromise: Promise<any> | null = null;
function loadPagefind(): Promise<any> {
  if (!pagefindPromise) {
    const url = `${import.meta.env.BASE_URL}pagefind/pagefind.js`.replace('//', '/');
    pagefindPromise = import(/* @vite-ignore */ url)
      .then(async (pf) => {
        await pf.options?.({ excerptLength: 22 });
        await pf.init?.();
        return pf;
      })
      .catch(() => null);
  }
  return pagefindPromise;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

export default function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openSearch = useCallback(() => {
    setOpen(true);
    loadPagefind().then((pf) => setStatus(pf ? 'ready' : 'error'));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActive(0);
  }, []);

  // global shortcuts: "/" or Cmd/Ctrl+K to open, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (!open && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
        if (typing && e.key === '/') return;
        e.preventDefault();
        openSearch();
      } else if (open && e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, openSearch, close]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Debounced query against Pagefind. Each result's body loads on demand, so we
  // only pull the data for the handful of rows we actually show.
  useEffect(() => {
    const term = query.trim();
    setActive(0);
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const pf = await loadPagefind();
      if (cancelled) return;
      if (!pf) {
        setStatus('error');
        return;
      }
      const search = await pf.search(term);
      if (cancelled || !search) return;
      const data = await Promise.all(search.results.slice(0, 8).map((r: any) => r.data()));
      if (cancelled) return;
      setResults(
        data.map((d: any) => ({
          url: d.url,
          title: d.meta?.title || d.url,
          excerpt: d.excerpt as string,
        }))
      );
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const go = useCallback((url: string) => {
    window.location.href = url;
  }, []);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active].url);
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <>
      <button type="button" className="search-trigger" onClick={openSearch} aria-label="Search posts">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20 L16 16" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="search-trigger-label">Search</span>
        <kbd>/</kbd>
      </button>

      {open && (
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search posts"
          onMouseDown={close}
        >
          <div className="search-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="search-inputrow">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20 L16 16" stroke="currentColor" strokeWidth="2" />
              </svg>
              <input
                ref={inputRef}
                className="search-input"
                type="search"
                placeholder="Search the full text…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="search-close" onClick={close}>esc</button>
            </div>

            <ul className="search-results">
              {status === 'error' && (
                <li className="search-empty">
                  Search index isn’t available yet — build the site to generate it.
                </li>
              )}
              {status !== 'error' && !hasQuery && (
                <li className="search-empty">Type to search across every post.</li>
              )}
              {status !== 'error' && hasQuery && results.length === 0 && (
                <li className="search-empty">No matches for “{query}”.</li>
              )}
              {results.map((r, i) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    className={`search-item${i === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      go(r.url);
                    }}
                  >
                    <span
                      className="search-item-title"
                      dangerouslySetInnerHTML={{ __html: escapeHtml(r.title) }}
                    />
                    <span
                      className="search-item-snip"
                      dangerouslySetInnerHTML={{ __html: r.excerpt }}
                    />
                  </a>
                </li>
              ))}
            </ul>

            <div className="search-hint">↑↓ navigate · ↵ open · esc close</div>
          </div>
        </div>
      )}
    </>
  );
}
