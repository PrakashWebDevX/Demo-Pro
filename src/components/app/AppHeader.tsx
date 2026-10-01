import { Link, useNavigate } from "@tanstack/react-router";
import { Landmark, LogOut, Menu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import { LanguageSelect } from "./LanguageSelect";
import { THEME_OPTIONS, useTheme, type ThemeChoice } from "@/lib/theme";
import { deleteOfflineReportsForUser, listOfflineReports } from "@/lib/offline-reports";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function LanguageToggle() {
  return <LanguageSelect variant="banner" />;
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
  const { t, tr } = useLang();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    if (user) {
      const savedReports = await listOfflineReports(user.id);
      if (savedReports.length > 0) {
        const remove = window.confirm(
          tr(
            "Remove saved offline drafts from this device?",
            "इस डिवाइस से सहेजे गए ऑफलाइन ड्राफ्ट हटाएँ?",
          ),
        );
        if (remove) await deleteOfflineReportsForUser(user.id);
      }
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links: Array<{ to: string; label: string }> = user
    ? [
        ...(role === "officer" || role === "dept_admin" || role === "admin"
          ? [{ to: "/officer", label: tr("Operations Dashboard", "संचालन डैशबोर्ड") }]
          : []),
        ...(role === "officer" || role === "dept_admin" || role === "admin"
          ? [{ to: "/officer/universities", label: tr("University Verification", "विश्वविद्यालय सत्यापन") }]
          : []),
        { to: ROLE_HOME[role ?? "citizen"] ?? "/citizen", label: t("dashboard") },
        ...(role === "citizen"
          ? [{ to: "/offline-reports", label: tr("Saved Offline Reports", "ऑफलाइन शिकायतें") }]
          : []),
        ...(role === "university_partner" || role === "industry_partner"
          ? [{ to: "/partner", label: tr("Partner Portal", "भागीदार पोर्टल") }]
          : []),
        ...(role === "university_partner" || role === "industry_partner"
          ? []
          : [{ to: "/innovation", label: t("innovation") }]),
        { to: "/challenges", label: tr("My Challenges", "मेरी चुनौतियाँ") },
        { to: "/impact", label: tr("Impact", "प्रभाव") },
        { to: "/map", label: tr("Impact Map", "प्रभाव मानचित्र") },
        { to: "/help", label: t("help") },
        { to: "/contact", label: tr("Contact", "संपर्क") },
      ]
    : [
        { to: "/", label: t("home") },
        { to: "/innovation", label: t("innovation") },
        { to: "/help", label: t("help") },
        { to: "/contact", label: tr("Contact", "संपर्क") },
      ];

  return (
    <header className="gov-banner">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-foreground/12 ring-1 ring-primary-foreground/25 p-1"
          >
            <img src="/favicon.ico" alt="Eco-Bridge logo" className="size-8 object-contain" />
          </span>

          <span className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-bold">{t("app_name")}</span>
            <span className="block truncate text-xs text-primary-foreground/80">{t("app_tagline")}</span>
          </span>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <LanguageToggle />
            <ThemeSelect />
          </div>
          <NotificationBell />
          {user ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="hidden lg:inline-flex"
            >
              <LogOut className="size-4" /> {t("logout")}
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm" className="hidden lg:inline-flex">
              <Link to="/auth">{t("login")}</Link>
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-primary-foreground hover:bg-primary-foreground/10 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 max-w-[85vw] overflow-y-auto">
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
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-primary p-2 text-primary-foreground sm:hidden">
                  <LanguageToggle />
                  <ThemeSelect />
                </div>
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

        <nav
          className="hidden w-full flex-wrap items-center gap-1 border-t border-primary-foreground/15 pt-2 lg:flex"
          aria-label="Main"
        >
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
      </div>
    </header>
  );
}
