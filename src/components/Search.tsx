import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';

interface Item {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  body: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

/** Escape text, then wrap case-insensitive matches of `q` in <mark>. */
function highlight(text: string, q: string): string {
  const safe = escapeHtml(text);
  const term = q.trim();
  if (!term) return safe;
  try {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  } catch {
    return safe;
  }
}

/** A short snippet of body text around the first match of the query. */
function snippet(item: Item, q: string): string {
  const term = q.trim().toLowerCase();
  const base = item.description || item.body;
  if (!term) return base.slice(0, 120);
  const hay = (item.body || item.description).toLowerCase();
  const idx = hay.indexOf(term);
  if (idx === -1) return base.slice(0, 120);
  const src = item.body || item.description;
  const start = Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + src.slice(start, start + 120).trim() + '…';
}

export default function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Item[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const res = await fetch('/search.json');
      setData(await res.json());
    } catch {
      setData([]);
    }
  }, []);

  const openSearch = useCallback(() => {
    setOpen(true);
    load();
  }, [load]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
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

  const fuse = useMemo(
    () =>
      data
        ? new Fuse(data, {
            keys: [
              { name: 'title', weight: 0.5 },
              { name: 'tags', weight: 0.3 },
              { name: 'description', weight: 0.2 },
              { name: 'body', weight: 0.15 },
            ],
            threshold: 0.4,
            ignoreLocation: true,
            minMatchCharLength: 2,
          })
        : null,
    [data]
  );

  const results: Item[] = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.slice(0, 6);
    if (!fuse) return [];
    return fuse.search(query).slice(0, 8).map((r) => r.item);
  }, [data, fuse, query]);

  useEffect(() => setActive(0), [query]);

  const go = useCallback((slug: string) => {
    window.location.href = `/posts/${slug}/`;
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
      go(results[active].slug);
    }
  };

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
                placeholder="Search explainers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="search-close" onClick={close}>esc</button>
            </div>

            <ul className="search-results">
              {data === null && <li className="search-empty">Loading…</li>}
              {data !== null && results.length === 0 && (
                <li className="search-empty">No matches for “{query}”.</li>
              )}
              {results.map((r, i) => (
                <li key={r.slug}>
                  <a
                    href={`/posts/${r.slug}/`}
                    className={`search-item${i === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      go(r.slug);
                    }}
                  >
                    <span
                      className="search-item-title"
                      dangerouslySetInnerHTML={{ __html: highlight(r.title, query) }}
                    />
                    <span
                      className="search-item-snip"
                      dangerouslySetInnerHTML={{ __html: highlight(snippet(r, query), query) }}
                    />
                    {r.tags.length > 0 && (
                      <span className="search-item-tags">
                        {r.tags.map((t) => (
                          <span key={t} className="search-item-tag">#{t}</span>
                        ))}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>

            <div className="search-hint">
              {query.trim() ? '' : 'recent posts · '}↑↓ navigate · ↵ open · esc close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
