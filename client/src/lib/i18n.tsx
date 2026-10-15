import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { localStore } from './storage';
import type { Lang } from './types';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStore.get('sm.lang') === 'fr' ? 'fr' : 'en'));
  useEffect(() => {
    localStore.set('sm.lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** `tr('English', 'Français')` picks the text for the current interface language. */
export function useLang() {
  const { lang, setLang } = useContext(LangContext);
  const tr = useCallback((en: string, fr: string) => (lang === 'fr' ? fr : en), [lang]);
  return { lang, setLang, tr };
}
