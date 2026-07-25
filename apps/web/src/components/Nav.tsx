import Link from 'next/link';
import type { ReactElement } from 'react';

const links = [
  { href: '/', label: 'Home' },
  { href: '/wallets', label: 'Wallets' },
];

export function Nav(): ReactElement {
  return (
    <nav className="site-nav">
      <div className="site-nav__brand">Auvora</div>
      <ul className="site-nav__links">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
