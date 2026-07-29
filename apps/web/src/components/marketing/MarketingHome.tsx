'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from 'react';
import { Reveal, useCountUp, useInView, usePrefersReducedMotion } from './motion';
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
    body: 'One balance stage across networks — without a maze of disconnected apps.',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </Icon>
    ),
  },
  {
    title: 'One-click swaps',
    body: 'Clear quotes, visible fees, and a confirmation you can actually read.',
    icon: (
      <Icon>
        <path d="M7 7h11l-3-3M17 17H6l3 3" />
      </Icon>
    ),
  },
  {
    title: 'Portfolio clarity',
    body: 'Editorial balances and calm charts — signal first, decoration never.',
    icon: (
      <Icon>
        <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" />
      </Icon>
    ),
  },
  {
    title: 'NFT management',
    body: 'A quiet gallery for collectibles with media that fails gracefully.',
    icon: (
      <Icon>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="1.5" />
        <path d="M3 16l5-4 4 3 4-5 5 6" />
      </Icon>
    ),
  },
  {
    title: 'Staking, simplified',
    body: 'See rewards and risk in plain language before you commit.',
    icon: (
      <Icon>
        <path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" />
      </Icon>
    ),
  },
  {
    title: 'Real-time prices',
    body: 'Live context when you need it — never a flashing casino ticker.',
    icon: (
      <Icon>
        <path d="M4 14l4-4 4 3 7-8" />
        <path d="M15 5h5v5" />
      </Icon>
    ),
  },
  {
    title: 'Security you can feel',
    body: 'Readable confirms, clear permissions, and no security theater.',
    icon: (
      <Icon>
        <path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" />
      </Icon>
    ),
  },
  {
    title: 'Biometrics',
    body: 'Unlock with the same calm gesture you use for everything else.',
    icon: (
      <Icon>
        <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </Icon>
    ),
  },
  {
    title: 'Encrypted backup',
    body: 'Recovery that respects self-custody — guided, never careless.',
    icon: (
      <Icon>
        <path d="M6 10V8a6 6 0 1 1 12 0v2" />
        <rect x="5" y="10" width="14" height="10" rx="2" />
      </Icon>
    ),
  },
  {
    title: 'Hardware ready',
    body: 'Pair cold storage when you are ready — without rewriting your workflow.',
    icon: (
      <Icon>
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M10 7h4M10 11h4M10 15h2" />
      </Icon>
    ),
  },
];

