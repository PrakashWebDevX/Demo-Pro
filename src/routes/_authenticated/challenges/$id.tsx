import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, CircleDot, Sparkles, Star } from "lucide-react";
import { Page } from "@/components/app/Page";
import { MediaGallery } from "@/components/app/MediaGallery";
import { UniversityInviteForm } from "@/components/app/UniversityInviteForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { isStaffRole, useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { fetchDirectory, type InnovationPartner } from "@/lib/assignment";
import { fetchReportMedia, type ReportMediaItem } from "@/lib/reports";
import {
  CHALLENGE_STAGES,
  CHALLENGE_STAGE_LABELS,
  ROLE_FOR_GROUP,
  ROLE_LABELS,
  clearRole,
  fetchChallenge,
  fetchAllFeedback,
  fetchFeedbackSummary,
  fetchMyFeedback,
  impactOf,
  saveImpact,
  submitFeedback,
  FEEDBACK_STAGES,
  fetchLinkedReportIds,
  fetchPartnerRows,
  fetchPlan,
  fetchTimelineRows,
  groupOf,
  markResponse,
  saveSelection,
  scorePartner,
  sendInvitations,
  setStage,
  fetchUniversityVerifications,
  type Challenge,
  type ChallengePartnerRow,
  type ChallengeStage,
  type GroupKey,
  type SelectedRole,
} from "@/lib/challenges";

export const Route = createFileRoute("/_authenticated/challenges/$id")({
  head: () => ({
    meta: [
      { title: "Innovation Challenge — Eco-Bridge" },
      { name: "description", content: "Innovation challenge details, partner matching and public progress." },
      { property: "og:title", content: "Innovation Challenge — Eco-Bridge" },
      { property: "og:description", content: "AI suggests. Government decides." },
    ],
  }),
  component: ChallengePage,
});

