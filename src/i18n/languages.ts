export type Locale = "en" | "hi" | "ta" | "te" | "kn" | "ml" | "bn" | "mr" | "gu" | "ur" | "pa" | "or";

export interface LanguageOption {
  code: Locale;
  native: string;
  english: string;
  /** Selectable in the language menu. */
  enabled: boolean;
  /** Full app interface translation exists (others fall back to English UI). */
  fullUi: boolean;
  /** Browser speech-recognition locale (voice input only). */
  speechLocale: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", native: "English", english: "English", enabled: true, fullUi: true, speechLocale: "en-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", enabled: true, fullUi: true, speechLocale: "hi-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", enabled: true, fullUi: true, speechLocale: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", enabled: true, fullUi: true, speechLocale: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", enabled: true, fullUi: true, speechLocale: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", enabled: true, fullUi: true, speechLocale: "ml-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", enabled: true, fullUi: false, speechLocale: "bn-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", enabled: true, fullUi: false, speechLocale: "mr-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", enabled: true, fullUi: false, speechLocale: "gu-IN" },
  { code: "ur", native: "اردو", english: "Urdu", enabled: true, fullUi: false, speechLocale: "ur-IN" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", enabled: true, fullUi: false, speechLocale: "pa-IN" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", enabled: true, fullUi: false, speechLocale: "or-IN" },
];

export const SUPPORTED_LOCALES: Locale[] = LANGUAGE_OPTIONS.filter((o) => o.enabled).map((o) => o.code);

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (SUPPORTED_LOCALES as string[]).includes(v);
}

export function getLanguageOption(code: string) {
  return LANGUAGE_OPTIONS.find((o) => o.code === code);
}

/** Truthful availability label for a language. */
export function availabilityLabel(o: LanguageOption) {
  if (o.fullUi && o.speechLocale) return "Full interface + voice reporting";
  if (o.speechLocale) return "Voice reporting available";
  return "Text reporting available";
}
