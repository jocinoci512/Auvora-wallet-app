/** Local price-alert CRUD — preview evaluation only (not live markets / push). */

export type PriceAlertKind = 'assetTarget' | 'assetPercent' | 'portfolioThreshold';
export type PriceAlertDirection = 'above' | 'below' | 'either';

export type PriceAlert = {
  id: string;
  kind: PriceAlertKind;
  title: string;
  assetSymbol: string;
  threshold: number;
  direction: PriceAlertDirection;
  createdAt: string;
  paused: boolean;
  lastTriggeredAt?: string;
};

const KEY = 'auvora_price_alerts_v1';

const DEMO_PRICES: Record<string, number> = {
  BTC: 64250,
  ETH: 3420,
  SOL: 148,
  PORTFOLIO: 12540,
};

function read(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as PriceAlert[];
    return Array.isArray(parsed) ? parsed : seed();
  } catch {
    return seed();
  }
}

function write(list: PriceAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function seed(): PriceAlert[] {
  const list: PriceAlert[] = [
    {
      id: 'seed-btc',
      kind: 'assetTarget',
      title: 'BTC above $70,000',
      assetSymbol: 'BTC',
      threshold: 70000,
      direction: 'above',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      paused: false,
    },
  ];
  write(list);
  return list;
}

export function listPriceAlerts(): PriceAlert[] {
  return read();
}

export function savePriceAlerts(list: PriceAlert[]): PriceAlert[] {
  write(list);
  return list;
}

export function createPriceAlert(
  input: Omit<PriceAlert, 'id' | 'createdAt' | 'paused'>,
): PriceAlert {
  const alert: PriceAlert = {
    ...input,
    id: `pa-${Date.now()}`,
    createdAt: new Date().toISOString(),
    paused: false,
  };
  savePriceAlerts([alert, ...read()]);
  return alert;
}

export function updatePriceAlert(alert: PriceAlert): PriceAlert[] {
  return savePriceAlerts(read().map((a) => (a.id === alert.id ? alert : a)));
}

export function deletePriceAlert(id: string): PriceAlert[] {
  return savePriceAlerts(read().filter((a) => a.id !== id));
}

export function evaluatePriceAlerts(): { fired: number; alerts: PriceAlert[] } {
  let fired = 0;
  const next = read().map((alert) => {
    if (alert.paused) return alert;
    const price = DEMO_PRICES[alert.assetSymbol] ?? DEMO_PRICES.ETH!;
    const hit =
      alert.direction === 'above'
        ? price >= alert.threshold
        : alert.direction === 'below'
          ? price <= alert.threshold
          : price >= alert.threshold || price <= alert.threshold;
    if (!hit) return alert;
    fired += 1;
    return { ...alert, lastTriggeredAt: new Date().toISOString() };
  });
  savePriceAlerts(next);
  return { fired, alerts: next };
}

export { DEMO_PRICES };
