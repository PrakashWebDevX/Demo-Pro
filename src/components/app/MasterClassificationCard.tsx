import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Layers, Lightbulb, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ensureAssignment, fetchDirectory, type Assignment } from "@/lib/assignment";
import type { ReportRow } from "@/lib/reports";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Kind = "standard" | "innovation";
type Classified = Assignment & {
  classification_status?: "pending_review" | "approved" | "changed" | "rejected";
  classification_final_type?: Kind | null;
  classification_change_reason?: string | null;
  classification_note?: string | null;
  classified_by_name?: string | null;
  classified_at?: string | null;
};

const LABEL: Record<Kind, string> = { standard: "Service Request", innovation: "Innovation Problem" };
const DESC: Record<Kind, string> = {
  standard: "For direct government service and field action.",
  innovation: "For repeated or complex issues requiring research, prototype, pilot, and partner collaboration.",
};
const STATUS_TEXT = { pending_review: "Pending Review", approved: "Approved", changed: "Changed", rejected: "Rejected" };

export function matchBand(score: number) {
  if (score >= 90) return "Strong match";
  if (score >= 75) return "Good match";
  if (score >= 60) return "Possible match";
  return "Manual review needed";
}
/** Transparent scores never shown as a flat 100%. */
const shown = (s: number) => Math.min(95, Math.round(s));

