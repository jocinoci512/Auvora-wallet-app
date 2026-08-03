import {
  createPreviewSession,
  disconnectPairingSession,
  getPublicWcProjectId,
  listPairingSessions,
  savePairingSessions,
  upsertPairingSession,
} from './web-pairing';

const store: Record<string, string> = {};

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    },
    configurable: true,
  });
});

describe('web-pairing', () => {
  const prevProjectId = process.env['NEXT_PUBLIC_WC_PROJECT_ID'];

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    savePairingSessions([]);
  });

  afterAll(() => {
    if (prevProjectId === undefined) {
      delete process.env['NEXT_PUBLIC_WC_PROJECT_ID'];
    } else {
      process.env['NEXT_PUBLIC_WC_PROJECT_ID'] = prevProjectId;
    }
  });

  it('does not treat missing project ids as configured', () => {
    delete process.env['NEXT_PUBLIC_WC_PROJECT_ID'];
    expect(getPublicWcProjectId()).toBeNull();
  });

  it('rejects placeholder project ids', () => {
    process.env['NEXT_PUBLIC_WC_PROJECT_ID'] = 'your-project-id';
    expect(getPublicWcProjectId()).toBeNull();
  });

  it('accepts a real public project id', () => {
    process.env['NEXT_PUBLIC_WC_PROJECT_ID'] = 'abc123public';
    expect(getPublicWcProjectId()).toBe('abc123public');
  });

  it('stores and disconnects preview sessions locally', () => {
    const session = createPreviewSession('Test mobile');
    expect(session.source).toBe('preview');
    upsertPairingSession(session);
    expect(listPairingSessions()).toHaveLength(1);
    disconnectPairingSession(session.topic);
    expect(listPairingSessions()).toHaveLength(0);
  });
});
