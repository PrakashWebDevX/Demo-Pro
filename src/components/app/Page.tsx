import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { Link, useLocation } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { PhoneAssistant } from "./PhoneAssistant";
import { DevAuthPanel } from "./DevAuthPanel";

const PHONE_PATHS = ["/", "/citizen", "/report", "/reports"];

export function Page({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { t } = useLang();
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {title ? (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions}
          </div>
        ) : null}
        {children}
      </main>
      <footer className="border-t bg-card pb-24">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("app_name")}</p>
          <p className="mt-1 inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
            Hackathon Demo • Demo data only • Not an official government service
          </p>
          <p className="mt-1">
            Prototype for the Government of Jharkhand. For emergencies, contact the appropriate
            official emergency service — this platform does not replace emergency helplines.
          </p>
          <nav className="mt-3 flex flex-wrap gap-4" aria-label="Footer">
            <Link to="/help" className="underline">Help and FAQ</Link>
            <Link to="/contact" className="underline">Contact Us</Link>
          </nav>
        </div>
      </footer>
      {PHONE_PATHS.includes(pathname) ? <PhoneAssistant /> : null}
      <DevAuthPanel />
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success" | "accent";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning-foreground"
      : tone === "success"
        ? "text-success"
        : tone === "accent"
          ? "text-accent"
          : "text-primary";
  return (
    <div className="card-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center p-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {hint ? <p className="mt-1 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
