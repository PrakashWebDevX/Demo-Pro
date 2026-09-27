import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImageOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { fetchReportThumbnails } from "@/lib/reports";
import { CATEGORY_LABELS } from "@/lib/constants";
import { INNOVATION_STAGE_LABELS } from "@/lib/innovation";

interface ReportLike {
  id: string;
  title: string;
  description: string;
  district: string;
  category_key: string;
  is_innovation: boolean;
}

const CHECKLIST = [
  "Public-safe title confirmed",
  "General location only",
  "No citizen personal details",
  "Only approved evidence images",
  "Public summary reviewed",
];

/**
 * Officer-only. Partner visibility reuses the existing innovation_projects table:
 * a linked project with status "open" is what partners already see as an open case.
 */
export function PartnerVisibilityCard({ report }: { report: ReportLike }) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [busy, setBusy] = useState(false);
  const key = ["partner-visibility", report.id];
  const { data: project, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_projects")
        .select("id,status,assigned_partner_id")
        .eq("source_report_id", report.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!report.is_innovation) return null;
  const approved = Boolean(project);
  const removable = project && project.status === "open" && !project.assigned_partner_id;

  async function approve() {
    setBusy(true);
    const { error } = await supabase.from("innovation_projects").insert({
      source_report_id: report.id,
      title: report.title,
      description: report.description,
      district: report.district,
      category_key: report.category_key,
      status: "open",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Approved for partner viewing");
    await queryClient.invalidateQueries({ queryKey: key });
  }

  async function remove() {
    if (!project) return;
    setBusy(true);
    const { error } = await supabase.from("innovation_projects").delete().eq("id", project.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Partner access removed");
    setChecked(CHECKLIST.map(() => false));
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="card-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-5 text-accent" aria-hidden="true" /> Partner Visibility
      </h2>
      <p className="mt-2 text-sm">
        {isLoading ? "Loading…" : approved ? <b>Approved for partner viewing</b> : <b>Not approved for partner viewing</b>}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Only government-approved public-safe information will be visible to University and Industry partners.
      </p>
      {!approved && !isLoading ? (
        <>
          <ul className="mt-3 space-y-2">
            {CHECKLIST.map((item, i) => (
              <li key={item} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={`pv-${i}`}
                  checked={checked[i] === true}
                  onCheckedChange={(v) => setChecked((c) => c.map((x, j) => (j === i ? v === true : x)))}
                />
                <label htmlFor={`pv-${i}`} className="text-sm">{item}</label>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Checklist is a review aid only and is not saved.</p>
          <Button className="mt-3" onClick={approve} disabled={busy || !checked.every(Boolean)}>
            Approve for Partner Viewing
          </Button>
        </>
      ) : null}
      {removable ? (
        <Button variant="outline" className="mt-3" onClick={remove} disabled={busy}>
          Remove Partner Access
        </Button>
      ) : approved ? (
        <p className="mt-3 text-xs text-muted-foreground">Partner work has started on this case, so access can't be removed here.</p>
      ) : null}
    </div>
  );
}

/** Partner-facing list of government-approved innovation cases (linked to a report). */
export function ApprovedInnovationCases() {
  const { data: cases = [], isLoading } = useQuery({
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
  });
  const ids = cases.map((c) => c.source_report_id as string);
  const { data: thumbs = {} } = useQuery({
    queryKey: ["approved-case-thumbs", ids.join(",")],
    queryFn: () => fetchReportThumbnails(ids),
    enabled: ids.length > 0,
    retry: false,
  });

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Government-Approved Innovation Cases</h2>
      {isLoading ? <p className="mt-2 text-muted-foreground">Loading…</p> : null}
      {!isLoading && cases.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No government-approved innovation cases are available.</p>
      ) : null}
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {cases.map((c) => {
          const img = thumbs[c.source_report_id as string];
          return (
            <div key={c.id} className="card-surface flex flex-col gap-3 p-4 sm:flex-row">
              {img ? (
                <img src={img} alt={`Evidence for ${c.title}`} className="h-40 w-full shrink-0 rounded-lg object-cover sm:h-28 sm:w-28" loading="lazy" />
              ) : (
                <div className="flex h-28 w-full shrink-0 flex-col items-center justify-center rounded-lg bg-muted p-2 text-center text-xs text-muted-foreground sm:w-28">
                  <ImageOff className="mb-1 size-5" aria-hidden="true" />
                  <span>Evidence image unavailable</span>
                  <span>Government verification in progress</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-accent">Government-Approved Innovation Case</p>
                <h3 className="font-semibold break-words">{c.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {[c.category_key ? CATEGORY_LABELS[c.category_key]?.en ?? c.category_key : null, c.district].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 line-clamp-2 text-sm break-words">{c.description}</p>
                {c.expected_outcome ? <p className="mt-1 text-sm"><b>Government objective:</b> {c.expected_outcome}</p> : null}
                <p className="mt-2 text-xs font-medium">
                  {c.status === "open" ? "Open for Partner Review" : INNOVATION_STAGE_LABELS[c.status]?.en ?? c.status}
                </p>
                <Button asChild size="sm" className="mt-2">
                  <Link to="/innovation/$id" params={{ id: c.id }}>View Case Details</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