export function MasterClassificationCard({
  report,
  userId,
  userName,
}: {
  report: ReportRow & { area_type?: string | null };
  userId: string;
  userName: string;
}) {
  const qc = useQueryClient();
  const dirQ = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });
  const asgQ = useQuery({
    queryKey: ["assignment", report.id],
    enabled: !!dirQ.data,
    queryFn: () => ensureAssignment(report, dirQ.data!),
  });
  const a = asgQ.data as Classified | undefined;

  const [choice, setChoice] = useState<Kind>("standard");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!a) return;
    setChoice((a.classification_final_type ?? a.suggested_resolution_type) as Kind);
    setReason(a.classification_change_reason ?? "");
    setNote(a.classification_note ?? "");
  }, [a]);

  if (dirQ.isError || asgQ.isError) {
    return (
      <div className="card-surface p-5 text-sm">
        <p className="font-semibold">Master Problem Classification</p>
        <p className="mt-2 text-destructive">Could not load the classification. Please retry.</p>
      </div>
    );
  }
  if (!a) return <div className="card-surface p-5 text-sm text-muted-foreground">Preparing classification…</div>;

  const ai = a.suggested_resolution_type as Kind;
  const status = a.classification_status ?? "pending_review";
  const changed = choice !== ai;
  const tm = a.top_matches ?? {};
  const dept = tm.departments?.[0];
  const off = tm.officers?.[0];
  const uni = tm.universities?.[0];
  const partner = tm.partners?.[0];
  const conf = shown(a.confidence ?? 0);

  async function save(kind: Kind) {
    if (kind !== ai && !reason.trim()) {
      toast.error("Please give a reason for changing the AI recommendation.");
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await db
        .from("report_assignments")
        .update({
          classification_status: kind === ai ? "approved" : "changed",
          classification_final_type: kind,
          classification_change_reason: kind === ai ? null : reason.trim(),
          classification_note: note.trim() || null,
          classified_by: userId,
          classified_by_name: userName,
          classified_at: now,
          // Preselect the path in the assignment panel below.
          final_resolution_type: kind,
          updated_at: now,
        })
        .eq("id", a!.id);
      if (error) throw error;
      await db.from("report_updates").insert({
        report_id: report.id,
        old_status: report.status,
        new_status: report.status,
        remark:
          kind === "innovation"
            ? "Your report is contributing to an innovation solution for this community."
            : "Your issue has been assigned to the responsible department.",
        updated_by: userId,
        updated_by_name: userName,
      });
      await Promise.all(
        [["assignment", report.id], ["timeline", report.id]].map((k) => qc.invalidateQueries({ queryKey: k })),
      );
      toast.success(`Final decision saved: ${LABEL[kind]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save. Has the classification SQL been run?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="size-5 text-primary" aria-hidden="true" /> Master Problem Classification
        </h2>
        <span className="rounded-full border px-3 py-1 text-xs font-medium">{STATUS_TEXT[status]}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-accent">AI suggests. Government decides.</p>
      <p className="mt-1 text-xs text-muted-foreground">AI suggestions are advisory. Government officer approval is required before action.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Problem type">
        {(["standard", "innovation"] as Kind[]).map((k) => {
          const Icon = k === "standard" ? Wrench : Lightbulb;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={choice === k}
              onClick={() => setChoice(k)}
              className={cn(
                "rounded-lg border-2 p-4 text-left transition-colors",
                choice === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon className="size-4" aria-hidden="true" /> {LABEL[k]}
                {ai === k ? (
                  <span className="ml-auto rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">AI pick</span>
                ) : null}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{DESC[k]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-md bg-muted/50 p-4 text-sm">
        <p>
          AI recommendation: <b>{LABEL[ai]}</b> · Confidence <b>{conf}%</b> ({matchBand(conf)})
        </p>
        {a.reasoning ? <p className="mt-1 text-muted-foreground">{a.reasoning}</p> : null}
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          <li>Related reports: <b>{a.related_count}</b></li>
          <li>Priority: <b>{a.suggested_priority ?? report.priority}</b></li>
          <li>Area: <b>{a.area_type === "rural" ? "Rural" : "Urban"}</b> · {report.district}</li>
          <li>Category: <b>{report.category_key}</b></li>
          <li>Suggested department: <b>{dept ? `${dept.name} (${shown(dept.score)}%)` : "—"}</b></li>
          <li>Suggested officer: <b>{off ? `${off.name} (${shown(off.score)}%)` : "—"}</b></li>
          {ai === "innovation" || choice === "innovation" ? (
            <>
              <li>Suggested university: <b>{uni ? `${uni.name} (${shown(uni.score)}%)` : "—"}</b></li>
              <li>Suggested startup / industry: <b>{partner ? `${partner.name} (${shown(partner.score)}%)` : "—"}</b></li>
            </>
          ) : null}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Matching considers category, location, expertise, availability, workload, and project-stage fit.
        </p>
      </div>

      {changed ? (
        <div className="mt-4 space-y-2">
          <Label htmlFor="mc-reason">Reason for changing the AI recommendation (required)</Label>
          <Textarea id="mc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        <Label htmlFor="mc-note">Internal decision note (staff only)</Label>
        <Textarea id="mc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => save(ai)}>Approve AI Classification</Button>
        <Button variant="outline" disabled={busy} onClick={() => { setChoice("standard"); if (ai === "standard") void save("standard"); }}>
          Change to Service Request
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => { setChoice("innovation"); if (ai === "innovation") void save("innovation"); }}>
          Change to Innovation Problem
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => save(choice)}>Save Final Decision</Button>
        <Button
          variant="link"
          onClick={() => document.getElementById("assignment-panel")?.scrollIntoView({ behavior: "smooth" })}
        >
          Continue to Assignment
        </Button>
      </div>

      {a.classified_at ? (
        <div className="mt-4 border-t pt-3 text-sm">
          <p>AI suggested: <b>{LABEL[ai]}</b></p>
          <p>Officer decided: <b>{LABEL[(a.classification_final_type ?? ai) as Kind]}</b></p>
          {a.classification_change_reason ? <p className="text-muted-foreground">Reason: {a.classification_change_reason}</p> : null}
          <p className="text-xs text-muted-foreground">
            {a.classified_by_name ?? "Officer"} · {new Date(a.classified_at).toLocaleString()}
          </p>
        </div>
      ) : null}
    </div>
  );
}
