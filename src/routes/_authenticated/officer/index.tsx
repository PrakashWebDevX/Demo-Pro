import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { PAGE_SIZE, Pagination } from "@/components/app/Pagination";
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
import { useAuth, isStaffRole } from "@/lib/auth";
import { fetchReports, fetchReportThumbnails } from "@/lib/reports";
import { CATEGORY_KEYS, CATEGORY_LABELS, DISTRICTS, STATUS_LABELS } from "@/lib/constants";
import { CHALLENGE_STAGE_LABELS } from "@/lib/challenges";
import { fetchOperationsDashboard, subscribeOperationsDashboard } from "@/lib/operations";

export const Route = createFileRoute("/_authenticated/officer/")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search["status"] === "string" ? search["status"] : undefined,
    priority: typeof search["priority"] === "string" ? search["priority"] : undefined,
    type: search["type"] === "simple" || search["type"] === "innovation" ? (search["type"] as string) : undefined,
  }),
  component: OfficerDashboard,
});

function OfficerDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { lang, t, pick } = useLang();
  const searchParams = Route.useSearch();
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState(searchParams.status ?? "all");
  const [priority, setPriority] = useState(searchParams.priority ?? "all");
  const [category, setCategory] = useState("all");
  const [caseType, setCaseType] = useState<string>(searchParams.type ?? "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["all-reports"],
    queryFn: () => fetchReports(),
    enabled: isStaffRole(role),
  });

  const operations = useQuery({
    queryKey: ["operations-dashboard"],
    queryFn: fetchOperationsDashboard,
    enabled: isStaffRole(role),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (role === "university_partner" || role === "industry_partner") {
      void navigate({ to: "/partner", replace: true });
      return;
    }
    if (!isStaffRole(role)) return;
    return subscribeOperationsDashboard(() => {
      void operations.refetch();
    });
  }, [navigate, operations.refetch, role]);

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
        if (caseType === "simple" && r.is_innovation) return false;
        if (caseType === "innovation" && !r.is_innovation) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!r.title.toLowerCase().includes(q) && !r.public_issue_id.toLowerCase().includes(q))
            return false;
        }
        return true;
      }).sort((a, b) => {
        if (caseType === "all") return 0;
        const needs = (s: string) => (["submitted", "under_review", "info_requested"].includes(s) ? 0 : 1);
        return needs(a.status) - needs(b.status);
      }),
    [reports, district, status, priority, category, search, caseType],
  );

  const masterCounts = {
    simple: reports.filter((r) => !r.is_innovation).length,
    innovation: reports.filter((r) => r.is_innovation).length,
  };
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [district, status, priority, category, search, caseType]);
  useEffect(() => setCaseType(searchParams.type ?? "all"), [searchParams.type]);
  const applyCaseType = (next: string) => {
    setCaseType(next);
    void navigate({
      to: "/officer",
      search: (prev) => ({ status: prev.status, priority: prev.priority, type: next === "simple" || next === "innovation" ? next : undefined }),
      replace: true,
    });
  };

  const visibleIds = useMemo(() => visible.map((r) => r.id), [visible]);
  const { data: thumbnails = {} } = useQuery({
    queryKey: ["report-thumbnails", visibleIds],
    queryFn: () => fetchReportThumbnails(visibleIds),
    enabled: isStaffRole(role) && visibleIds.length > 0,
  });

  if (!isStaffRole(role)) {
    return <Page title={lang === "en" ? "Access restricted" : "पहुंच प्रतिबंधित"}><EmptyState title={lang === "en" ? "This dashboard is for government staff." : "यह डैशबोर्ड सरकारी कर्मचारियों के लिए है।"} /></Page>;
  }

  return (
    <Page
      title={lang === "en" ? "Officer Dashboard" : "अधिकारी डैशबोर्ड"}
      description={
        lang === "en"
          ? "AI helps decisions. Humans approve actions."
          : "एआई निर्णय में मदद करता है। कार्रवाई मनुष्य स्वीकृत करते हैं।"
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {([
          { key: "simple", title: "Simple Issues", text: "Standard reports with direct department resolution.", button: "View Simple Issues", count: masterCounts.simple },
          { key: "innovation", title: "Innovation Issues", text: "Complex reports requiring innovation review or challenge workflow.", button: "View Innovation Issues", count: masterCounts.innovation },
        ] as const).map((c) => (
          <section key={c.key} className={`card-surface p-6 ${caseType === c.key ? "ring-2 ring-accent" : ""}`}>
            <p className="text-sm font-medium text-accent">AI recommends. Government approves.</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{c.title}</h2>
              <span className="text-sm font-semibold text-muted-foreground">
                {isLoading ? "Loading…" : `${c.title}: ${c.count}`}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{c.text}</p>
            <Button className="mt-4 min-h-11 w-full sm:w-auto" onClick={() => { applyCaseType(c.key); document.getElementById("o-search")?.scrollIntoView({ behavior: "smooth" }); }}>
              {c.button}
            </Button>
          </section>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="col-span-full flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{lang === "en" ? "Operations Overview" : "संचालन अवलोकन"}</h2>
          <Button type="button" variant="outline" onClick={() => void operations.refetch()} disabled={operations.isFetching}>
            {operations.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {operations.isLoading ? <p className="col-span-full text-muted-foreground">Loading operations data…</p> : null}
        {operations.error ? <p className="col-span-full rounded-md bg-destructive/10 p-3 text-destructive">Could not load operations data. Check the connected database schema and RLS.</p> : null}
        {operations.data ? <>
          <DashboardLink label="Total Reports" value={operations.data.overview.total} href="/officer" />
          <DashboardLink label="Simple Issues" value={operations.data.overview.simple} href="/officer?status=submitted" />
          <DashboardLink label="Innovation Problems" value={operations.data.overview.innovation} href="/innovation" />
          <DashboardLink label="Needs Review" value={operations.data.overview.needsReview} href="/officer?status=under_review" tone="accent" />
          <DashboardLink label="High / Critical Priority" value={operations.data.overview.highCritical} href="/officer?priority=high" tone="warning" />
          <DashboardLink label="Resolved This Month" value={operations.data.overview.resolvedThisMonth} href="/officer?status=resolved" tone="success" />
          <DashboardLink label="Overdue" value={operations.data.overview.overdue} href="/officer" tone="warning" />
        </> : null}
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

      {operations.data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <InsightPanel title="Simple Issues — Direct Government Action">
            <CountList values={operations.data.simple} labels={{ ...Object.fromEntries(Object.entries(STATUS_LABELS).map(([key, label]) => [key, pick(label)])), overdue: "Overdue" }} hrefPrefix="/officer?status=" />
          </InsightPanel>
          <InsightPanel title="Innovation Problems — Long-Term Community Solutions">
            <CountList values={operations.data.innovation} labels={CHALLENGE_STAGE_LABELS} hrefPrefix="/innovation" />
          </InsightPanel>
          <InsightPanel title="Area and Category Insights">
            <p>Urban: <strong>{operations.data.areas.urban}</strong> · Rural: <strong>{operations.data.areas.rural}</strong></p>
            <p className="mt-2">{operations.data.areas.districts.slice(0, 3).map((item) => `${item.name}: ${item.count}`).join(" · ") || "No area data"}</p>
            <p className="mt-2">Top categories: {operations.data.categories.slice(0, 3).map((item) => `${pick(CATEGORY_LABELS[item.key]) || item.key} (${item.count})`).join(", ") || "No category data"}</p>
            <p className="mt-2">Priority: {operations.data.priorities.map((item) => `${item.key} (${item.count})`).join(", ") || "No priority data"}</p>
          </InsightPanel>
        </div>
      ) : null}

      {operations.data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <InsightPanel title="Department Workload">
            {operations.data.departments.length > 0 ? operations.data.departments.map((department) => (
              <div key={department.id} className="flex justify-between gap-3 border-b py-2 last:border-0"><span>{department.name}</span><span className="font-semibold">{department.open} open · {department.total} total</span></div>
            )) : <p className="text-muted-foreground">No department workload data.</p>}
          </InsightPanel>
          <InsightPanel title="My Work Queue">
            <p className="text-muted-foreground">Individual officer queue will be available after officer account mapping is configured.</p>
          </InsightPanel>
        </div>
      ) : null}

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

      {caseType === "simple" || caseType === "innovation" ? (
        <div className="card-surface mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="font-semibold">Showing: {caseType === "simple" ? "Simple Issues" : "Innovation Issues"}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => applyCaseType("all")}>Clear Filter</Button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && filtered.length === 0 ? (
          <EmptyState title={lang === "en" ? "No reports match" : "कोई शिकायत नहीं मिली"} />
        ) : null}
        {visible.map((r) => (
          <div key={r.id} className="card-surface flex gap-4 p-4">
            {thumbnails[r.id] ? (
              <img
                src={thumbnails[r.id]}
                alt={lang === "en" ? "Report photo" : "शिकायत की तस्वीर"}
                className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-24 sm:w-24"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:h-24 sm:w-24"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 sm:h-8 sm:w-8">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
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
              {caseType === "innovation" ? (
                <p className="mt-2 text-sm">
                  AI classification: <strong>{r.ai_category ?? "Innovation Problem"}</strong> · Related reports: <strong>{r.ai_duplicate_count}</strong> · Suggested department: <strong>{r.ai_recommended_department ?? "—"}</strong>
                  <span className="block text-muted-foreground">University and industry partners are shown on the linked challenge.</span>
                </p>
              ) : null}
              <Button asChild className="mt-3">
                <Link to="/officer/$id" params={{ id: r.id }}>
                  {lang === "en" ? "Review report" : "समीक्षा करें"}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} total={filtered.length} onPage={setPage} />
    </Page>
  );
}

function DashboardLink({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "default" | "warning" | "success" | "accent" }) {
  return <a href={href}><StatCard label={label} value={value} tone={tone ?? "default"} /></a>;
}

function InsightPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card-surface p-4"><h2 className="text-lg font-bold">{title}</h2><div className="mt-3 text-sm">{children}</div></section>;
}

function CountList({ values, labels, hrefPrefix }: { values: Record<string, number>; labels: Record<string, string>; hrefPrefix: string }) {
  return <div>{Object.entries(values).map(([key, value]) => <a key={key} href={hrefPrefix === "/innovation" || key === "overdue" ? (hrefPrefix === "/innovation" ? "/innovation" : "/officer") : `${hrefPrefix}${key}`} className="flex justify-between border-b py-2 last:border-0"><span>{labels[key] ?? key}</span><strong>{value}</strong></a>)}</div>;
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
