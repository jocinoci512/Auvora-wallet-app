'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

export type SubnavLink = { href: string; label: string };

function isCurrent(pathname: string, href: string, allHrefs: string[]): boolean {
  const matches = allHrefs.filter((h) => pathname === h || pathname.startsWith(`${h}/`));
  if (matches.length === 0) return false;
  const best = [...matches].sort((a, b) => b.length - a.length)[0];
  return best === href;
}

export function Subnav({
  links,
  label = 'Section',
}: {
  links: SubnavLink[];
  label?: string;
}): ReactElement {
  const pathname = usePathname() || '/';
  const hrefs = links.map((l) => l.href);

  return (
    <nav className="page__subnav" aria-label={label}>
      {links.map((link) => {
        const current = isCurrent(pathname, link.href, hrefs);
        return (
          <Link key={link.href} href={link.href} aria-current={current ? 'page' : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