const PROOF = [
  { label: 'Self-custody first', detail: 'Keys stay yours' },
  { label: 'Open architecture', detail: 'Composable platform' },
  { label: 'Fast by design', detail: 'Perceived speed matters' },
  { label: 'Cross-chain', detail: 'One calm interface' },
  { label: 'Institutional rigor', detail: 'Audit-ready posture' },
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

const NETWORKS = [
  { name: 'Bitcoin', code: 'BTC' },
  { name: 'Ethereum', code: 'ETH' },
  { name: 'Solana', code: 'SOL' },
  { name: 'BNB', code: 'BNB' },
  { name: 'Polygon', code: 'POL' },
  { name: 'Avalanche', code: 'AVAX' },
  { name: 'Base', code: 'BASE' },
  { name: 'Arbitrum', code: 'ARB' },
  { name: 'Optimism', code: 'OP' },
  { name: 'Tron', code: 'TRX' },
];

const TESTIMONIALS = [
  {
    quote:
      'Auvora is the first wallet that feels like software for adults — calm enough for my parents, precise enough for treasury.',
    name: 'Maya Chen',
    role: 'Head of Finance, Northline',
    initials: 'MC',
  },
  {
    quote:
      'We evaluated six wallets for our team. Auvora won on confirmations alone — people finally understood what they were signing.',
    name: 'Jordan Blake',
    role: 'Security Lead, Lattice Labs',
    initials: 'JB',
  },
  {
    quote:
      'It disappears when I need speed and appears when I need certainty. That is rare in this category.',
    name: 'Elena Voss',
    role: 'Independent trader',
    initials: 'EV',
  },
];

const FAQS = [
  {
    q: 'Is Auvora a custodial wallet?',
    a: 'No. Auvora is built for self-custody. You control your keys; we design the interface so that control feels clear instead of frightening.',
  },
  {
    q: 'Which networks can I use?',
    a: 'Major networks including Bitcoin, Ethereum, Solana, BNB, Polygon, Avalanche, Base, Arbitrum, Optimism, and Tron — with a future-ready architecture for more.',
  },
  {
    q: 'How do you keep my funds safe?',
    a: 'Encryption, biometric unlock, guided recovery, and readable confirmations. We prioritize preventing irreversible mistakes over looking “crypto.”',
  },
  {
    q: 'Can beginners and professionals share one app?',
    a: 'Yes. Density and language adapt — guided paths for first sends, compact tools for daily power users — without splitting into three products.',
  },
  {
    q: 'Does Auvora work on mobile and desktop?',
    a: 'Mobile feels native. Desktop feels like a premium terminal. Tablet sits between — touch-first, never a shrunk dashboard.',
  },
];

function ProofStat({
  value,
  suffix,
  label,
  active,
}: {
  value: number;
  suffix: string;
  label: string;
  active: boolean;
}): ReactElement {
  const n = useCountUp(value, active, 1400);
  return (
    <div className="mh-stat">
      <p className="mh-stat__value">
        {n}
        {suffix}
      </p>
      <p className="mh-stat__label">{label}</p>
    </div>
  );
}

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
  const reduced = usePrefersReducedMotion();
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [testimonial, setTestimonial] = useState(0);
  const [statsRef, statsInView] = useInView<HTMLDivElement>();
  const [showcaseTab, setShowcaseTab] = useState<'portfolio' | 'swap' | 'nfts'>('portfolio');

  const nextTestimonial = useCallback(() => {
    setTestimonial((i) => (i + 1) % TESTIMONIALS.length);
  }, []);
  const prevTestimonial = useCallback(() => {
    setTestimonial((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(nextTestimonial, 7000);
    return () => window.clearInterval(id);
  }, [nextTestimonial, reduced]);

  const t = TESTIMONIALS[testimonial]!;

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
            without the noise of typical crypto.
          </p>
          <div className="mh-hero__cta">
            <Link href="/wallets/onboarding" className="mh-btn mh-btn--primary">
              Create wallet
            </Link>
            <Link href="/dashboard" className="mh-btn mh-btn--ghost">
              Open app
            </Link>
          </div>
          <ul className="mh-hero__trust">
            <li>Self-custody</li>
            <li>Readable confirms</li>
            <li>Multi-chain</li>
            <li>WCAG-minded</li>
          </ul>
          <p className="mh-hero__chains-label">Supported networks</p>
          <ul className="mh-hero__chains">
            {NETWORKS.slice(0, 6).map((n) => (
              <li key={n.code}>{n.code}</li>
            ))}
            <li>+{NETWORKS.length - 6}</li>
          </ul>
        </div>
        <div className="mh-hero__visual">
          <WalletPreview />
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
          <ProofStat value={10} suffix="+" label="Networks ready" active={statsInView} />
          <ProofStat value={3} suffix="" label="User altitudes, one product" active={statsInView} />
          <ProofStat value={99} suffix="%" label="Clarity over clutter" active={statsInView} />
        </div>
      </section>

      <section className="mh-section mh-features" aria-labelledby="mh-features-title">
        <Reveal>
          <p className="mh-eyebrow">Capabilities</p>
          <h2 id="mh-features-title" className="mh-h2">
            Everything essential. Nothing loud.
          </h2>
          <p className="mh-lede">
            Features earn their place by reducing friction — not by filling a grid.
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
              Portfolio, activity, NFTs, send, receive, and swap in one composed surface. Motion
              explains change; it never performs.
            </p>
            <div className="mh-showcase__tabs" role="tablist" aria-label="Product views">
              {(
                [
                  ['portfolio', 'Portfolio'],
                  ['swap', 'Swap'],
                  ['nfts', 'NFTs'],
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
                  <li>Asset rows with tabular figures</li>
                  <li>Quiet sparkline context</li>
                </>
              ) : null}
              {showcaseTab === 'swap' ? (
                <>
                  <li>Visible rate and fee</li>
                  <li>Human confirmation sheet</li>
                  <li>Progress you can trust</li>
                </>
              ) : null}
              {showcaseTab === 'nfts' ? (
                <>
                  <li>Stable media frames</li>
                  <li>Collection clarity</li>
                  <li>Graceful empty states</li>
                </>
              ) : null}
            </ul>
          </Reveal>
          <Reveal delay={80}>
            <div className="mh-showcase__stage">
              <WalletPreview />
              <div className={`mh-showcase__overlay mh-showcase__overlay--${showcaseTab}`}>
                {showcaseTab === 'swap' ? (
                  <div className="mh-mini-swap" aria-hidden>
                    <p>Swap</p>
                    <span>2.0 ETH → 6,420 USDC</span>
                    <span className="mh-mini-swap__cta">Review swap</span>
                  </div>
                ) : null}
                {showcaseTab === 'nfts' ? (
                  <div className="mh-mini-nfts" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}
              </div>
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
            Encryption, self-custody, recovery, biometrics, and secure backup — explained in human
            language, designed for irreversible moments.
          </p>
        </Reveal>
        <div className="mh-security__grid">
          {[
            {
              t: 'Encryption',
              d: 'Sensitive material stays protected at rest — never casually exposed in the UI.',
            },
            {
              t: 'Self-custody',
              d: 'You hold the keys. Auvora holds the clarity.',
            },
            {
              t: 'Recovery',
              d: 'Guided backup flows that respect how easy it is to rush — and how costly that is.',
            },
            {
              t: 'Biometrics',
              d: 'Unlock with Face ID, Touch ID, or device biometrics where available.',
            },
            {
              t: 'Secure backup',
              d: 'Encrypted recovery paths with explicit confirmations at every critical step.',
            },
            {
              t: 'Audit-ready posture',
              d: 'Architecture meant to be inspected — not a black box wrapped in slogans.',
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
            Future-ready. Present-complete.
          </h2>
          <p className="mh-lede">Premium coverage across the chains people actually use.</p>
        </Reveal>
        <ul className="mh-networks__grid">
          {NETWORKS.map((n, i) => (
            <Reveal key={n.code} delay={(i % 5) * 40}>
              <li className="mh-network">
                <span className="mh-network__mark" data-net={n.code}>
                  {n.code.slice(0, 1)}
                </span>
                <span>
                  <strong>{n.name}</strong>
                  <small>{n.code}</small>
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="mh-section mh-testimonials" aria-labelledby="mh-testimonials-title">
        <Reveal>
          <p className="mh-eyebrow">Voices</p>
          <h2 id="mh-testimonials-title" className="mh-h2">
            Chosen for composure.
          </h2>
        </Reveal>
        <div className="mh-testimonial" aria-live="polite">
          <blockquote>
            <p>“{t.quote}”</p>
            <footer>
              <span className="mh-testimonial__avatar" aria-hidden>
                {t.initials}
              </span>
              <span>
                <cite>{t.name}</cite>
                <span className="mh-testimonial__role">{t.role}</span>
              </span>
            </footer>
          </blockquote>
          <div className="mh-testimonial__controls">
            <button
              type="button"
              className="mh-btn mh-btn--ghost mh-btn--sm"
              onClick={prevTestimonial}
            >
              Previous
            </button>
            <div className="mh-testimonial__dots" role="tablist" aria-label="Testimonials">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={TESTIMONIALS[i]!.name}
                  type="button"
                  role="tab"
                  aria-selected={i === testimonial}
                  aria-label={`Show testimonial ${i + 1}`}
                  className={i === testimonial ? 'is-active' : undefined}
                  onClick={() => setTestimonial(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="mh-btn mh-btn--ghost mh-btn--sm"
              onClick={nextTestimonial}
            >
              Next
            </button>
          </div>
        </div>
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
          <p className="mh-final__lede">One product. Three altitudes. Zero noise.</p>
          <Link href="/wallets/onboarding" className="mh-btn mh-btn--primary mh-btn--lg">
            Get started
          </Link>
        </Reveal>
      </section>

      <footer className="mh-footer">
        <p>
          <span className="mh-brand mh-brand--sm">Auvora</span>
          <span className="mh-footer__tag">The quiet operating system for digital value.</span>
        </p>
        <nav aria-label="Footer">
          <Link href="/security">Security</Link>
          <Link href="/settings/help">Help</Link>
          <Link href="/status">Status</Link>
          <Link href="/dashboard">App</Link>
        </nav>
      </footer>
    </main>
  );
}
