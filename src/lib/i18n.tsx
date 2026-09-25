import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi";

type Dict = Record<string, { en: string; hi: string }>;

export const translations: Dict = {
  app_name: { en: "Jan Samadhan Jharkhand", hi: "जन समाधान झारखंड" },
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

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof translations | string) => string;
  pick: (pair?: { en: string; hi: string }) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("jsj_lang");
    if (saved === "hi" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("jsj_lang", l);
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      return entry ? entry[lang] : key;
    },
    [lang],
  );

  const pick = useCallback(
    (pair?: { en: string; hi: string }) => (pair ? pair[lang] : ""),
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, pick }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
