'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { LEARN_TOPICS, type LearnTopic } from '../../lib/insights/demo';
import { PlatformShell } from '../platform/PlatformShell';

export function EducationHubExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const categories = useMemo(() => Array.from(new Set(LEARN_TOPICS.map((t) => t.category))), []);
  const [cat, setCat] = useState<string>('all');
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return LEARN_TOPICS.filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.body.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [deferred, cat]);

  const active: LearnTopic | undefined = LEARN_TOPICS.find((t) => t.id === activeId);

  return (
    <PlatformShell
      title="Learning Center"
      subtitle="Beginner-friendly guides — clear language, no jargon by default."
      reassure="Learn at your pace. Lessons educate; they never tell you what to buy or sell."
      backHref="/dashboard"
      backLabel="Wallet"
      actions={
        <>
          <Link href="/assistant" className="cx-btn cx-btn--primary">
            Ask a question
          </Link>
          <Link href="/settings/help" className="cx-btn cx-btn--ghost">
            Help & FAQ
          </Link>
        </>
      }
    >
      {active ? (
        <section className="cx-panel" aria-labelledby="learn-lesson-title">
          <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setActiveId(null)}>
            ← All topics
          </button>
          <p className="cx-meta">
            {active.category} · about {active.minutes} min
          </p>
          <h2 id="learn-lesson-title">{active.title}</h2>
          {active.body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          {active.href ? (
            <div className="cx-platform__actions">
              <Link href={active.href} className="cx-btn cx-btn--primary">
                {active.hrefLabel ?? 'Open related'}
              </Link>
              <Link href="/assistant" className="cx-btn cx-btn--ghost">
                Ask a follow-up
              </Link>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <label className="cx-field">
            <span>Search topics</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gas, recovery, staking…"
            />
          </label>

          <div className="cx-chips" role="group" aria-label="Categories">
            <button
              type="button"
              className={`cx-chip${cat === 'all' ? ' is-on' : ''}`}
              aria-pressed={cat === 'all'}
              onClick={() => setCat('all')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`cx-chip${cat === c ? ' is-on' : ''}`}
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="cx-empty">
              <h2>No topics</h2>
              <p>Try another search word.</p>
            </div>
          ) : (
            <ul className="cx-list">
              {filtered.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.title}</strong>
                    <p className="cx-meta">
                      {t.category} · about {t.minutes} min · {t.summary}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="cx-btn cx-btn--ghost"
                    onClick={() => setActiveId(t.id)}
                  >
                    Read
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PlatformShell>
  );
}
