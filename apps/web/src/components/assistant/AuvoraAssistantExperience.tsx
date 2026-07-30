'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import {
  answerAssistant,
  ASSISTANT_HISTORY_KEY,
  ASSISTANT_PROMPTS,
  clearAssistantHistoryStorage,
} from '../../lib/insights/demo';
import { getPrivacyPrefs } from '../../lib/settings/prefs';
import { PlatformShell } from '../platform/PlatformShell';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  related?: { label: string; href: string }[];
};

const WELCOME: Msg = {
  id: 'welcome',
  role: 'assistant',
  text: 'Auvora Intelligence can explain fees, security prompts, recovery, staking, bridges, and portfolio concepts in plain language. It never moves funds, asks for your recovery phrase, or tells you what to buy or sell.',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (document.documentElement.dataset.reduceMotion === 'true') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function AuvoraAssistantExperience(): ReactElement {
  const [aiOn, setAiOn] = useState(true);
  const [keepHistory, setKeepHistory] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [liveLine, setLiveLine] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    const p = getPrivacyPrefs();
    setAiOn(p.aiAssistant !== false);
    setKeepHistory(p.aiChatHistory !== false);
    if (p.aiChatHistory === false) {
      clearAssistantHistoryStorage();
      setMessages([WELCOME]);
    } else {
      try {
        const raw = localStorage.getItem(ASSISTANT_HISTORY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Msg[];
          if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
        }
      } catch {
        /* ignore */
      }
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (!keepHistory) {
      clearAssistantHistoryStorage();
      return;
    }
    try {
      localStorage.setItem(ASSISTANT_HISTORY_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, keepHistory]);

  function send(text: string): void {
    const q = text.trim();
    if (!q || !aiOn) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: q };
    const reply = answerAssistant(q);
    const botMsg: Msg = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: reply.answer,
      related: reply.related,
    };
    setMessages((m) => [...m, userMsg, botMsg]);
    setLiveLine(reply.answer);
    setInput('');
  }

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    send(input);
  }

  function clearHistory(): void {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'History cleared on this device. Ask about fees, recovery, or portfolio concepts anytime.',
      },
    ]);
    setLiveLine('History cleared on this device.');
    clearAssistantHistoryStorage();
  }

  return (
    <PlatformShell
      title="Auvora Intelligence Q&A"
      subtitle="Optional on-device explanations — never a replacement for your decisions."
      reassure="Private by default. No recovery phrases. No fund moves. No investment advice."
      backHref="/dashboard"
      backLabel="Wallet"
      actions={
        <>
          <Link href="/learn" className="cx-btn cx-btn--ghost">
            Learning Center
          </Link>
          <Link href="/settings/privacy" className="cx-btn cx-btn--ghost">
            Guidance privacy
          </Link>
        </>
      }
    >
      {!aiOn ? (
        <div className="cx-warn">
          <strong>Q&amp;A is off</strong>
          <p>
            Turn it on in Privacy settings if you want on-device explanations. Nothing is sent while
            it is off.
          </p>
          <Link href="/settings/privacy" className="cx-btn cx-btn--primary">
            Privacy settings
          </Link>
        </div>
      ) : null}

      <section className="cx-panel">
        <h2>How answers are made</h2>
        <p className="cx-meta">
          On-device matching maps your question to curated educational guides. The main Intelligence
          layer is contextual tips throughout the wallet — this Q&amp;A is optional. Answers
          educate; they never recommend trades. Keys never leave the device for this surface.
        </p>
      </section>

      <div className="cx-chips" aria-label="Suggested questions">
        {ASSISTANT_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="cx-chip"
            disabled={!aiOn}
            onClick={() => send(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="cx-sr-only" aria-live="polite">
        {liveLine}
      </div>

      <section className="cx-panel cx-chat" aria-label="Conversation">
        <ul className="cx-chat__list">
          {messages.map((m) => (
            <li key={m.id} className={`cx-chat__bubble cx-chat__bubble--${m.role}`}>
              <p>{m.text}</p>
              {m.related?.length ? (
                <div className="cx-chips">
                  {m.related.map((r) => (
                    <Link key={`${m.id}-${r.href}`} href={r.href} className="cx-chip">
                      {r.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </section>

      <form className="cx-chat__form" onSubmit={onSubmit}>
        <label className="cx-field cx-field--grow">
          <span className="cx-sr-only">Ask the assistant</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about fees, recovery, staking…"
            disabled={!aiOn}
            autoComplete="off"
          />
        </label>
        <button type="submit" className="cx-btn cx-btn--primary" disabled={!aiOn || !input.trim()}>
          Ask
        </button>
      </form>

      <div className="cx-platform__actions">
        <button type="button" className="cx-btn cx-btn--ghost" onClick={clearHistory}>
          Clear local history
        </button>
        <Link href="/insights" className="cx-link">
          Portfolio insights
        </Link>
      </div>
    </PlatformShell>
  );
}
