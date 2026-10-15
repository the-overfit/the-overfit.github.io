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
 * Counts persist per-visitor in localStorage (the site is static). To make the
 * total shared across readers, replace loadCounts/saveTotal with calls to a
 * backend (e.g. a serverless counter + KV store) — the rest of the UI is unchanged.
 */
export default function ClapButton({ postId }: Props) {
  const totalKey = `tlr:claps:${postId}`;
  const mineKey = `tlr:claps:mine:${postId}`;

  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState(0);
  const [session, setSession] = useState(0); // claps added in the current burst of activity
  const [bursts, setBursts] = useState<Burst[]>([]);

  const mineRef = useRef(0);
  const totalRef = useRef(0);
  const idRef = useRef(0);
  const idleRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const t = parseInt(localStorage.getItem(totalKey) || '0', 10) || 0;
      const m = parseInt(localStorage.getItem(mineKey) || '0', 10) || 0;
      totalRef.current = t;
      mineRef.current = m;
      setTotal(t);
      setMine(m);
    } catch {
      /* private mode / blocked storage — start from zero */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addOne = useCallback(() => {
    if (mineRef.current >= MAX_PER_READER) return;

    mineRef.current += 1;
    totalRef.current += 1;
    setMine(mineRef.current);
    setTotal(totalRef.current);
    try {
      localStorage.setItem(mineKey, String(mineRef.current));
      localStorage.setItem(totalKey, String(totalRef.current));
    } catch {
      /* ignore */
    }

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
  }, [mineKey, totalKey]);

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
  }, []);

  useEffect(() => () => {
    if (holdRef.current) window.clearInterval(holdRef.current);
    if (idleRef.current) window.clearTimeout(idleRef.current);
  }, []);

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
