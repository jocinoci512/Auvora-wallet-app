'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

export type SubnavLink = { href: string; label: string };

export function Subnav({
  links,
  label = 'Section',
}: {
  links: SubnavLink[];
  label?: string;
}): ReactElement {
  const pathname = usePathname() || '/';

  return (
    <nav className="page__subnav" aria-label={label}>
      {links.map((link) => {
        const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} aria-current={current ? 'page' : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
