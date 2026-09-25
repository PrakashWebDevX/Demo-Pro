import { Languages } from "lucide-react";
import { LANGUAGE_OPTIONS, isLocale } from "@/i18n/languages";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Language dropdown: 6 active languages + disabled "Coming soon" options. */
export function LanguageSelect({
  className,
  variant = "default",
  id,
}: {
  className?: string;
  variant?: "default" | "banner";
  id?: string;
}) {
  const { locale, setLang, tr } = useLang();
  return (
    <label className={cn("inline-flex items-center gap-1.5", className)}>
      <Languages className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{tr("Language", "भाषा")}</span>
      <select
        id={id}
        value={locale}
        onChange={(e) => isLocale(e.target.value) && setLang(e.target.value)}
        className={cn(
          "h-9 max-w-[11rem] rounded-md border px-2 text-sm",
          variant === "banner"
            ? "border-primary-foreground/30 bg-transparent text-primary-foreground [&>option]:bg-background [&>option]:text-foreground"
            : "bg-background text-foreground",
        )}
      >
        {LANGUAGE_OPTIONS.map((o) => (
          <option key={o.code} value={o.code} disabled={!o.enabled}>
            {o.native === o.english ? o.native : `${o.native} — ${o.english}`}
            {o.enabled ? "" : ` (${tr("Coming soon", "जल्द आ रहा है")})`}
          </option>
        ))}
      </select>
    </label>
  );
}
