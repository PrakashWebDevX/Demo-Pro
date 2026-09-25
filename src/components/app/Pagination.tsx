import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export const PAGE_SIZE = 10;

/** Simple previous / next pager used by the report lists. */
export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const { lang } = useLang();
  if (pageCount <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <nav
      className="mt-2 flex flex-wrap items-center justify-between gap-3"
      aria-label={lang === "en" ? "Report list pages" : "सूची पृष्ठ"}
    >
      <p className="text-sm text-muted-foreground">
        {lang === "en"
          ? `Showing ${from}–${to} of ${total}`
          : `${total} में से ${from}–${to} दिख रहे हैं`}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          {lang === "en" ? "Previous" : "पिछला"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {lang === "en" ? `Page ${page} of ${pageCount}` : `पृष्ठ ${page} / ${pageCount}`}
        </span>
        <Button variant="outline" onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
          {lang === "en" ? "Next" : "अगला"}
        </Button>
      </div>
    </nav>
  );
}
