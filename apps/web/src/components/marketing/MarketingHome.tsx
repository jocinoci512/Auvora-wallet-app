'use client';

import Link from 'next/link';
import { useId, useState, type ReactElement, type ReactNode, type SVGProps } from 'react';
import { Reveal, useInView, usePrefersReducedMotion } from './motion';
import { WalletPreview } from './WalletPreview';

function Icon({
  children,
  ...rest
}: SVGProps<SVGSVGElement> & { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

const FEATURES = [
  {
    title: 'Multi-chain by design',
    body: 'One calm stage for Bitcoin, Ethereum, Solana, BNB, Polygon, and Tron — without a maze of disconnected apps.',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </Icon>
    ),
  },
  {
    title: 'Portfolio clarity',
    body: 'Editorial balances and calm charts — signal first, decoration never. Demo holdings are labeled as demonstration.',
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" />
      </Icon>
    ),
  },
  {
    title: 'Self-custody first',
    body: 'Keys stay on your devices. Auvora servers sync identity and preferences — never seed phrases.',
    icon: (
      <Icon>
        <path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z" />
      </Icon>
    ),
  },
  {
    title: 'Readable confirms',
    body: 'Plain-language reviews before irreversible moments — no security theater.',
    icon: (
      <Icon>
        <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
      </Icon>
    ),
  },
  {
    title: 'Mobile signing',
    body: 'Android holds the vault. Pair the web companion via Reown when you need desktop context.',
    icon: (
      <Icon>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </Icon>
    ),
  },
  {
    title: 'One account layer',
    body: 'Sign in to sync labels, watch-only lists, sessions, and preferences across devices — not private keys.',
    icon: (
      <Icon>
        <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </Icon>
    ),
  },
];

const PROOF = [
  { label: 'Self-custody first', detail: 'Keys stay yours' },
  { label: 'Quiet interface', detail: 'Hierarchy over neon' },
  { label: 'Honest Alpha', detail: 'No fabricated metrics' },
  { label: 'Broadcast off', detail: 'Safety kill switch' },
  { label: 'Cross-device account', detail: 'Identity — not seeds' },
];

const FRUSTRATIONS = [
  {
    pain: 'Wallets that shout',
    relief: 'Auvora whispers clarity — hierarchy over neon.',
  },
  {
    pain: 'Hidden fees at the last second',
    relief: 'Fees and networks appear before you commit.',
  },
  {
    pain: 'Twenty tabs to find Send',
    relief: 'Three verbs on the stage. Everything else yields.',
  },
  {
    pain: 'Security that scares you',
    relief: 'Plain-language confirms. Trust without theater.',
  },
];

const NETWORKS_LIVE = [
  { name: 'Bitcoin', code: 'BTC' },
  { name: 'Ethereum', code: 'ETH' },
  { name: 'Solana', code: 'SOL' },
  { name: 'BNB Smart Chain', code: 'BNB' },
  { name: 'Polygon', code: 'POL' },
  { name: 'Tron', code: 'TRX' },
];

const NETWORKS_SOON = [
  { name: 'Avalanche', code: 'AVAX' },
  { name: 'Base', code: 'BASE' },
  { name: 'Arbitrum', code: 'ARB' },
  { name: 'Optimism', code: 'OP' },
];

const FAQS = [
  {
    q: 'Is Auvora a custodial wallet?',
    a: 'No. Auvora is built for self-custody. Private keys and recovery phrases stay on your devices. The Auvora account syncs identity and preferences — never seed material.',
  },
  {
    q: 'Which networks are live today?',
    a: 'Bitcoin, Ethereum, Solana, BNB Smart Chain, Polygon, and Tron are the supported set. Avalanche, Base, Arbitrum, and Optimism are marked Coming soon — not claimed as live.',
  },
  {
    q: 'Can I swap, stake, or bridge now?',
    a: 'Those surfaces exist as Coming soon / preview UI. Live broadcast remains off in Version 1.0 Alpha. Prefer mobile signing via Reown when pairing is configured.',
  },
  {
    q: 'Does the website store my recovery phrase?',
    a: 'Never. Do not enter a real recovery phrase into the web companion. Encrypted cross-device wallet-secret sync is a separate security milestone.',
  },
  {
    q: 'Does Auvora work on mobile and desktop?',
    a: 'Android is the self-custody home. Web is the calm companion for portfolio context, account settings, and pairing — one ecosystem, not unrelated products.',
  },
];

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const panelId = useId();
  const btnId = useId();
  return (
    <div className={`mh-faq__item${open ? ' is-open' : ''}`}>
      <h3>
        <button
          type="button"
          id={btnId}
          className="mh-faq__trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{q}</span>
          <span className="mh-faq__chevron" aria-hidden />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        className="mh-faq__panel"
        hidden={!open}
      >
        <p>{a}</p>
      </div>
    </div>
  );
}

