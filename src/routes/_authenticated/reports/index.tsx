import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, Page } from "@/components/app/Page";
import { PriorityBadge, StatusBadge } from "@/components/app/badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { fetchReports } from "@/lib/reports";
import { CATEGORY_KEYS, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: MyReportsPage,
});

function MyReportsPage() {
  const { user } = useAuth();
  const { lang, t, pick } = useLang();
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["my-reports", user?.id],
    queryFn: () => fetchReports({ citizenId: user!.id }),
    enabled: Boolean(user?.id),
  });

  const ids = reports.map((r) => r.id);
  const { data: thumbs = {} } = useQuery({
    queryKey: ["report-thumbs", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("report_media")
        .select("report_id, file_url")
        .in("report_id", ids);
      const first = new Map<string, string>();
      for (const m of data ?? []) if (!first.has(m.report_id)) first.set(m.report_id, m.file_url as string);
      if (first.size === 0) return {} as Record<string, string>;
      const entries = [...first.entries()];
      const { data: signed } = await supabase.storage
        .from("report-media")
        .createSignedUrls(entries.map((e) => e[1]), 3600);
      const out: Record<string, string> = {};
      entries.forEach(([rid], i) => {
        const url = signed?.[i]?.signedUrl;
        if (url) out[rid] = url;
      });
      return out;
    },
  });

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (category !== "all" && r.category_key !== category) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (
            !r.title.toLowerCase().includes(q) &&
            !r.public_issue_id.toLowerCase().includes(q) &&
            !r.district.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [reports, status, category, search],
  );

  return (
    <Page
      title={t("my_reports")}
      description={
        lang === "en"
          ? "All issues you have reported, with their current status."
          : "आपकी सभी दर्ज शिकायतें और उनकी वर्तमान स्थिति।"
      }
    >
      <div className="card-surface grid gap-4 p-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="search">{lang === "en" ? "Search" : "खोजें"}</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "en" ? "Issue ID or title" : "आईडी या शीर्षक"}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status-filter">{lang === "en" ? "Status" : "स्थिति"}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status-filter" className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {Object.keys(STATUS_LABELS).map((s) => (
                <SelectItem key={s} value={s}>
                  {pick(STATUS_LABELS[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-filter">{lang === "en" ? "Category" : "श्रेणी"}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category-filter" className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {CATEGORY_KEYS.map((c) => (
                <SelectItem key={c} value={c}>
                  {pick(CATEGORY_LABELS[c])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && filtered.length === 0 ? (
          <EmptyState
            title={lang === "en" ? "No reports found" : "कोई शिकायत नहीं मिली"}
            hint={
              lang === "en"
                ? "Try changing the filters, or report a new issue."
                : "फ़िल्टर बदलें या नई शिकायत दर्ज करें।"
            }
          />
        ) : null}
        {filtered.map((r) => (
          <Link
            key={r.id}
            to="/reports/$id"
            params={{ id: r.id }}
            className="card-surface flex gap-4 p-4 transition-colors hover:bg-muted"
          >
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
              {thumbs[r.id] ? (
                <img
                  src={thumbs[r.id]}
                  alt={`Photo evidence for ${r.title}`}
                  loading="lazy"
                  decoding="async"
                  width={80}
                  height={80}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground" aria-hidden="true">
                  <ImageIcon className="size-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm text-muted-foreground">{r.public_issue_id}</span>
                <span className="flex gap-2">
                  <PriorityBadge priority={r.priority} />
                  <StatusBadge status={r.status} />
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">{r.title}</p>
              <p className="text-sm text-muted-foreground">
                {pick(CATEGORY_LABELS[r.category_key])} · {r.district} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
