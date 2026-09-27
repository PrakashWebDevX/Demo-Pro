export type Locale = "en" | "hi" | "ta" | "te" | "kn" | "ml";

export interface LanguageOption {
  code: string;
  native: string;
  english: string;
  /** Full app interface translation exists. */
  enabled: boolean;
  /** Browser speech-recognition locale (voice input only). */
  speechLocale: string;
}

export const SUPPORTED_LOCALES: Locale[] = ["en", "hi", "ta", "te", "kn", "ml"];

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", native: "English", english: "English", enabled: true, speechLocale: "en-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", enabled: true, speechLocale: "hi-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", enabled: true, speechLocale: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", enabled: true, speechLocale: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", enabled: true, speechLocale: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", enabled: true, speechLocale: "ml-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", enabled: false, speechLocale: "bn-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", enabled: false, speechLocale: "mr-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", enabled: false, speechLocale: "gu-IN" },
  { code: "ur", native: "اردو", english: "Urdu", enabled: false, speechLocale: "ur-IN" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", enabled: false, speechLocale: "pa-IN" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", enabled: false, speechLocale: "or-IN" },
];

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (SUPPORTED_LOCALES as string[]).includes(v);
}
