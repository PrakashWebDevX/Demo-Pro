import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { MESSAGES } from "@/i18n/messages";
import { isLocale, type Locale } from "@/i18n/languages";

export type { Locale } from "@/i18n/languages";
/** Legacy two-value language used by screens not yet fully translated (they fall back to English). */
export type Lang = "en" | "hi";

type Dict = Record<string, { en: string; hi: string }>;

export const translations: Dict = {
  app_name: { en: "Eco-Bridge", hi: "Eco-Bridge" },
  app_tagline: {
    en: "Citizen Issue Resolution and Innovation Platform",
    hi: "नागरिक शिकायत समाधान एवं नवाचार मंच",
  },
  report_issue: { en: "Report an Issue", hi: "समस्या दर्ज करें" },
  my_reports: { en: "My Reports", hi: "मेरी शिकायतें" },
  track_status: { en: "Track Status", hi: "स्थिति देखें" },
  track_my_report: { en: "Track My Report", hi: "मेरी शिकायत देखें" },
  submit: { en: "Submit", hi: "जमा करें" },
  help: { en: "Help", hi: "सहायता" },
  help_faq: { en: "Help and FAQ", hi: "सहायता एवं प्रश्न" },
  notifications: { en: "Notifications", hi: "सूचनाएँ" },
  feedback: { en: "Feedback", hi: "प्रतिक्रिया" },
  resolved: { en: "Resolved", hi: "समाधान हो गया" },
  login: { en: "Login", hi: "लॉगिन" },
  logout: { en: "Logout", hi: "लॉग आउट" },
  home: { en: "Home", hi: "होम" },
  dashboard: { en: "Dashboard", hi: "डैशबोर्ड" },
  innovation: { en: "Innovation Challenges", hi: "नवाचार चुनौतियाँ" },
  total_reports: { en: "Total Reports", hi: "कुल शिकायतें" },
  under_review: { en: "Under Review", hi: "समीक्षा में" },
  in_progress: { en: "In Progress", hi: "कार्य जारी" },
  next: { en: "Next", hi: "आगे" },
  back: { en: "Back", hi: "पीछे" },
  cancel: { en: "Cancel", hi: "रद्द करें" },
  save_offline: { en: "Save as Offline Draft", hi: "ऑफलाइन ड्राफ्ट सहेजें" },
  all: { en: "All", hi: "सभी" },
};

type Params = Record<string, string | number>;

interface LanguageContextValue {
  /** Legacy value: "hi" only when Hindi is selected, otherwise "en" (English fallback). */
  lang: Lang;
  /** Full selected locale. */
  locale: Locale;
  setLang: (l: Locale) => void;
  t: (key: keyof typeof translations | string) => string;
  /** Translate by English source text. `hi` is an optional inline Hindi override. */
  tr: (en: string, hi?: string, params?: Params) => string;
  pick: (pair?: { en: string; hi: string }) => string;
}

// Keep one context instance across hot reloads so the provider and consumers always match.
const g = globalThis as unknown as { __jsjLangCtx?: React.Context<LanguageContextValue | null> };
const LanguageContext = (g.__jsjLangCtx ??= createContext<LanguageContextValue | null>(null));
const STORAGE_KEY = "jsj_lang";

function fill(s: string, params?: Params) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function translate(locale: Locale, en: string, hi?: string, params?: Params) {
  let out = en;
  if (locale === "hi") out = hi || MESSAGES[en]?.hi || en;
  else if (locale !== "en") out = MESSAGES[en]?.[locale] || en;
  return fill(out, params);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) setLocale(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLang = useCallback((l: Locale) => {
    if (!isLocale(l)) return;
    setLocale(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const tr = useCallback(
    (en: string, hi?: string, params?: Params) => translate(locale, en, hi, params),
    [locale],
  );

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      return entry ? translate(locale, entry.en, entry.hi) : key;
    },
    [locale],
  );

  const pick = useCallback(
    (pair?: { en: string; hi: string }) => (pair ? translate(locale, pair.en, pair.hi) : ""),
    [locale],
  );

  const lang: Lang = locale === "hi" ? "hi" : "en";

  return (
    <LanguageContext.Provider value={{ lang, locale, setLang, t, tr, pick }}>
      {children}
    </LanguageContext.Provider>
  );
}

const FALLBACK: LanguageContextValue = {
  lang: "en",
  locale: "en",
  setLang: () => {},
  t: (key: string) => translations[key]?.en ?? key,
  tr: (en: string, _hi?: string, params?: Params) => fill(en, params),
  pick: (pair?: { en: string; hi: string }) => pair?.en ?? "",
};

export function useLang() {
  const ctx = useContext(LanguageContext);
  // Safe English fallback instead of blanking the page if the provider is ever missing.
  return ctx ?? FALLBACK;
}
