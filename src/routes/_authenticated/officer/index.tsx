import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { PriorityBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/lib/i18n";
import { fetchReports } from "@/lib/reports";
import { CATEGORY_KEYS, CATEGORY_LABELS, DISTRICTS, STATUS_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/officer/")({
  component: OfficerDashboard,
});

function OfficerDashboard() {
  const { lang, t, pick } = useLang();
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["all-reports"],
    queryFn: () => fetchReports(),
  });

  const stats = useMemo(() => {
    const resolved = reports.filter((r) => r.status === "resolved" && r.resolved_at);
    const avgDays =
      resolved.length > 0
        ? resolved.reduce(
            (sum, r) =>
              sum +
              (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) /
                86400000,
            0,
          ) / resolved.length
        : 0;
    return {
      newReports: reports.filter((r) => r.status === "submitted").length,
      high: reports.filter((r) => r.priority === "high" && r.status !== "resolved").length,
      awaiting: reports.filter((r) => ["under_review", "info_requested"].includes(r.status)).length,
      assigned: reports.filter((r) => ["approved", "assigned"].includes(r.status)).length,
      progress: reports.filter((r) => r.status === "in_progress").length,
      resolved: resolved.length,
      avgDays: avgDays ? `${avgDays.toFixed(1)} ${lang === "en" ? "days" : "दिन"}` : "—",
    };
  }, [reports, lang]);

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (district !== "all" && r.district !== district) return false;
        if (status !== "all" && r.status !== status) return false;
        if (priority !== "all" && r.priority !== priority) return false;
        if (category !== "all" && r.category_key !== category) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!r.title.toLowerCase().includes(q) && !r.public_issue_id.toLowerCase().includes(q))
            return false;
        }
        return true;
      }),
    [reports, district, status, priority, category, search],
  );

  return (
    <Page
      title={lang === "en" ? "Officer Dashboard" : "अधिकारी डैशबोर्ड"}
      description={
        lang === "en"
          ? "AI helps decisions. Humans approve actions."
          : "एआई निर्णय में मदद करता है। कार्रवाई मनुष्य स्वीकृत करते हैं।"
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={lang === "en" ? "New Reports" : "नई शिकायतें"} value={stats.newReports} />
        <StatCard
          label={lang === "en" ? "High Priority" : "उच्च प्राथमिकता"}
          value={stats.high}
          tone="warning"
        />
        <StatCard
          label={lang === "en" ? "Awaiting Review" : "समीक्षा शेष"}
          value={stats.awaiting}
          tone="accent"
        />
        <StatCard label={lang === "en" ? "Assigned" : "सौंपी गई"} value={stats.assigned} />
        <StatCard label={t("in_progress")} value={stats.progress} tone="warning" />
        <StatCard label={t("resolved")} value={stats.resolved} tone="success" />
        <StatCard
          label={lang === "en" ? "Average Resolution Time" : "औसत समाधान समय"}
          value={stats.avgDays}
          tone="accent"
        />
      </div>

      <div className="card-surface mt-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="o-search">{lang === "en" ? "Search" : "खोजें"}</Label>
          <Input
            id="o-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <FilterSelect
          id="o-district"
          label={lang === "en" ? "District" : "जिला"}
          value={district}
          onChange={setDistrict}
          options={DISTRICTS.map((d) => ({ value: d, label: d }))}
          allLabel={t("all")}
        />
        <FilterSelect
          id="o-status"
          label={lang === "en" ? "Status" : "स्थिति"}
          value={status}
          onChange={setStatus}
          options={Object.keys(STATUS_LABELS).map((s) => ({
            value: s,
            label: pick(STATUS_LABELS[s]),
          }))}
          allLabel={t("all")}
        />
        <FilterSelect
          id="o-priority"
          label={lang === "en" ? "Priority" : "प्राथमिकता"}
          value={priority}
          onChange={setPriority}
          options={[
            { value: "high", label: lang === "en" ? "High" : "उच्च" },
            { value: "medium", label: lang === "en" ? "Medium" : "मध्यम" },
            { value: "low", label: lang === "en" ? "Low" : "कम" },
          ]}
          allLabel={t("all")}
        />
        <FilterSelect
          id="o-category"
          label={lang === "en" ? "Category" : "श्रेणी"}
          value={category}
          onChange={setCategory}
          options={CATEGORY_KEYS.map((c) => ({ value: c, label: pick(CATEGORY_LABELS[c]) }))}
          allLabel={t("all")}
        />
      </div>

      <div className="mt-4 grid gap-3">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && filtered.length === 0 ? (
          <EmptyState title={lang === "en" ? "No reports match" : "कोई शिकायत नहीं मिली"} />
        ) : null}
        {filtered.map((r) => (
          <div key={r.id} className="card-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-muted-foreground">{r.public_issue_id}</span>
              <span className="flex flex-wrap gap-2">
                {r.ai_duplicate_count > 1 ? (
                  <span className="rounded-md bg-info/12 px-2.5 py-1 text-sm text-info">
                    {lang === "en"
                      ? `Possible duplicates: ${r.ai_duplicate_count}`
                      : `संभावित डुप्लिकेट: ${r.ai_duplicate_count}`}
                  </span>
                ) : null}
                <PriorityBadge priority={r.priority} />
                <StatusBadge status={r.status} />
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold">{r.title}</p>
            <p className="text-sm text-muted-foreground">
              {pick(CATEGORY_LABELS[r.category_key])} · {r.district} ·{" "}
              {new Date(r.created_at).toLocaleDateString()}
            </p>
            <Button asChild className="mt-3">
              <Link to="/officer/$id" params={{ id: r.id }}>
                {lang === "en" ? "Review report" : "समीक्षा करें"}
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </Page>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-12 text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
