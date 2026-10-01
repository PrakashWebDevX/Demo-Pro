import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CivicMapView, DISTRICT_LEGEND, normDistrict, type DistrictStats, type MapPoint } from "@/components/app/CivicMapView";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, FlaskConical, GraduationCap, Factory, ImageOff, MapPinOff, Map as MapIcon, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState, Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isStaffRole } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { fetchReports, fetchReportThumbnails } from "@/lib/reports";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { subscribeOperationsDashboard } from "@/lib/operations";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Jharkhand Civic Impact Map — Eco-Bridge" },
      { name: "description", content: "Colour-coded view of permitted civic reports, resolved outcomes and approved innovation opportunities in Jharkhand." },
      { property: "og:title", content: "Jharkhand Civic Impact Map — Eco-Bridge" },
      { property: "og:description", content: "See reports, resolved outcomes and government-approved innovation opportunities by area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CivicMap,
});

type KindKey = "needs" | "progress" | "resolved" | "review" | "innovation" | "university" | "industry" | "high";
const KINDS: Record<KindKey, { color: string; label: string; legend: string; icon: LucideIcon }> = {
  needs: { color: "#F59E0B", label: "Needs Action", legend: "Orange", icon: AlertTriangle },
  progress: { color: "#2563EB", label: "Work in Progress", legend: "Blue", icon: Clock },
  resolved: { color: "#16A34A", label: "Resolved", legend: "Green", icon: CheckCircle2 },
  review: { color: "#9333EA", label: "Innovation Review", legend: "Purple", icon: Lightbulb },
  innovation: { color: "#6D28D9", label: "Government-Approved Innovation Case", legend: "Violet", icon: FlaskConical },
  university: { color: "#0F766E", label: "University Research Opportunity", legend: "Teal", icon: GraduationCap },
  industry: { color: "#4338CA", label: "Industry Pilot Opportunity", legend: "Indigo", icon: Factory },
  high: { color: "#DC2626", label: "High Priority", legend: "Red", icon: AlertTriangle },
};
const LEGEND_TEXT: Record<KindKey, string> = {
  needs: "Needs Action", progress: "Work in Progress", resolved: "Resolved", review: "Innovation Review",
  innovation: "Innovation Case", university: "University Opportunity", industry: "Industry Opportunity", high: "High Priority",
};

interface MapItem {
  id: string;
  imageKey: string;
  title: string;
  category: string;
  area: string | null;
  statusText: string;
  summary: string | null;
  kinds: KindKey[];
  isInnovation: boolean;
  partnerCase: boolean;
  lat: number | null;
  lng: number | null;
  href: { to: "/officer/$id" | "/reports/$id" | "/innovation/$id"; id: string } | null;
}

function statusKind(s: string): KindKey | null {
  if (["submitted", "under_review", "info_requested", "approved", "assigned"].includes(s)) return "needs";
  if (s === "in_progress") return "progress";
  if (s === "resolved" || s === "closed") return "resolved";
  return null;
}

const FILTERS: Array<{ key: string; label: string; test: (i: MapItem) => boolean; partner?: boolean }> = [
  { key: "all", label: "All permitted reports", test: () => true },
  { key: "service", label: "Service Requests", test: (i) => !i.isInnovation },
  { key: "progress", label: "In Progress", test: (i) => i.kinds.includes("progress") },
  { key: "resolved", label: "Resolved", test: (i) => i.kinds.includes("resolved") },
  { key: "review", label: "Potential Innovation Cases", test: (i) => i.isInnovation },
  { key: "high", label: "High Priority", test: (i) => i.kinds.includes("high") },
];

