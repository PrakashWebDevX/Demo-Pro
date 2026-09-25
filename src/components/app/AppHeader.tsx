import { Link, useNavigate } from "@tanstack/react-router";
import { Landmark, LogOut, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import { THEME_OPTIONS, useTheme, type ThemeChoice } from "@/lib/theme";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div
      className="flex items-center rounded-md border border-primary-foreground/30 text-sm"
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`min-h-0 rounded-l-md px-3 py-1.5 ${lang === "en" ? "bg-primary-foreground text-primary" : "text-primary-foreground"}`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang("hi")}
        aria-pressed={lang === "hi"}
        className={`min-h-0 rounded-r-md px-3 py-1.5 ${lang === "hi" ? "bg-primary-foreground text-primary" : "text-primary-foreground"}`}
      >
        हिन्दी
      </button>
    </div>
  );
}

function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  return (
    <select
      aria-label="Theme"
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemeChoice)}
      className="h-9 rounded-md border border-primary-foreground/30 bg-transparent px-2 text-sm text-primary-foreground [&>option]:text-foreground"
    >
      {THEME_OPTIONS.map((o) => (
        <option key={o.value} value={o.value} className="bg-background">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AppHeader() {
  const { t } = useLang();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links: Array<{ to: string; label: string }> = user
    ? [
        { to: ROLE_HOME[role ?? "citizen"] ?? "/citizen", label: t("dashboard") },
        { to: "/innovation", label: t("innovation") },
        { to: "/help", label: t("help") },
        { to: "/contact", label: "Contact" },
      ]
    : [
        { to: "/", label: t("home") },
        { to: "/innovation", label: t("innovation") },
        { to: "/help", label: t("help") },
        { to: "/contact", label: "Contact" },
      ];

  return (
    <header className="gov-banner">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-md bg-primary-foreground/12 ring-1 ring-primary-foreground/25"
          >
            <Landmark className="size-6" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold">{t("app_name")}</span>
            <span className="block text-xs text-primary-foreground/80">{t("app_tagline")}</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <ThemeSelect />
          <NotificationBell />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-primary-foreground/90 hover:bg-primary-foreground/10"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {user ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="hidden md:inline-flex"
            >
              <LogOut className="size-4" /> {t("logout")}
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm" className="hidden md:inline-flex">
              <Link to="/auth">{t("login")}</Link>
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/10 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{t("app_name")}</SheetTitle>
              </SheetHeader>
              <div className="mt-2 flex flex-col gap-1 px-4 pb-6">
                {profile ? (
                  <p className="mb-3 rounded-md bg-muted p-3 text-sm">
                    <span className="block font-semibold">{profile.full_name}</span>
                    <span className="text-muted-foreground">
                      {ROLE_LABELS[role ?? "citizen"]}
                    </span>
                  </p>
                ) : null}
                {links.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="rounded-md px-3 py-3 text-base font-medium hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                ))}
                {user ? (
                  <Button type="button" variant="outline" onClick={handleSignOut} className="mt-3">
                    <LogOut className="size-4" /> {t("logout")}
                  </Button>
                ) : (
                  <Button asChild className="mt-3">
                    <Link to="/auth">{t("login")}</Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
