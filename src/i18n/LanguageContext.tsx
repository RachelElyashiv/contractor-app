import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LANGUAGE, initLanguage, isRTL, setLanguage as persistLanguage, t as translate } from './index';

type LanguageValue = {
  lang: string;
  ready: boolean;
  rtl: boolean;
  /** Resolves once the new language is stored; true when only a restart can apply the new direction. */
  changeLanguage: (code: string) => Promise<boolean>;
  t: (key: string, options?: Record<string, unknown>) => string;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initLanguage().then(({ code }: { code: string }) => {
      setLang(code);
      setReady(true);
    });
  }, []);

  const changeLanguage = useCallback(async (code: string) => {
    const { needsRestart } = await persistLanguage(code);
    setLang(code);
    return needsRestart;
  }, []);

  // Keyed on lang so every consumer re-renders when the language changes.
  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      ready,
      rtl: isRTL(lang),
      changeLanguage,
      t: (key, options) => translate(key, options) as string,
    }),
    [lang, ready, changeLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
