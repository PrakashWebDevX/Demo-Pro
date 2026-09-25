import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ensureAssignment, fetchDirectory, saveDecision, type Match } from "@/lib/assignment";
import { changeReportStatus, type ReportRow } from "@/lib/reports";
import { CATEGORY_LABELS } from "@/lib/constants";

export function DemoBadge() {
  return (
    <Badge variant="outline" className="ml-1 border-accent/50 text-[10px] font-medium text-accent">
      Demo Partner Data
    </Badge>
  );
}

export function AiApprovesNote() {
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
      <ShieldCheck className="size-4" aria-hidden="true" /> AI recommends. Government approves.
    </p>
  );
}

function MatchList({ title, items }: { title: string; items?: Match[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ol className="space-y-2">
        {items.map((m, i) => (
          <li key={m.id} className={`rounded-md border p-3 text-sm ${i === 0 ? "border-accent bg-accent/5" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {m.name}
                <DemoBadge />
              </span>
              <span className="font-semibold text-accent">Match {m.score}%</span>
            </div>
            <p className="text-muted-foreground">{m.subtitle}</p>
            <p className="text-muted-foreground">
              {m.location} · Workload: {m.workload}
            </p>
            <p className="mt-1">Reason: {m.reason}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AssignmentPanel({
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
  const a = asgQ.data;
  const dir = dirQ.data;

  const [type, setType] = useState<"standard" | "innovation">("standard");
  const [dept, setDept] = useState("");
  const [off, setOff] = useState("");
  const [uni, setUni] = useState("");
  const [partner, setPartner] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!a) return;
    setType((a.final_resolution_type ?? a.suggested_resolution_type) as "standard" | "innovation");
    setDept(a.final_department_id ?? a.suggested_department_id ?? "");
    setOff(a.final_officer_id ?? a.suggested_officer_id ?? "");
    setUni(a.final_university_id ?? a.suggested_university_id ?? a.top_matches.universities?.[0]?.id ?? "");
    setPartner(a.final_partner_id ?? a.suggested_partner_id ?? a.top_matches.partners?.[0]?.id ?? "");
    setOwner(a.final_owner_name ?? "");
    setDue(a.due_date ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
    setNote(a.officer_note ?? "");
  }, [a]);

  if (dirQ.isError || asgQ.isError) {
    return (
      <div className="card-surface p-5">
        <p className="font-semibold">AI Assignment Recommendations</p>
        <p className="mt-2 text-sm text-destructive">
          Could not load the directory. Has the Smart Assignment setup script been run?
        </p>
        <Button className="mt-3" variant="outline" onClick={() => { dirQ.refetch(); asgQ.refetch(); }}>
          Retry
        </Button>
      </div>
    );
  }
  if (!a || !dir) {
    return <div className="card-surface p-5 text-sm text-muted-foreground">Preparing AI recommendations…</div>;
  }

  const name = (id: string | null, list: { id: string; name?: string; full_name?: string; department_name?: string }[]) => {
    const x = list.find((l) => l.id === id);
    return x ? (x.full_name ?? x.department_name ?? x.name ?? "—") : "—";
  };
  const universities = dir.partners.filter((p) => p.partner_kind === "university");
  const partners = dir.partners.filter((p) => p.partner_kind === "partner");
  const officersForDept = dir.officers.filter((o) => !dept || o.department_id === dept || o.department_id === null);
  const decided = a.recommendation_status !== "pending";

  async function refresh() {
    await Promise.all(
      [["assignment", report.id], ["report", report.id], ["timeline", report.id], ["directory"], ["all-reports"]].map(
        (k) => qc.invalidateQueries({ queryKey: k }),
      ),
    );
  }

  async function save() {
    if (!dept || !off) { toast.error("Select a department and an officer."); return; }
    if (type === "innovation" && (!uni || !partner)) { toast.error("Select a university and a partner."); return; }
    setBusy(true);
    try {
      await saveDecision({
        assignment: a!,
        report,
        dir: dir!,
        userId,
        userName,
        decision: { resolutionType: type, departmentId: dept, officerId: off, universityId: uni || null, partnerId: partner || null, ownerName: owner, dueDate: due || null, note },
      });
      await refresh();
      toast.success("Assignment saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function simple(status: "rejected" | "info_requested") {
    setBusy(true);
    try {
      await changeReportStatus({
        reportId: report.id,
        currentStatus: report.status,
        newStatus: status,
        remark: note.trim() || (status === "rejected" ? "Report rejected after review." : "Please share more details or photos."),
        userId,
        userName,
      });
      if (status === "rejected") {
        await (await import("@/integrations/supabase/client")).supabase
          .from("report_assignments" as never)
          .update({ recommendation_status: "rejected", decided_by: userId, decided_by_name: userName, decided_at: new Date().toISOString() } as never)
          .eq("id" as never, a!.id as never);
      }
      await refresh();
      toast.success("Report updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const innov = a.suggested_resolution_type === "innovation";

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-lg font-semibold text-accent">
          <Sparkles className="size-5" aria-hidden="true" /> AI Assignment Recommendations
        </p>
        <AiApprovesNote />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Demo Data — Replace with Verified Government and Partner Directory in Production.
      </p>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p>Category: <b>{CATEGORY_LABELS[report.category_key]?.en ?? report.category_key}</b></p>
        <p>Priority: <b className="capitalize">{a.suggested_priority}</b></p>
        <p>Area: <b className="capitalize">{a.area_type}</b> · District: <b>{report.district}</b></p>
        <p>Related / duplicate reports: <b>{a.related_count}</b></p>
        <p>
          Resolution type:{" "}
          <b className={innov ? "text-accent" : ""}>{innov ? "Innovation Challenge" : "Standard Government Fix"}</b>
        </p>
        <p>Confidence: <b>{a.confidence}%</b></p>
        <p>Best department: <b>{name(a.suggested_department_id, dir.departments)}</b></p>
        <p>Best officer: <b>{name(a.suggested_officer_id, dir.officers)}</b></p>
        {innov ? (
          <>
            <p>University: <b>{name(a.suggested_university_id, dir.partners)}</b></p>
            <p>Industry partner: <b>{name(a.suggested_partner_id, dir.partners)}</b></p>
            <p className="sm:col-span-2">Innovation theme: <b>{a.suggested_innovation_theme}</b></p>
          </>
        ) : null}
      </div>
      <p className="mt-3 rounded-md bg-background p-3 text-sm">{a.reasoning}</p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold">Top 3 matches for each type</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <MatchList title="Departments" items={a.top_matches.departments} />
          <MatchList title="Officers" items={a.top_matches.officers} />
          <MatchList title="Universities" items={a.top_matches.universities} />
          <MatchList title="Industry / Startup / CSR" items={a.top_matches.partners} />
        </div>
      </details>

      {decided ? (
        <div className="mt-4 rounded-md border bg-background p-3 text-sm">
          <p className="font-semibold">Audit record</p>
          <p>
            AI suggested: {name(a.suggested_department_id, dir.departments)} / {name(a.suggested_officer_id, dir.officers)} (
            {a.suggested_resolution_type})
          </p>
          <p>
            Officer selected: {name(a.final_department_id, dir.departments)} / {name(a.final_officer_id, dir.officers)} (
            {a.final_resolution_type ?? "—"}) — <b className="capitalize">{a.recommendation_status}</b>
          </p>
          <p>
            By {a.decided_by_name ?? "—"} on {a.decided_at ? new Date(a.decided_at).toLocaleString() : "—"}
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Resolution type</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={type === "standard" ? "default" : "outline"} onClick={() => setType("standard")}>
              Standard Government Fix
            </Button>
            <Button type="button" variant={type === "innovation" ? "default" : "outline"} onClick={() => setType("innovation")}>
              Innovation Challenge
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Department</Label>
          <Select value={dept} onValueChange={(v) => { setDept(v); setOff(""); }}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {dir.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Officer</Label>
          <Select value={off} onValueChange={setOff}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select officer" /></SelectTrigger>
            <SelectContent>
              {officersForDept.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name} — {o.designation} ({o.current_open_assignments}/{o.max_assignment_capacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {type === "innovation" ? (
          <>
            <div className="space-y-2">
              <Label>University partner</Label>
              <Select value={uni} onValueChange={setUni}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select university" /></SelectTrigger>
                <SelectContent>{universities.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Industry / startup / CSR partner</Label>
              <Select value={partner} onValueChange={setPartner}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select partner" /></SelectTrigger>
                <SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="owner">Final owner</Label>
          <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Defaults to selected officer" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due">Due date</Label>
          <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Internal officer note (not shown to citizen)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={save}>
          {decided ? "Update assignment" : "Approve & Save Assignment"}
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => simple("info_requested")}>Request more information</Button>
        <Button disabled={busy} variant="destructive" onClick={() => simple("rejected")}>Reject report</Button>
      </div>
    </div>
  );
}