export function MarketingHome(): ReactElement {
  usePrefersReducedMotion();
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [statsRef] = useInView<HTMLDivElement>();
  const [showcaseTab, setShowcaseTab] = useState<'portfolio' | 'activity' | 'security'>(
    'portfolio',
  );

  return (
    <main className="mh" id="top">
      <div className="mh-atmosphere" aria-hidden />

      <section className="mh-hero" aria-labelledby="mh-hero-title">
        <div className="mh-hero__copy">
          <p className="mh-brand">Auvora</p>
          <h1 id="mh-hero-title" className="mh-hero__title">
            The quiet operating system for digital value.
          </h1>
          <p className="mh-hero__lede">
            A premium self-custody wallet that feels as calm as Apple, as precise as Stripe —
            without the noise of typical crypto. Version 1.0 Alpha companion.
          </p>
          <div className="mh-hero__cta">
            <Link href="/wallets/onboarding" className="mh-btn mh-btn--primary">
              Get started
            </Link>
            <Link href="/dashboard" className="mh-btn mh-btn--ghost">
              Open app
            </Link>
          </div>
          <ul className="mh-hero__trust">
            <li>Self-custody</li>
            <li>Readable confirms</li>
            <li>Multi-chain</li>
            <li>Broadcast off</li>
          </ul>
          <p className="mh-hero__chains-label">Supported networks</p>
          <ul className="mh-hero__chains">
            {NETWORKS_LIVE.map((n) => (
              <li key={n.code}>{n.code}</li>
            ))}
          </ul>
        </div>
        <div className="mh-hero__visual">
          <WalletPreview />
          <p className="mh-hero__demo-note">
            Portfolio preview is a demonstration — not live balances.
          </p>
        </div>
      </section>

      <section className="mh-section mh-proof" aria-labelledby="mh-proof-title">
        <Reveal>
          <p className="mh-eyebrow">Built for confidence</p>
          <h2 id="mh-proof-title" className="mh-h2">
            Trust, without the theater.
          </h2>
        </Reveal>
        <div className="mh-proof__grid">
          {PROOF.map((p, i) => (
            <Reveal key={p.label} delay={i * 60}>
              <article className="mh-proof__item">
                <h3>{p.label}</h3>
                <p>{p.detail}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mh-proof__stats" ref={statsRef}>
          <div className="mh-stat">
            <p className="mh-stat__value">{NETWORKS_LIVE.length}</p>
            <p className="mh-stat__label">Networks supported</p>
          </div>
          <div className="mh-stat">
            <p className="mh-stat__value">1</p>
            <p className="mh-stat__label">Ecosystem — mobile + web</p>
          </div>
          <div className="mh-stat">
            <p className="mh-stat__value">0</p>
            <p className="mh-stat__label">Fabricated user counts</p>
          </div>
        </div>
      </section>

      <section className="mh-section mh-features" aria-labelledby="mh-features-title">
        <Reveal>
          <p className="mh-eyebrow">Capabilities</p>
          <h2 id="mh-features-title" className="mh-h2">
            Everything essential. Nothing loud.
          </h2>
          <p className="mh-lede">
            Features earn their place by reducing friction — not by filling a grid. Swap, bridge,
            staking, hardware, and encrypted cloud backup are Coming soon — not claimed as live.
          </p>
        </Reveal>
        <div className="mh-features__grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 5) * 40}>
              <article className="mh-feature">
                <div className="mh-feature__icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mh-section mh-showcase" aria-labelledby="mh-showcase-title">
        <div className="mh-showcase__layout">
          <Reveal>
            <p className="mh-eyebrow">Product</p>
            <h2 id="mh-showcase-title" className="mh-h2">
              A wallet that feels alive — never restless.
            </h2>
            <p className="mh-lede">
              Portfolio, activity, security, send, and receive in one composed surface. Motion
              explains change; it never performs.
            </p>
            <div className="mh-showcase__tabs" role="tablist" aria-label="Product views">
              {(
                [
                  ['portfolio', 'Portfolio'],
                  ['activity', 'Activity'],
                  ['security', 'Security'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={showcaseTab === id}
                  className={showcaseTab === id ? 'is-active' : undefined}
                  onClick={() => setShowcaseTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="mh-showcase__points">
              {showcaseTab === 'portfolio' ? (
                <>
                  <li>Balance-first home stage</li>
                  <li>Demonstration holdings clearly labeled</li>
                  <li>Quiet sparkline context</li>
                </>
              ) : null}
              {showcaseTab === 'activity' ? (
                <>
                  <li>Unified activity architecture</li>
                  <li>Mobile history remains authoritative</li>
                  <li>Web companion stays preview-honest</li>
                </>
              ) : null}
              {showcaseTab === 'security' ? (
                <>
                  <li>PIN on device where available</li>
                  <li>Recovery phrase education — never uploaded</li>
                  <li>Devices & sessions without fake sync claims</li>
                </>
              ) : null}
            </ul>
          </Reveal>
          <Reveal delay={80}>
            <div className="mh-showcase__stage">
              <WalletPreview />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mh-section mh-security" aria-labelledby="mh-security-title">
        <Reveal>
          <p className="mh-eyebrow">Security</p>
          <h2 id="mh-security-title" className="mh-h2">
            Protection you can understand.
          </h2>
          <p className="mh-lede">
            Self-custody, readable confirms, and honest Alpha gates — explained in human language.
          </p>
        </Reveal>
        <div className="mh-security__grid">
          {[
            {
              t: 'Self-custody',
              d: 'You hold the keys on device. Auvora holds the clarity.',
            },
            {
              t: 'No server seeds',
              d: 'Recovery phrases and private keys are never stored plaintext on Auvora servers.',
            },
            {
              t: 'Broadcast kill switch',
              d: 'Live chain broadcast stays off until adapters are audited and deliberately enabled.',
            },
            {
              t: 'Account sync (safe)',
              d: 'Identity, prefs, public addresses, and sessions — not wallet secrets.',
            },
            {
              t: 'Mobile biometrics',
              d: 'Where the OS provides them on Android. Web does not fake biometric toggles.',
            },
            {
              t: 'Encrypted restore',
              d: 'Cross-device wallet-secret sync is a separate security milestone — not claimed live.',
            },
          ].map((item, i) => (
            <Reveal key={item.t} delay={i * 50}>
              <article className="mh-security__card">
                <h3>{item.t}</h3>
                <p>{item.d}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mh-section mh-why" aria-labelledby="mh-why-title">
        <Reveal>
          <p className="mh-eyebrow">Why Auvora</p>
          <h2 id="mh-why-title" className="mh-h2">
            Built against wallet frustrations — not against logos.
          </h2>
        </Reveal>
        <div className="mh-why__grid">
          {FRUSTRATIONS.map((f, i) => (
            <Reveal key={f.pain} delay={i * 60}>
              <article className="mh-why__card">
                <p className="mh-why__pain">{f.pain}</p>
                <p className="mh-why__relief">{f.relief}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mh-section mh-networks" aria-labelledby="mh-networks-title">
        <Reveal>
          <p className="mh-eyebrow">Networks</p>
          <h2 id="mh-networks-title" className="mh-h2">
            Supported today. Honest about tomorrow.
          </h2>
          <p className="mh-lede">Live coverage matches implementation — not a wish list.</p>
        </Reveal>
        <ul className="mh-networks__grid">
          {NETWORKS_LIVE.map((n, i) => (
            <Reveal key={n.code} delay={(i % 5) * 40}>
              <li className="mh-network">
                <span className="mh-network__mark" data-net={n.code}>
                  {n.code.slice(0, 1)}
                </span>
                <span>
                  <strong>{n.name}</strong>
                  <small>{n.code} · Supported</small>
                </span>
              </li>
            </Reveal>
          ))}
          {NETWORKS_SOON.map((n, i) => (
            <Reveal key={n.code} delay={(i % 5) * 40}>
              <li className="mh-network">
                <span className="mh-network__mark" data-net={n.code}>
                  {n.code.slice(0, 1)}
                </span>
                <span>
                  <strong>{n.name}</strong>
                  <small>{n.code} · Coming soon</small>
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="mh-section mh-faq" aria-labelledby="mh-faq-title">
        <Reveal>
          <p className="mh-eyebrow">FAQ</p>
          <h2 id="mh-faq-title" className="mh-h2">
            Straight answers.
          </h2>
        </Reveal>
        <div className="mh-faq__list">
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={faqOpen === i}
              onToggle={() => setFaqOpen((cur) => (cur === i ? null : i))}
            />
          ))}
        </div>
      </section>

      <section className="mh-final" aria-labelledby="mh-final-title">
        <Reveal>
          <h2 id="mh-final-title" className="mh-final__title">
            Open Auvora. Feel certain.
          </h2>
          <p className="mh-final__lede">One ecosystem. Calm software. Honest Alpha.</p>
          <Link href="/dashboard" className="mh-btn mh-btn--primary mh-btn--lg">
            Open app
          </Link>
        </Reveal>
      </section>

      <footer className="mh-footer">
        <Link href="/">Auvora</Link>
        <Link href="/trust">Trust</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/status">Status</Link>
      </footer>
    </main>
  );
}
