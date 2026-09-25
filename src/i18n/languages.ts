export type Locale = "en" | "hi" | "ta" | "te" | "kn" | "ml";

export interface LanguageOption {
  code: string;
  native: string;
  english: string;
  enabled: boolean;
}

export const SUPPORTED_LOCALES: Locale[] = ["en", "hi", "ta", "te", "kn", "ml"];

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en", native: "English", english: "English", enabled: true },
  { code: "hi", native: "हिन्दी", english: "Hindi", enabled: true },
  { code: "ta", native: "தமிழ்", english: "Tamil", enabled: true },
  { code: "te", native: "తెలుగు", english: "Telugu", enabled: true },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", enabled: true },
  { code: "ml", native: "മലയാളം", english: "Malayalam", enabled: true },
  { code: "bn", native: "বাংলা", english: "Bengali", enabled: false },
  { code: "mr", native: "मराठी", english: "Marathi", enabled: false },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", enabled: false },
  { code: "ur", native: "اردو", english: "Urdu", enabled: false },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", enabled: false },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", enabled: false },
];

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (SUPPORTED_LOCALES as string[]).includes(v);
}
