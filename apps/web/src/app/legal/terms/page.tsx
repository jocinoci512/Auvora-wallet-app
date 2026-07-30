'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../../components/legal/LegalShell';

export default function TermsPage(): ReactElement {
  return (
    <LegalShell
      title="Terms of use"
      subtitle="Clear expectations for using Auvora Wallet as a self-custody product."
      current="/legal/terms"
    >
      <section className="cx-panel">
        <h2>You control your assets</h2>
        <p>
          Auvora helps you view balances, prepare transactions, and connect to networks. When you
          hold self-custody keys, you are responsible for safeguarding your recovery phrase and
          approving transactions you understand.
        </p>
      </section>
      <section className="cx-panel">
        <h2>Not financial advice</h2>
        <p>
          Educational content, Assistant answers, and portfolio insights explain concepts. They do
          not recommend buying, selling, or staking any asset.
        </p>
      </section>
      <section className="cx-panel">
        <h2>Preview vs live</h2>
        <p>
          Some flows are labeled preview or simulator until providers and broadcast are connected.
          Preview actions do not move funds. See <Link href="/status">Status</Link> during
          incidents.
        </p>
      </section>
      <section className="cx-panel">
        <h2>Before public GA</h2>
        <p className="cx-meta">
          Final Terms of Service will be published by counsel and linked from this route. Accepting
          terms will be required where legally necessary at GA.
        </p>
      </section>
    </LegalShell>
  );
}
