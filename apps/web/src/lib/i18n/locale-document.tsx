'use client';

import { useEffect, type ReactElement, type ReactNode } from 'react';
import { getAccountPrefs } from '../settings/prefs';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

/** Apply language / RTL / motion / contrast prefs to the document element. */
export function applyLocaleDocumentPrefs(): void {
  if (typeof document === 'undefined') return;
  const prefs = getAccountPrefs();
  const root = document.documentElement;
  const lang = prefs.language || 'en';
  root.lang = lang;
  root.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  root.dataset.reduceMotion = prefs.reduceMotion ? 'true' : 'false';
  root.dataset.highContrast = prefs.highContrast ? 'true' : 'false';
  root.style.setProperty('scroll-behavior', prefs.reduceMotion ? 'auto' : 'smooth');
}

/** Applies account locale prefs to document (lang, dir, motion, contrast). */
export function LocaleDocumentSync({ children }: { children: ReactNode }): ReactElement {
  useEffect(() => {
    applyLocaleDocumentPrefs();
  }, []);

  return <>{children}</>;
}