function CivicMap() {
  const { role, user } = useAuth();
  const { pick } = useLang();
  const staff = isStaffRole(role);
  const partner = role === "university_partner" || role === "industry_partner";
  const citizen = !staff && !partner && Boolean(user);
  const [filter, setFilter] = useState("all");
  const [district, setDistrict] = useState("all");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const navigate = useNavigate();

  const reportsQ = useQuery({
    queryKey: ["map-reports", staff ? "staff" : user?.id],
    queryFn: () => (staff ? fetchReports() : fetchReports({ citizenId: user!.id })),
    enabled: staff || citizen,
  });
  const casesQ = useQuery({
    queryKey: ["approved-innovation-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_projects")
        .select("id,title,description,district,category_key,status,expected_outcome,source_report_id")
        .not("source_report_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: partner,
  });

  useEffect(() => {
    if (!staff) return;
    return subscribeOperationsDashboard(() => void reportsQ.refetch());
  }, [staff, reportsQ.refetch]);

  const items: MapItem[] = useMemo(() => {
    if (partner) {
      const kind: KindKey = role === "university_partner" ? "university" : "industry";
      return (casesQ.data ?? []).map((c) => ({
        id: c.id,
        imageKey: c.source_report_id as string,
        title: c.title,
        category: c.category_key ? pick(CATEGORY_LABELS[c.category_key]) || c.category_key : "",
        area: c.district || null,
        statusText: c.status ?? "",
        summary: c.description,
        kinds: [kind, "innovation"],
        isInnovation: true,
        partnerCase: true,
        lat: null,
        lng: null,
        href: { to: "/innovation/$id", id: c.id },
      }));
    }
    return (reportsQ.data ?? []).map((r) => {
      const sk = statusKind(r.status);
      const kinds: KindKey[] = [];
      if (sk) kinds.push(sk);
      if (r.is_innovation) kinds.push("review");
      if (r.priority === "high" && r.status !== "resolved" && r.status !== "closed") kinds.push("high");
      const area = [r.village_or_ward, r.district].filter(Boolean).join(", ") || null;
      return {
        id: r.id,
        imageKey: r.id,
        title: r.title,
        category: pick(CATEGORY_LABELS[r.category_key]) || r.category_key,
        area,
        statusText: STATUS_LABELS[r.status] ? pick(STATUS_LABELS[r.status]) : r.status,
        summary: r.officer_remark,
        kinds,
        isInnovation: r.is_innovation,
        partnerCase: false,
        lat: staff ? r.latitude : null,
        lng: staff ? r.longitude : null,
        href: { to: staff ? "/officer/$id" : "/reports/$id", id: r.id },
      };
    });
  }, [partner, role, casesQ.data, reportsQ.data, pick, staff]);

  const filters = partner ? FILTERS.slice(0, 1) : FILTERS;
  const districts = useMemo(() => [...new Set(items.map((i) => i.area?.split(", ").pop()).filter(Boolean) as string[])].sort(), [items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]!;
  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          active.test(i) &&
          (district === "all" || i.area?.split(", ").pop() === district) &&
          (category === "all" || i.category === category),
      ),
    [items, active, district, category],
  );
  const ids = useMemo(() => shown.slice(0, 60).map((i) => i.imageKey), [shown]);
  const { data: thumbs = {} } = useQuery({
    queryKey: ["map-thumbs", ids],
    queryFn: () => fetchReportThumbnails(ids),
    enabled: ids.length > 0,
    retry: false,
  });
  const loading = reportsQ.isLoading || casesQ.isLoading;
  const error = reportsQ.error || casesQ.error;
  const filtersActive = filter !== "all" || district !== "all" || category !== "all";
  const legendKeys = (Object.keys(KINDS) as KindKey[]);
  // Exact points only for staff; citizens/partners never get coordinates on the map.
  const mapPoints: MapPoint[] = useMemo(
    () =>
      staff
        ? shown.flatMap((i) => {
            if (i.lat == null || i.lng == null || !Number.isFinite(i.lat) || !Number.isFinite(i.lng)) return [];
            const order: KindKey[] = ["high", "university", "industry", "innovation", "review", "progress", "resolved", "needs"];
            const primary = order.find((k) => i.kinds.includes(k));
            return [{
              id: i.id, lat: i.lat, lng: i.lng, title: i.title, category: i.category,
              area: i.area ?? "", statusText: i.statusText,
              labels: i.kinds.map((k) => KINDS[k].label).join(" · "),
              color: primary ? KINDS[primary].color : "#6B7280",
              innovation: i.isInnovation, resolved: i.kinds.includes("resolved"), partnerCase: i.partnerCase, high: i.kinds.includes("high"),
            }];
          })
        : [],
    [shown, staff],
  );
  // District totals from the same filtered, role-permitted collection as the list.
  const districtStats: DistrictStats = useMemo(() => {
    const out: DistrictStats = {};
    for (const i of shown) {
      const name = i.area?.split(", ").pop()?.trim();
      if (!name) continue;
      const key = normDistrict(name);
      const s = (out[key] ??= { reportDistrict: name, total: 0, needs: 0, progress: 0, resolved: 0, innovation: 0, partnerCases: 0 });
      s.total++;
      if (i.kinds.includes("needs")) s.needs++;
      if (i.kinds.includes("progress")) s.progress++;
      if (i.kinds.includes("resolved")) s.resolved++;
      if (i.isInnovation) s.innovation++;
      if (i.partnerCase) s.partnerCases++;
    }
    return out;
  }, [shown]);
  const totals = useMemo(() => ({
    active: shown.filter((i) => i.kinds.includes("needs") || i.kinds.includes("progress")).length,
    resolved: shown.filter((i) => i.kinds.includes("resolved")).length,
    innovation: shown.filter((i) => i.isInnovation).length,
    partner: shown.filter((i) => i.partnerCase).length,
  }), [shown]);
  const partnerLabel = role === "university_partner" ? "University" : role === "industry_partner" ? "Industry" : null;
  const cards: Array<[string, number]> = [
    ...(partner ? [] : ([["Active Reports", totals.active], ["Resolved Reports", totals.resolved]] as Array<[string, number]>)),
    ["Innovation Cases", totals.innovation],
    ...(partnerLabel ? ([[`${partnerLabel} Opportunities`, totals.partner]] as Array<[string, number]>) : []),
  ];

  return (
    <Page title="Jharkhand Civic Impact Map" description={staff ? "Updates from available report data." : "Based on currently available report data."}>
      {!loading && !error ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([label, n]) => (
            <div key={label} className="card-surface min-w-0 p-3">
              <p className="text-2xl font-bold">{n}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      ) : null}
      <section className="card-surface flex flex-col gap-2 p-3 sm:p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><MapIcon className="size-5 shrink-0" aria-hidden="true" />Jharkhand Civic Impact Map</h2>
        <p className="text-sm text-muted-foreground">District colours and markers follow the filters below. Zoom in to see individual reports. The list underneath shows the same reports as text.</p>
        <CivicMapView
          points={mapPoints}
          resetKey={resetKey}
          canOpen={staff}
          onOpen={(id) => void navigate({ to: "/officer/$id", params: { id } })}
          emptyText={mapPoints.length === 0 ? (staff ? (loading ? null : "No report locations match these filters.") : "No report locations are available for this role.") : null}
          districtStats={districtStats}
          legend={legendKeys.map((k) => ({ color: KINDS[k].color, label: LEGEND_TEXT[k], icon: KINDS[k].icon }))}
          partnerLabel={partnerLabel}
          onDistrictFilter={(name) => { setDistrict(name); setOpenId(null); }}
        />
        <details className="rounded-lg border p-3 text-sm" open>
          <summary className="cursor-pointer font-semibold">District Activity</summary>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="District Activity legend">
            {DISTRICT_LEGEND.map((d) => (
              <li key={d.label} className="flex min-w-0 items-center gap-2">
                <span className="size-5 shrink-0 rounded-sm border-2" style={{ backgroundColor: d.fill, borderColor: d.border }} aria-hidden="true" />
                <span>{d.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">District boundaries: geoBoundaries (Pathways Data / lgdirectory.gov.in), ODbL 1.0.</p>
        </details>
        <div className="text-center">
        <ul className="mt-4 grid w-full max-w-3xl grid-cols-1 gap-2 text-left text-sm sm:grid-cols-2 lg:grid-cols-4" aria-label="Legend">
          {legendKeys.map((k) => {
            const K = KINDS[k];
            return (
              <li key={k} className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: K.color }}>
                  <K.icon className="size-3.5 text-primary-foreground" aria-hidden="true" />
                </span>
                <span>{K.legend}: {LEGEND_TEXT[k]}</span>
              </li>
            );
          })}
        </ul>
        </div>
      </section>

      <div className="card-surface mt-4 p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
          {filters.map((f) => {
            const count = items.filter(f.test).length;
            return (
              <Button key={f.key} type="button" variant={filter === f.key ? "default" : "outline"} className="min-h-11 shrink-0" onClick={() => setFilter(f.key)}>
                {f.label}{loading ? "" : ` (${count})`}
              </Button>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <MiniSelect id="m-district" label="District" value={district} onChange={setDistrict} options={districts} />
          <MiniSelect id="m-category" label="Category" value={category} onChange={setCategory} options={categories} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void (partner ? casesQ.refetch() : reportsQ.refetch())}>Refresh</Button>
            {filtersActive ? (
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setFilter("all"); setDistrict("all"); setCategory("all"); setResetKey((k) => k + 1); }}>Clear Filters</Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {loading ? <p className="text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-destructive">Could not load report data.</p> : null}
        {!loading && !error && shown.length === 0 ? (
          <EmptyState title={partner ? "No government-approved innovation cases are available." : "No reports match these filters."} />
        ) : null}
        {shown.map((i) => {
          const primary = i.kinds[0];
          const K = primary ? KINDS[primary] : null;
          const open = openId === i.id;
          const img = thumbs[i.imageKey];
          return (
            <article key={i.id} className="card-surface p-4">
              <button type="button" className="flex w-full min-w-0 items-start gap-3 text-left" onClick={() => setOpenId(open ? null : i.id)} aria-expanded={open}>
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: K?.color ?? "#6B7280" }} aria-hidden="true">
                  {K ? <K.icon className="size-4 text-primary-foreground" /> : <MapPinOff className="size-4 text-primary-foreground" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold">{i.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[i.category, i.area ?? "Location unavailable or private."].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {i.kinds.map((k) => (
                      <span key={k} className="rounded-md border px-2 py-0.5 text-xs font-medium" style={{ borderColor: KINDS[k].color, color: KINDS[k].color }}>{KINDS[k].label}</span>
                    ))}
                  </span>
                </span>
              </button>
              {open ? (
                <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[160px_1fr]">
                  {img ? (
                    <img src={img} alt="Report evidence" className="h-32 w-full rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-32 w-full flex-col items-center justify-center rounded-lg bg-muted p-2 text-center text-xs text-muted-foreground">
                      <ImageOff className="mb-1 size-5" aria-hidden="true" />
                      <span>Evidence image unavailable</span>
                      <span>Government verification in progress</span>
                    </div>
                  )}
                  <div className="min-w-0 text-sm">
                    {i.partnerCase ? <p className="font-semibold text-accent">Government-Approved Innovation Case</p> : null}
                    {i.statusText ? <p>Status: <strong>{i.statusText}</strong></p> : null}
                    {i.summary ? <p className="mt-1 line-clamp-4 break-words">{i.summary}</p> : null}
                    {i.partnerCase ? <p className="mt-2 text-muted-foreground">AI suggestions are advisory. Government approval is required before any pilot or implementation.</p> : null}
                    {i.href ? (
                      <Button asChild className="mt-3 min-h-11">
                        <Link to={i.href.to} params={{ id: i.href.id }}>View Details</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </Page>
  );
}

function MiniSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
