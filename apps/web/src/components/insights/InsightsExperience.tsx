'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { DEMO_HOLDINGS } from '../../lib/dashboard-demo';
import { buildPortfolioInsights, computePortfolioHealthScore } from '../../lib/insights/demo';
import { PlatformShell } from '../platform/PlatformShell';

export function InsightsExperience(): ReactElement {
  const [score, setScore] = useState(0);
  const [factors, setFactors] = useState(() => computePortfolioHealthScore(DEMO_HOLDINGS).factors);
  const [insights, setInsights] = useState(() => buildPortfolioInsights(DEMO_HOLDINGS));

  useEffect(() => {
    const health = computePortfolioHealthScore(DEMO_HOLDINGS);
    setScore(health.score);
    setFactors(health.factors);
    setInsights(buildPortfolioInsights(DEMO_HOLDINGS));
  }, []);

  const open = factors.filter((f) => !f.ok);

  return (
    <PlatformShell
      title="Insights"
      subtitle="Gentle observations — educate, never pressure."
      reassure="Educational tips from on-device holdings. They never move funds or recommend trades."
      backHref="/portfolio"
      backLabel="Portfolio"
      actions={
        <>
          <Link href="/assistant" className="cx-btn cx-btn--ghost">
            Ask Assistant
          </Link>
          <Link href="/settings/notifications" className="cx-btn cx-btn--primary">
            Alert preferences
          </Link>
        </>
      }
    >
      <div className="cx-alert cx-alert--info" role="status">
        Insights use sample holdings until live balances connect. Labels like “estimate” mean the
        figure is illustrative — not a prediction.
      </div>

      <section className="cx-panel">
        <h2>How insights are made</h2>
        <p className="cx-meta">
          Rules look at allocation, 24h moves, and security prefs on this device. Nothing here is
          personalized investment advice.
        </p>
      </section>

      <section className="cx-panel">
        <h2>Portfolio health</h2>
        <div className="cx-score-row">
          <div
            className="cx-score-ring"
            style={{ ['--cx-score' as string]: score }}
            aria-label={`Portfolio health ${score} percent`}
          >
            <strong>{score}</strong>
          </div>
          <div>
            <p className="cx-meta">
              Encourages diversification, security, and recovery — never shames. Improve any item
              below at your pace.
            </p>
            {open.length ? (
              <ul className="cx-list">
                {open.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <div>
                      <strong>{f.label}</strong>
                      <p className="cx-meta">{f.why}</p>
                    </div>
                    <Link href={f.href} className="cx-btn cx-btn--ghost">
                      {f.action}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cx-meta">Looking solid — keep reviewing permissions and recovery.</p>
            )}
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Intelligent insights</h2>
        <ul className="cx-list">
          {insights.map((i) => (
            <li key={i.id}>
              <div>
                <strong>{i.title}</strong>
                <p className="cx-meta">{i.detail}</p>
                <span
                  className={`cx-badge cx-badge--${i.severity === 'watch' ? 'pending' : 'confirmed'}`}
                >
                  {i.badge}
                </span>
              </div>
              {i.href ? (
                <Link href={i.href} className="cx-btn cx-btn--ghost">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="cx-meta">
        Prefer fewer tips? Tune <Link href="/settings/notifications">insight alerts</Link> anytime.
      </p>
    </PlatformShell>
  );
}