function ChallengePage() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const { tr } = useLang();
  const qc = useQueryClient();
  const staff = isStaffRole(role);

  const { data: challenge, isLoading, error } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => fetchChallenge(id),
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["challenge-timeline", id],
    queryFn: () => fetchTimelineRows(id),
  });

  // Realtime: RLS filters what each user receives.
  useEffect(() => {
    const ch = supabase
      .channel(`challenge-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "innovation_challenges", filter: `id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["challenge", id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "innovation_challenge_timeline", filter: `challenge_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["challenge-timeline", id] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "innovation_challenge_partners", filter: `challenge_id=eq.${id}` }, () =>
        qc.invalidateQueries({ queryKey: ["challenge-partners", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (isLoading) return <Page title={tr("Loading…")}><p className="text-muted-foreground">{tr("Loading…")}</p></Page>;
  if (error || !challenge) {
    return (
      <Page title={tr("Challenge not found")}>
        <p className="text-muted-foreground">
          {error ? String((error as Error).message) : tr("This challenge is not available to your account.")}
        </p>
        <Button asChild className="mt-3"><Link to="/challenges">{tr("All challenges")}</Link></Button>
      </Page>
    );
  }

  return staff ? (
    <StaffView challenge={challenge} timeline={timeline} />
  ) : (
    <CitizenView challenge={challenge} timeline={timeline} />
  );
}

function StageRail({ timeline, current }: { timeline: Awaited<ReturnType<typeof fetchTimelineRows>>; current: string }) {
  const curIdx = CHALLENGE_STAGES.indexOf(current as ChallengeStage);
  return (
    <ol className="space-y-3">
      {timeline.map((t) => {
        const Icon = t.step_status === "completed" ? CheckCircle2 : t.step_status === "in_progress" ? CircleDot : Circle;
        return (
          <li key={t.id} className="flex gap-3">
            <Icon className={`mt-0.5 size-5 shrink-0 ${t.step_status === "completed" ? "text-success" : t.step_status === "in_progress" ? "text-accent" : "text-muted-foreground"}`} aria-hidden="true" />
            <div>
              <p className={t.step_status === "upcoming" ? "text-muted-foreground" : "font-medium"}>
                {t.title}
                {!t.is_public ? <span className="ml-2 rounded bg-muted px-1.5 text-xs text-muted-foreground">internal</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.step_status === "in_progress" ? "In progress · " : t.step_status === "upcoming" ? "Upcoming · " : ""}
                {new Date(t.created_at).toLocaleDateString()}
                {t.detail ? ` · ${t.detail}` : ""}
              </p>
            </div>
          </li>
        );
      })}
      {timeline.length === 0 ? <li className="text-muted-foreground">No updates yet.</li> : null}
      <li className="pt-2 text-xs text-muted-foreground">
        Workflow: {CHALLENGE_STAGES.map((s, i) => (
          <span key={s} className={i === curIdx ? "font-semibold text-foreground" : ""}>
            {CHALLENGE_STAGE_LABELS[s]}{i < CHALLENGE_STAGES.length - 1 ? " → " : ""}
          </span>
        ))}
      </li>
    </ol>
  );
}

function CitizenView({ challenge: c, timeline }: { challenge: Challenge; timeline: Awaited<ReturnType<typeof fetchTimelineRows>> }) {
  const { tr } = useLang();
  return (
    <Page title={c.title} description={`${c.location ?? c.district ?? ""}`}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-5">
            <p className="text-sm font-medium text-accent">{tr("Current stage")}: {CHALLENGE_STAGE_LABELS[c.stage]}</p>
            <Progress value={c.progress_pct} className="mt-3" aria-label={tr("Project progress")} />
            <p className="mt-1 text-xs text-muted-foreground">{c.progress_pct}%</p>
            <p className="mt-4">{c.public_summary ?? c.problem_statement}</p>
            {c.expected_impact || c.target_metric ? (
              <p className="mt-3"><b>{tr("Expected impact: ")}</b>{c.expected_impact ?? c.target_metric}</p>
            ) : null}
          </div>
          <ImpactCard challenge={c} />
          <CitizenFeedback challenge={c} />
        </div>
        <div className="card-surface h-fit p-5">
          <h2 className="mb-4 text-lg font-semibold">{tr("Public updates")}</h2>
          <StageRail timeline={timeline} current={c.stage} />
        </div>
      </div>
    </Page>
  );
}

function StaffView({ challenge: c, timeline }: { challenge: Challenge; timeline: Awaited<ReturnType<typeof fetchTimelineRows>> }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const by = profile?.full_name ?? "Government Officer";

  const { data: dir } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });
  const { data: rows = [] } = useQuery({ queryKey: ["challenge-partners", c.id], queryFn: () => fetchPartnerRows(c.id) });
  const { data: plan } = useQuery({ queryKey: ["challenge-plan", c.id], queryFn: () => fetchPlan(c.id) });
  const { data: media = [] } = useQuery({
    queryKey: ["challenge-media", c.id],
    queryFn: async () => {
      const ids = await fetchLinkedReportIds(c.id);
      const all: ReportMediaItem[] = [];
      for (const rid of ids.slice(0, 10)) all.push(...(await fetchReportMedia(rid)));
      return all;
    },
  });

  const partners = dir?.partners ?? [];
  const universityPartnerIds = partners.filter((partner) => partner.partner_kind === "university").map((partner) => partner.id);
  const { data: universityVerifications = [] } = useQuery({
    queryKey: ["challenge-university-verifications", c.id, universityPartnerIds.join(",")],
    queryFn: () => fetchUniversityVerifications(universityPartnerIds),
    enabled: universityPartnerIds.length > 0,
  });
  const verificationByPartner = new Map(universityVerifications.map((verification) => [verification.partner_id, verification]));
  const names = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p.name])), [partners]);

  const ranked = useMemo(() => {
    const out: Record<GroupKey, { p: InnovationPartner; score: number; reason: string; parts: ReturnType<typeof scorePartner>["parts"] | null }[]> = {
      university: [], industry: [], csr: [],
    };
    for (const p of partners.filter((x) => x.active_status)) {
      const s = scorePartner(p, c);
      const stored = rows.find((r) => r.partner_id === p.id);
      out[groupOf(p)].push({
        p,
        score: stored?.match_score ?? s.total,
        reason: stored?.match_reason ?? s.reason,
        parts: stored?.match_score ? null : s.parts,
      });
    }
    for (const k of Object.keys(out) as GroupKey[]) out[k].sort((a, b) => b.score - a.score);
    return out;
  }, [partners, rows, c]);

  const [shortlist, setShortlist] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Partial<Record<SelectedRole, string | null>>>({});
  const [pilot, setPilot] = useState("");
  const [timelineText, setTimelineText] = useState("");
  const [metric, setMetric] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShortlist(Object.fromEntries(rows.map((r) => [r.partner_id, r.shortlisted])));
    const sel: Partial<Record<SelectedRole, string | null>> = {};
    for (const r of rows) if (r.selected_role) sel[r.selected_role] = r.partner_id;
    setSelected(sel);
  }, [rows]);
  useEffect(() => {
    setPilot(plan?.pilot_location ?? "");
    setTimelineText(plan?.timeline_text ?? "");
    setNote(plan?.internal_note ?? "");
  }, [plan]);
  useEffect(() => setMetric(c.target_metric ?? ""), [c.target_metric]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["challenge", c.id] });
    qc.invalidateQueries({ queryKey: ["challenge-partners", c.id] });
    qc.invalidateQueries({ queryKey: ["challenge-plan", c.id] });
    qc.invalidateQueries({ queryKey: ["challenge-timeline", c.id] });
  };

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const scores = Object.fromEntries(
    (Object.keys(ranked) as GroupKey[]).flatMap((g) => ranked[g].map((x) => [x.p.id, { score: x.score, reason: x.reason, group: g }])),
  );

  const save = () =>
    run(
      () => saveSelection(c, rows, { shortlist, selected, scores, plan: { pilot_location: pilot, timeline_text: timelineText, target_metric: metric, internal_note: note } }, by),
      "Partner selection saved",
    );

  const rowFor = (role: SelectedRole) => rows.find((r) => r.selected_role === role);
  const declined = rows.filter((r) => r.invitation_status === "declined" && r.selected_role);

  return (
    <Page title={c.title} description={`${c.challenge_code} · ${c.location ?? c.district ?? ""}`}>
      <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
        <Sparkles className="size-4" aria-hidden="true" /> AI suggests. Government decides.
      </p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Field k="Challenge ID" v={c.challenge_code} />
              <Field k="Category" v={c.category_label ?? c.category_key} />
              <Field k="Urban / Rural" v={c.area_type ? c.area_type.charAt(0).toUpperCase() + c.area_type.slice(1) : "—"} />
              <Field k="District / Location" v={[c.district, c.location].filter(Boolean).join(" · ")} />
              <Field k="Related citizen reports" v={String(c.related_report_count)} />
              <Field k="Priority" v={c.priority} />
              <Field k="Suggested department" v={c.department_name} />
              <Field k="Assigned officer" v={c.officer_name} />
              <Field k="Current stage" v={CHALLENGE_STAGE_LABELS[c.stage]} />
              <Field k="Created" v={new Date(c.created_at).toLocaleDateString()} />
              <Field k="Target metric" v={c.target_metric} />
              <Field k="Solution" v={c.solution} />
            </dl>
            <p className="mt-4"><b>Problem statement: </b>{c.problem_statement}</p>
            {c.ai_reason ? <p className="mt-2"><b>AI innovation reason: </b>{c.ai_reason}</p> : null}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="stage">Move stage</Label>
                <Select value={c.stage} onValueChange={(v) => run(() => setStage(c, v as ChallengeStage, by), "Stage updated")}>
                  <SelectTrigger id="stage" className="h-11 w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHALLENGE_STAGES.map((s) => <SelectItem key={s} value={s}>{CHALLENGE_STAGE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">AI partner recommendations</h2>
            <p className="text-sm text-muted-foreground">
              Score = Expertise 40 · Location 15 · Capacity 15 · Availability 10 · Past experience 10 · Stage preference 10. Officer may override.
            </p>
            <Tabs defaultValue="university" className="mt-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="university">Universities / Colleges</TabsTrigger>
                <TabsTrigger value="industry">Startups / Industries</TabsTrigger>
                <TabsTrigger value="csr">CSR / Funding</TabsTrigger>
              </TabsList>
              {(Object.keys(ranked) as GroupKey[]).map((g) => (
                <TabsContent key={g} value={g} className="space-y-3">
                  {ranked[g].length === 0 ? <p className="text-muted-foreground">No partners in the directory.</p> : null}
                  {ranked[g].map(({ p, score, reason, parts }) => {
                    const role = ROLE_FOR_GROUP[g];
                    const isSel = selected[role] === p.id;
                    const inv = rows.find((r) => r.partner_id === p.id)?.invitation_status;
                    const verification = verificationByPartner.get(p.id);
                    const invitationEligible = g !== "university" || (verification?.verification_status === "verified" && verification.eligibility_to_invite && p.active_status);
                    return (
                      <div key={p.id} className={`rounded-lg border p-4 ${isSel ? "border-accent" : ""}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-sm text-muted-foreground">{p.organization_type} · {p.city}, {p.state}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-accent">{score}%</p>
                            <span className="rounded bg-muted px-2 py-0.5 text-xs">{g === "university" ? `Verification: ${verification?.verification_status ?? "unverified"}` : "Demo Partner Data"}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm"><b>Expertise:</b> {p.expertise_labels.join(", ")}</p>
                        <p className="text-sm"><b>Capacity:</b> {Math.max(0, p.available_team_capacity - p.current_workload)} of {p.available_team_capacity} teams free · <b>Current projects:</b> {p.current_workload}</p>
                        <p className="mt-1 text-sm"><b>Why recommended:</b> {reason}</p>
                        {parts ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {parts.map((x) => `${x.label} ${x.points}/${x.max}`).join(" · ")}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox disabled={!invitationEligible} checked={!!shortlist[p.id]} onCheckedChange={(v) => setShortlist((s) => ({ ...s, [p.id]: !!v }))} />
                            Shortlist
                          </label>
                          <Button size="sm" disabled={!invitationEligible} variant={isSel ? "default" : "outline"} onClick={() => setSelected((s) => ({ ...s, [role]: isSel ? null : p.id }))}>
                            {isSel ? `Selected as ${ROLE_LABELS[role]}` : `Select as ${ROLE_LABELS[role]}`}
                          </Button>
                          {inv && inv !== "none" ? <span className="text-sm capitalize text-muted-foreground">Invitation: {inv.replace(/_/g, " ")}</span> : null}
                        </div>
                        {g === "university" ? (
                          <UniversityInviteForm
                            challengeId={c.id}
                            partnerId={p.id}
                            partnerActive={p.active_status}
                            verification={verification}
                            invitationStatus={inv}
                            onSent={refresh}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">Project plan (internal)</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="pilot">Pilot location</Label><Input id="pilot" value={pilot} onChange={(e) => setPilot(e.target.value)} className="h-11" /></div>
              <div className="space-y-1"><Label htmlFor="tl">Project timeline</Label><Input id="tl" value={timelineText} onChange={(e) => setTimelineText(e.target.value)} className="h-11" /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="metric">Target impact metric</Label><Input id="metric" value={metric} onChange={(e) => setMetric(e.target.value)} className="h-11" /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="note">Internal officer note (never shown to citizens)</Label><Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Lead University: <b>{names[selected.lead_university ?? ""] ?? "—"}</b> · Technical Partner: <b>{names[selected.tech_partner ?? ""] ?? "—"}</b> · CSR (optional): <b>{names[selected.csr_partner ?? ""] ?? "—"}</b>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={save} disabled={busy || !user}>Save selection</Button>
              <Button variant="outline" disabled={busy} onClick={() => run(() => sendInvitations(c, rows, by, names), "Collaboration invitation sent")}>
                Send Collaboration Invitation
              </Button>
            </div>
          </div>

          <div className="card-surface border-dashed p-5">
            <h2 className="text-lg font-semibold">Demo partner response panel (staff only)</h2>
            <p className="text-sm text-muted-foreground">Simulates partner replies — no separate partner logins in this demo.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => sendInvitations(c, rows, by, names), "Invitation sent")}>Partner Invitation Sent</Button>
              {(["lead_university", "tech_partner", "csr_partner"] as SelectedRole[]).map((r) => {
                const row = rowFor(r);
                const label = r === "lead_university" ? "University Accepted" : r === "tech_partner" ? "Startup / Industry Accepted" : "CSR Partner Accepted";
                return (
                  <Button key={r} size="sm" variant="outline" disabled={busy || !row || row.invitation_status === "accepted"}
                    onClick={() => row && run(() => markResponse(c, row, true, by, names[row.partner_id] ?? ""), label)}>
                    {label}
                  </Button>
                );
              })}
              <DeclineButton rows={rows} names={names} disabled={busy} onDecline={(row) => run(() => markResponse(c, row, false, by, names[row.partner_id] ?? ""), "Marked as declined")} />
              <Button size="sm" variant="outline" disabled={busy || declined.length === 0}
                onClick={() => run(async () => { for (const d of declined) await clearRole(c, d, by); }, "Select an alternate partner in the tabs above")}>
                Select Alternate Partner
              </Button>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {rows.filter((r) => r.selected_role).map((r) => (
                <li key={r.id}>{ROLE_LABELS[r.selected_role!]}: <b>{names[r.partner_id]}</b> — <span className="capitalize">{r.invitation_status}</span></li>
              ))}
            </ul>
          </div>

          <ImpactCard challenge={c} />
          <ImpactEditor challenge={c} by={by} onSaved={refresh} />
          <StaffFeedback challengeId={c.id} />

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">Challenge Evidence</h2>
            {media.length > 0 ? (
              <MediaGallery media={media} publicId={c.challenge_code} className="mt-3" />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No evidence photos linked to this challenge yet.</p>
            )}
          </div>

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">Resolution Evidence</h2>
            <p className="mt-3 text-sm text-muted-foreground">Resolution photo will be added after field verification.</p>
          </div>
        </div>

        <div className="card-surface h-fit p-5">
          <h2 className="mb-2 text-lg font-semibold">Activity timeline</h2>
          <Progress value={c.progress_pct} className="mb-4" aria-label="Project progress" />
          <StageRail timeline={timeline} current={c.stage} />
        </div>
      </div>
    </Page>
  );
}

function DeclineButton({ rows, names, disabled, onDecline }: { rows: ChallengePartnerRow[]; names: Record<string, string>; disabled: boolean; onDecline: (r: ChallengePartnerRow) => void }) {
  const candidates = rows.filter((r) => r.selected_role && r.invitation_status !== "declined");
  const [pick, setPick] = useState<string>("");
  return (
    <div className="flex items-center gap-2">
      <Select value={pick} onValueChange={setPick}>
        <SelectTrigger className="h-9 w-48" aria-label="Partner to decline"><SelectValue placeholder="Partner…" /></SelectTrigger>
        <SelectContent>
          {candidates.map((r) => <SelectItem key={r.id} value={r.id}>{names[r.partner_id] ?? r.partner_id}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={disabled || !pick}
        onClick={() => { const r = rows.find((x) => x.id === pick); if (r) { onDecline(r); setPick(""); } }}>
        Partner Declined
      </Button>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v || "—"}</dd>
    </div>
  );
}

export function ImpactCard({ challenge: c }: { challenge: Challenge }) {
  const { tr } = useLang();
  const i = impactOf(c);
  const { data: fb } = useQuery({ queryKey: ["challenge-fb-summary", c.id], queryFn: () => fetchFeedbackSummary(c.id) });
  if (i.base === null && !fb?.responses) return null;
  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-semibold">{tr("Impact so far", "अब तक का प्रभाव")}</h2>
      {i.base !== null ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-bold">{i.base}</p><p className="text-xs text-muted-foreground">{tr("Reports before", "पहले की शिकायतें")}</p></div>
            <div><p className="text-2xl font-bold">{i.cur ?? "—"}</p><p className="text-xs text-muted-foreground">{tr("Reports now", "अब की शिकायतें")}</p></div>
            <div><p className="text-2xl font-bold text-success">{i.reduction !== null ? `${i.reduction}%` : "—"}</p><p className="text-xs text-muted-foreground">{tr("Reduction", "कमी")}</p></div>
          </div>
          {i.target ? (
            <>
              <Progress value={i.toTarget ?? 0} className="mt-4" aria-label={tr("Progress to target")} />
              <p className="mt-1 text-xs text-muted-foreground">
                {tr("Target: {t}% fewer reports", "लक्ष्य: {t}% कम शिकायतें", { t: i.target })} · {i.toTarget ?? 0}% {tr("of target reached", "लक्ष्य प्राप्त")}
                {c.measurement_period ? ` · ${c.measurement_period}` : ""}
              </p>
            </>
          ) : null}
        </>
      ) : null}
      {fb?.responses ? (
        <p className="mt-3 text-sm">{tr("Citizen rating", "नागरिक रेटिंग")}: <b>{fb.avg} / 5</b> ({fb.responses})</p>
      ) : null}
    </div>
  );
}

function CitizenFeedback({ challenge: c }: { challenge: Challenge }) {
  const { tr } = useLang();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const open = FEEDBACK_STAGES.includes(c.stage);
  const { data: mine, isLoading } = useQuery({
    queryKey: ["challenge-my-fb", c.id, user?.id],
    queryFn: () => fetchMyFeedback(c.id, user!.id),
    enabled: Boolean(user?.id) && open,
  });
  async function send() {
    if (rating < 1) { toast.error(tr("Please choose a rating.", "कृपया रेटिंग चुनें।")); return; }
    setBusy(true);
    try {
      await submitFeedback(c.id, rating, comment);
      toast.success(tr("Thank you for your feedback", "आपकी प्रतिक्रिया के लिए धन्यवाद"));
      qc.invalidateQueries({ queryKey: ["challenge-my-fb", c.id] });
      qc.invalidateQueries({ queryKey: ["challenge-fb-summary", c.id] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-semibold">{tr("Feedback", "प्रतिक्रिया")}</h2>
      {!open ? (
        <p className="mt-2 text-muted-foreground">{tr("Feedback opens after the field pilot starts.", "क्षेत्रीय परीक्षण शुरू होने पर प्रतिक्रिया खुलेगी।")}</p>
      ) : isLoading ? null : mine ? (
        <p className="mt-2 flex items-center gap-2 text-success"><CheckCircle2 className="size-5" aria-hidden="true" />{tr("You rated this pilot {r} / 5.", "आपने {r} / 5 रेटिंग दी।", { r: mine.rating })}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p>{tr("Has the problem improved in your area?", "क्या आपके क्षेत्र में समस्या में सुधार हुआ है?")}</p>
          <div className="flex gap-2" role="radiogroup" aria-label={tr("Rating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} type="button" size="lg" variant={rating >= n ? "default" : "outline"} role="radio" aria-checked={rating === n} onClick={() => setRating(n)}>
                <Star className="size-5" aria-hidden="true" /><span className="sr-only">{n}</span>
              </Button>
            ))}
          </div>
          <Textarea rows={3} value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder={tr("Optional comment", "वैकल्पिक टिप्पणी")} aria-label={tr("Comment")} />
          <Button onClick={send} disabled={busy}>{tr("Send feedback", "प्रतिक्रिया भेजें")}</Button>
        </div>
      )}
    </div>
  );
}

function ImpactEditor({ challenge: c, by, onSaved }: { challenge: Challenge; by: string; onSaved: () => void }) {
  const [base, setBase] = useState(c.baseline_reports?.toString() ?? String(c.related_report_count));
  const [cur, setCur] = useState(c.current_reports?.toString() ?? "");
  const [target, setTarget] = useState(c.target_reduction_pct?.toString() ?? "");
  const [period, setPeriod] = useState(c.measurement_period ?? "");
  const [busy, setBusy] = useState(false);
  const num = (v: string) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0));
  async function save() {
    setBusy(true);
    try {
      await saveImpact(c, { baseline: num(base), current: num(cur), target: num(target), period }, by);
      toast.success("Impact measurement saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-semibold">Record impact measurement</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="ib">Related reports before pilot</Label><Input id="ib" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} className="h-11" /></div>
        <div className="space-y-1"><Label htmlFor="ic">Related reports in latest period</Label><Input id="ic" inputMode="numeric" value={cur} onChange={(e) => setCur(e.target.value)} className="h-11" /></div>
        <div className="space-y-1"><Label htmlFor="it">Target reduction (%)</Label><Input id="it" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} className="h-11" /></div>
        <div className="space-y-1"><Label htmlFor="ip">Measurement period</Label><Input id="ip" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-11" /></div>
      </div>
      <Button className="mt-4" onClick={save} disabled={busy}>Save measurement</Button>
    </div>
  );
}

function StaffFeedback({ challengeId }: { challengeId: string }) {
  const { data = [] } = useQuery({ queryKey: ["challenge-fb-all", challengeId], queryFn: () => fetchAllFeedback(challengeId) });
  if (data.length === 0) return null;
  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-semibold">Citizen feedback ({data.length})</h2>
      <ul className="mt-3 space-y-2">
        {data.map((f) => (
          <li key={f.id} className="rounded-md bg-muted p-3 text-sm">
            <b>{f.rating} / 5</b> · {new Date(f.created_at).toLocaleDateString()}
            {f.comment ? <p className="mt-1">{f.comment}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
