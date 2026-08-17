import type { SubnavLink } from '../components/Subnav';

export const OPS_LINKS: SubnavLink[] = [
  { href: '/observability', label: 'Dashboard' },
  { href: '/observability/alerts', label: 'Alerts' },
  { href: '/observability/incidents', label: 'Incidents' },
  { href: '/observability/slos', label: 'SLOs' },
  { href: '/observability/capacity', label: 'Capacity' },
  { href: '/observability/health', label: 'Health' },
  { href: '/observability/dependencies', label: 'Dependencies' },
  { href: '/observability/traces', label: 'Traces' },
  { href: '/observability/logs', label: 'Logs' },
  { href: '/observability/maintenance', label: 'Maintenance' },
];

export const INFRA_LINKS: SubnavLink[] = [
  { href: '/infrastructure', label: 'Dashboard' },
  { href: '/infrastructure/environments', label: 'Environments' },
  { href: '/infrastructure/config', label: 'Feature flags' },
  { href: '/infrastructure/cluster', label: 'Cluster' },
  { href: '/infrastructure/deployments', label: 'Deployments' },
  { href: '/infrastructure/backups', label: 'Backups' },
  { href: '/infrastructure/recovery', label: 'Recovery' },
  { href: '/infrastructure/releases', label: 'Releases' },
];

export const IDENTITY_LINKS: SubnavLink[] = [
  { href: '/users', label: 'Users' },
  { href: '/operators', label: 'Administrators' },
  { href: '/security', label: 'Security' },
  { href: '/security/audit', label: 'Audit' },
  { href: '/settings', label: 'Settings' },
];

export const SUPPORT_LINKS: SubnavLink[] = [
  { href: '/support', label: 'Queue' },
  { href: '/support/kb', label: 'Knowledge base' },
  { href: '/support/templates', label: 'Templates' },
];
