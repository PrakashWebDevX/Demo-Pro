import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "hc" | "system";
const KEY = "jsj_theme";

const ThemeContext = createContext<{ theme: ThemeChoice; setTheme: (t: ThemeChoice) => void }>({
  theme: "light",
  setTheme: () => {},
});

function apply(theme: ThemeChoice) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.classList.toggle("hc", theme === "hc");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY) as ThemeChoice | null;
    if (saved) setThemeState(saved);
  }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(t: ThemeChoice) {
    window.localStorage.setItem(KEY, t);
    setThemeState(t);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string }> = [
  { value: "light", label: "Civic Light" },
  { value: "dark", label: "Civic Dark" },
  { value: "hc", label: "High Contrast" },
  { value: "system", label: "System Default" },
];
