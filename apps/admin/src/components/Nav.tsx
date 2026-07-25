import Link from 'next/link';
import type { ReactElement } from 'react';

const links = [
  { href: '/', label: 'Home' },
  { href: '/wallets', label: 'Wallets' },
  { href: '/', label: 'Users' },
];

export function Nav(): ReactElement {
  return (
    <nav className="site-nav">
      <div className="site-nav__brand">Auvora Admin</div>
      <ul className="site-nav__links">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
