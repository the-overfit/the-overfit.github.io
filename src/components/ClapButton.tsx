import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_PER_READER = 50;

interface Props {
  postId: string;
}

interface Burst {
  id: number;
  parts: { tx: number; ty: number; size: number }[];
}

/**
 * Medium-style clap, themed as "add a data point".
 *
 * Reads the shared total from /api/claps/[post] (Cloudflare KV) on load, and
 * debounces writes: your claps accumulate client-side and are sent in one POST
 * after you stop. If the API is unavailable (e.g. local dev without a KV
 * binding), it falls back to a per-visitor localStorage count so the UI still works.
 */
export default function ClapButton({ postId }: Props) {
  const api = `/api/claps/${encodeURIComponent(postId)}`;
  const totalKey = `tlr:claps:${postId}`;
  const mineKey = `tlr:claps:mine:${postId}`;

  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState(0);
  const [session, setSession] = useState(0); // claps added in the current burst
  const [bursts, setBursts] = useState<Burst[]>([]);

  const mineRef = useRef(0);
  const totalRef = useRef(0);
  const pendingRef = useRef(0); // claps added but not yet sent to the server
  const serverOkRef = useRef<boolean | null>(null);
  const idRef = useRef(0);
  const idleRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const flushRef = useRef<number | null>(null);

  const readLS = (k: string) => {
    try {
      return parseInt(localStorage.getItem(k) || '0', 10) || 0;
    } catch {
      return 0;
    }
  };
  const writeLS = (k: string, v: number) => {
    try {
      localStorage.setItem(k, String(v));
    } catch {
      /* ignore */
    }
  };

  // Load: "mine" from localStorage; "total" from the server (LS as instant/fallback).
  useEffect(() => {
    const m = readLS(mineKey);
    mineRef.current = m;
    setMine(m);

    const cached = readLS(totalKey);
    totalRef.current = cached;
    setTotal(cached);

    let alive = true;
    (async () => {
      try {
        const res = await fetch(api, { headers: { accept: 'application/json' } });
        const data = await res.json();
        if (!alive) return;
        if (res.ok && !data.unavailable && typeof data.total === 'number') {
          serverOkRef.current = true;
          totalRef.current = data.total;
          setTotal(data.total);
          writeLS(totalKey, data.total);
        } else {
          serverOkRef.current = false;
        }
      } catch {
        if (alive) serverOkRef.current = false;
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(async () => {
    if (pendingRef.current <= 0) return;
    // API unavailable -> keep the optimistic localStorage total, nothing to send.
    if (serverOkRef.current === false) {
      writeLS(totalKey, totalRef.current);
      pendingRef.current = 0;
      return;
    }
    const delta = pendingRef.current;
    pendingRef.current = 0;
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json();
      if (res.ok && !data.unavailable && typeof data.total === 'number') {
        serverOkRef.current = true;
        totalRef.current = data.total;
        setTotal(data.total);
        writeLS(totalKey, data.total);
      } else {
        serverOkRef.current = false;
        writeLS(totalKey, totalRef.current);
      }
    } catch {
      pendingRef.current += delta; // requeue for the next flush
    }
  }, [api, totalKey]);

  const scheduleFlush = useCallback(() => {
    if (flushRef.current) window.clearTimeout(flushRef.current);
    flushRef.current = window.setTimeout(flush, 650);
  }, [flush]);

  const addOne = useCallback(() => {
    if (mineRef.current >= MAX_PER_READER) return;

    mineRef.current += 1;
    totalRef.current += 1;
    pendingRef.current += 1;
    setMine(mineRef.current);
    setTotal(totalRef.current);
    writeLS(mineKey, mineRef.current);

    // floating "+N" bubble that grows while you keep clapping
    setSession((s) => s + 1);
    if (idleRef.current) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => setSession(0), 1000);

    // scatter a few sample points
    const n = 5 + Math.floor(Math.random() * 3);
    const parts = Array.from({ length: n }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 20;
      return {
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 8, // bias upward
        size: 4 + Math.random() * 4,
      };
    });
    const id = ++idRef.current;
    setBursts((b) => [...b, { id, parts }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 750);

    scheduleFlush();
  }, [mineKey, scheduleFlush]);

  const startHold = useCallback(() => {
    addOne();
    if (holdRef.current) return;
    holdRef.current = window.setInterval(addOne, 160);
  }, [addOne]);

  const stopHold = useCallback(() => {
    if (holdRef.current) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
    flush(); // send what we have as soon as the press ends
  }, [flush]);

  // Send any pending claps if the reader leaves the page.
  useEffect(() => {
    const onHide = () => {
      if (pendingRef.current > 0 && serverOkRef.current !== false) {
        const delta = pendingRef.current;
        pendingRef.current = 0;
        try {
          fetch(api, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ delta }),
            keepalive: true,
          });
        } catch {
          /* ignore */
        }
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [api]);

  useEffect(
    () => () => {
      if (holdRef.current) window.clearInterval(holdRef.current);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      if (flushRef.current) window.clearTimeout(flushRef.current);
    },
    []
  );

  const maxed = mine >= MAX_PER_READER;

  return (
    <div className="clap-wrap">
      <div className="clap-caption">Found this useful? Add a data point.</div>

      <div className="clap-btnrow">
        <button
          type="button"
          className="clap-btn"
          aria-label={`Clap for this post. You've clapped ${mine} of ${MAX_PER_READER} times.`}
          disabled={maxed}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!maxed) startHold();
          }}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !maxed) {
              e.preventDefault();
              addOne();
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18 H21" stroke="currentColor" strokeWidth="2" opacity="0.6" />
            <path d="M4 18 C 9 18 9 6 12 5 C 15 6 15 18 20 18" stroke="currentColor" strokeWidth="2.2" />
            <circle cx="12" cy="5" r="2" fill="currentColor" />
          </svg>

          {bursts.map((b) => (
            <span key={b.id}>
              {b.parts.map((p, i) => (
                <span
                  key={i}
                  className="clap-particle"
                  style={{
                    '--tx': `${p.tx}px`,
                    '--ty': `${p.ty}px`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                  } as React.CSSProperties}
                />
              ))}
            </span>
          ))}
        </button>

        {session > 0 && (
          <span className="clap-float" key={session}>+{session}</span>
        )}

        <span className="clap-count">{total}</span>
      </div>

      <div className="clap-mine">
        {maxed ? "that's the max — thank you!" : mine > 0 ? `you clapped ${mine}` : 'tap, or hold for more'}
      </div>
    </div>
  );
}
