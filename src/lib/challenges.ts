/**
 * Innovation Challenges (phase 2) — AI recommends. Government approves.
 * Tables come from docs/sql/2026-09-25_innovation_phase2.sql (not yet in generated types).
 */
import { supabase } from "@/integrations/supabase/client";
import type { InnovationPartner } from "@/lib/assignment";
import type { ReportRow } from "@/lib/reports";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const CHALLENGE_STAGES = [
  "government_review",
  "approved",
  "partner_matching",
  "research",
  "prototype",
  "field_pilot",
  "evaluation",
  "deployment_approval",
  "scaled_closed",
] as const;
export type ChallengeStage = (typeof CHALLENGE_STAGES)[number];

export const CHALLENGE_STAGE_LABELS: Record<string, string> = {
  government_review: "Government Review",
  approved: "Approved for Innovation",
  partner_matching: "Partner Matching",
  research: "Research",
  prototype: "Prototype Development",
  field_pilot: "Field Pilot",
  evaluation: "Evaluation",
  deployment_approval: "Deployment Approval",
  scaled_closed: "Scaled / Closed",
};

const STAGE_PROGRESS: Record<string, number> = {
  government_review: 5, approved: 12, partner_matching: 22, research: 38, prototype: 55,
  field_pilot: 70, evaluation: 82, deployment_approval: 92, scaled_closed: 100,
};

export interface Challenge extends ChallengeImpact {
  id: string;
  challenge_code: string;
  source_report_id: string | null;
  title: string;
  problem_statement: string;
  public_summary: string | null;
  category_key: string | null;
  category_label: string | null;
  area_type: string | null;
  district: string | null;
  location: string | null;
  priority: string | null;
  related_report_count: number;
  ai_reason: string | null;
  department_name: string | null;
  officer_name: string | null;
  solution: string | null;
  target_metric: string | null;
  expected_impact: string | null;
  stage: string;
  progress_pct: number;
  is_public: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface ChallengePartnerRow {
  id: string;
  challenge_id: string;
  partner_id: string;
  group_key: GroupKey;
  match_score: number | null;
  match_reason: string | null;
  shortlisted: boolean;
  selected_role: SelectedRole | null;
  invitation_status: "none" | "sent" | "accepted" | "declined";
}

export interface ChallengePlan {
  challenge_id: string;
  pilot_location: string | null;
  timeline_text: string | null;
  internal_note: string | null;
  budget_note: string | null;
}

export interface TimelineRow {
  id: string;
  stage: string | null;
  title: string;
  detail: string | null;
  step_status: "completed" | "in_progress" | "upcoming";
  is_public: boolean;
  sort_order: number;
  created_by_name: string | null;
  created_at: string;
}

export type GroupKey = "university" | "industry" | "csr";
export type SelectedRole = "lead_university" | "tech_partner" | "csr_partner";
export const ROLE_FOR_GROUP: Record<GroupKey, SelectedRole> = {
  university: "lead_university",
  industry: "tech_partner",
  csr: "csr_partner",
};
export const ROLE_LABELS: Record<SelectedRole, string> = {
  lead_university: "Lead University",
  tech_partner: "Technical Startup / Industry Partner",
  csr_partner: "CSR / Funding Partner",
};

export function groupOf(p: Pick<InnovationPartner, "partner_kind" | "organization_type">): GroupKey {
  if (p.partner_kind === "university") return "university";
  return /csr|fund|foundation/i.test(p.organization_type) ? "csr" : "industry";
}

// ---------- Transparent matching score (100 max) ----------
export interface PartnerScore {
  total: number;
  parts: { label: string; points: number; max: number }[];
  reason: string;
}

const STAGE_PREF: Record<GroupKey, string[]> = {
  university: ["approved", "partner_matching", "research"],
  industry: ["prototype", "field_pilot"],
  csr: ["field_pilot", "deployment_approval", "scaled_closed"],
};

export function scorePartner(p: InnovationPartner, c: Pick<Challenge, "category_key" | "district" | "stage" | "title" | "problem_statement">): PartnerScore {
  const g = groupOf(p);
  const text = `${c.title} ${c.problem_statement}`.toLowerCase();
  const catOk = !!c.category_key && p.expertise_categories.includes(c.category_key);
  const domainHits = [...p.innovation_domains, ...p.expertise_labels].filter((d) =>
    d.toLowerCase().split(/[\s,/]+/).some((w) => w.length > 3 && text.includes(w)),
  ).length;
  const expertise = Math.min(40, (catOk ? 28 : 0) + Math.min(12, domainHits * 4));
  const location = p.city === c.district ? 15 : p.state === "Demo State" ? 7 : 0;
  const free = Math.max(0, p.available_team_capacity - p.current_workload) / Math.max(1, p.available_team_capacity);
  const capacity = Math.round(free * 13) + (p.available_team_capacity >= 4 ? 2 : 0);
  const availability = p.active_status ? (p.current_workload >= p.available_team_capacity ? 4 : 9) : 0;
  const past = Math.min(10, (catOk ? 5 : 1) + Math.min(4, p.current_workload * 2));
  const stagePref = STAGE_PREF[g].includes(c.stage) ? 8 : 5;
  const total = Math.min(96, Math.round(expertise + location + capacity + availability + past + stagePref));
  const bits = [
    catOk ? `expertise in ${p.expertise_labels.slice(0, 3).join(", ")}` : "limited direct expertise in this category",
    p.city === c.district ? `located in ${p.city}` : `based in ${p.city}`,
    free > 0.5 ? "team capacity available" : "limited team capacity",
  ];
  return {
    total,
    parts: [
      { label: "Expertise", points: expertise, max: 40 },
      { label: "Location", points: location, max: 15 },
      { label: "Capacity", points: capacity, max: 15 },
      { label: "Availability", points: availability, max: 10 },
      { label: "Past experience", points: past, max: 10 },
      { label: "Stage preference", points: stagePref, max: 10 },
    ],
    reason: `${bits.join("; ")}.`.replace(/^./, (x) => x.toUpperCase()),
  };
}

// ---------- Reads ----------
export async function fetchChallenges(): Promise<Challenge[]> {
  const { data, error } = await db.from("innovation_challenges").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await db.from("innovation_challenges").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchChallengeForReport(reportId: string): Promise<{ id: string; title: string; stage: string } | null> {
  const { data } = await db
    .from("innovation_challenge_reports")
    .select("challenge_id, innovation_challenges(id, title, stage)")
    .eq("report_id", reportId)
    .limit(1)
    .maybeSingle();
  return data?.innovation_challenges ?? null;
}

export async function fetchLinkedReportIds(challengeId: string): Promise<string[]> {
  const { data } = await db.from("innovation_challenge_reports").select("report_id").eq("challenge_id", challengeId);
  return (data ?? []).map((r: { report_id: string }) => r.report_id);
}

export async function fetchTimelineRows(challengeId: string): Promise<TimelineRow[]> {
  const { data, error } = await db
    .from("innovation_challenge_timeline")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function fetchPartnerRows(challengeId: string): Promise<ChallengePartnerRow[]> {
  const { data, error } = await db.from("innovation_challenge_partners").select("*").eq("challenge_id", challengeId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlan(challengeId: string): Promise<ChallengePlan | null> {
  const { data } = await db.from("innovation_challenge_plans").select("*").eq("challenge_id", challengeId).maybeSingle();
  return data;
}

// ---------- Writes (staff only; enforced by RLS) ----------
async function nextSort(challengeId: string) {
  const { data } = await db
    .from("innovation_challenge_timeline")
    .select("sort_order")
    .eq("challenge_id", challengeId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return ((data?.[0]?.sort_order as number) ?? 0) + 1;
}

export async function addTimeline(challengeId: string, row: { stage?: string; title: string; detail?: string; isPublic?: boolean; by?: string }) {
  await db.from("innovation_challenge_timeline").insert({
    challenge_id: challengeId,
    stage: row.stage ?? null,
    title: row.title,
    detail: row.detail ?? null,
    is_public: row.isPublic ?? true,
    step_status: "completed",
    sort_order: await nextSort(challengeId),
    created_by_name: row.by ?? null,
  });
}

export async function setStage(c: Challenge, stage: ChallengeStage, by: string) {
  if (c.stage === stage) return;
  const { error } = await db
    .from("innovation_challenges")
    .update({ stage, progress_pct: STAGE_PROGRESS[stage], updated_at: new Date().toISOString() })
    .eq("id", c.id);
  if (error) throw error;
  await addTimeline(c.id, { stage, title: `Stage: ${CHALLENGE_STAGE_LABELS[stage]}`, by });
}

async function notifyLinkedCitizens(c: Challenge, title: string, message: string) {
  const ids = await fetchLinkedReportIds(c.id);
  if (ids.length === 0) return;
  const { data } = await supabase.from("reports").select("id, citizen_id").in("id", ids);
  for (const r of data ?? []) {
    if (!r.citizen_id) continue;
    await db.from("notifications").insert({ user_id: r.citizen_id, report_id: r.id, title, message, type: "innovation" });
  }
}

async function notifyStaff(c: Challenge, title: string, message: string) {
  const reportId = c.source_report_id;
  if (!reportId) return;
  await db.rpc("notify_staff", { _report_id: reportId, _title: title, _message: message, _type: "innovation" });
}

/** Called after an officer saves an "Innovation Challenge" assignment. Idempotent per source report. */
export async function createChallengeFromReport(args: {
  report: ReportRow & { area_type?: string | null };
  departmentName: string | null;
  officerLabel: string | null;
  aiReason: string | null;
  theme: string | null;
  userId: string;
  userName: string;
}) {
  const r = args.report;
  const existing = await fetchChallengeForReport(r.id);
  if (existing) return existing.id;

  // Duplicates: open reports with same category in same district
  const { data: dups } = await supabase
    .from("reports")
    .select("id")
    .eq("category_key", r.category_key)
    .eq("district", r.district)
    .neq("status", "resolved")
    .limit(100);
  const linked = Array.from(new Set([r.id, ...(dups ?? []).map((d) => d.id)]));

  const code = `IC-${r.public_issue_id.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase()}`;
  const { data: c, error } = await db
    .from("innovation_challenges")
    .insert({
      challenge_code: code,
      source_report_id: r.id,
      title: args.theme ? `${args.theme} — ${r.district}` : r.title,
      problem_statement: r.description,
      public_summary: r.title,
      category_key: r.category_key,
      category_label: r.category_key,
      area_type: r.area_type ?? null,
      district: r.district,
      location: [r.village_or_ward, r.municipality, r.district].filter(Boolean).join(", "),
      priority: r.priority,
      related_report_count: linked.length,
      ai_reason: args.aiReason,
      department_name: args.departmentName,
      officer_name: args.officerLabel,
      stage: "approved",
      progress_pct: STAGE_PROGRESS["approved"],
      created_by: args.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  await db.from("innovation_challenge_reports").insert(linked.map((report_id) => ({ challenge_id: c.id, report_id })));
  await db.from("innovation_challenge_timeline").insert([
    { challenge_id: c.id, stage: "government_review", title: "Government Review", sort_order: 1, created_by_name: args.userName },
    { challenge_id: c.id, stage: "approved", title: "Approved for Innovation", sort_order: 2, created_by_name: args.userName },
  ]);
  return c.id as string;
}

export interface SelectionInput {
  shortlist: Record<string, boolean>; // partner_id -> shortlisted
  selected: Partial<Record<SelectedRole, string | null>>;
  scores: Record<string, { score: number; reason: string; group: GroupKey }>;
  plan: { pilot_location: string; timeline_text: string; target_metric: string; internal_note: string };
}

export async function saveSelection(c: Challenge, existing: ChallengePartnerRow[], input: SelectionInput, by: string) {
  const touched = new Set([
    ...Object.keys(input.shortlist).filter((k) => input.shortlist[k]),
    ...Object.values(input.selected).filter(Boolean) as string[],
    ...existing.map((e) => e.partner_id),
  ]);
  const rows = [...touched].map((pid) => {
    const prev = existing.find((e) => e.partner_id === pid);
    const role = (Object.entries(input.selected).find(([, v]) => v === pid)?.[0] ?? null) as SelectedRole | null;
    const s = input.scores[pid];
    return {
      challenge_id: c.id,
      partner_id: pid,
      group_key: s?.group ?? prev?.group_key ?? "industry",
      match_score: prev?.match_score ?? s?.score ?? null,
      match_reason: prev?.match_reason ?? s?.reason ?? null,
      shortlisted: !!input.shortlist[pid] || !!role,
      selected_role: role,
      invitation_status: role ? (prev?.selected_role === role ? prev.invitation_status : "none") : prev?.invitation_status === "declined" ? "declined" : "none",
      updated_at: new Date().toISOString(),
    };
  });
  if (rows.length) {
    const { error } = await db.from("innovation_challenge_partners").upsert(rows, { onConflict: "challenge_id,partner_id" });
    if (error) throw error;
  }
  const { error: pe } = await db.from("innovation_challenge_plans").upsert({
    challenge_id: c.id,
    pilot_location: input.plan.pilot_location || null,
    timeline_text: input.plan.timeline_text || null,
    internal_note: input.plan.internal_note || null,
    updated_by_name: by,
    updated_at: new Date().toISOString(),
  });
  if (pe) throw pe;
  if ((input.plan.target_metric || null) !== c.target_metric) {
    await db.from("innovation_challenges").update({ target_metric: input.plan.target_metric || null }).eq("id", c.id);
  }
  await addTimeline(c.id, { title: "Partner selection saved", isPublic: false, by });
  if (c.stage === "approved" || c.stage === "government_review") await setStage(c, "partner_matching", by);
}

export async function sendInvitations(c: Challenge, rows: ChallengePartnerRow[], by: string, names: Record<string, string>) {
  const targets = rows.filter((r) => r.selected_role && r.invitation_status !== "accepted");
  if (targets.length === 0) throw new Error("Select at least one partner first.");
  for (const t of targets) {
    if (t.selected_role === "lead_university") {
      const { error } = await db.rpc("send_university_invitation", {
        _challenge_id: c.id,
        _partner_id: t.partner_id,
        _university_role: "Lead Research Partner",
        _expected_contribution: "Research, prototype evaluation, and pilot impact analysis.",
        _target_date: null,
        _scope: "Non-sensitive innovation challenge collaboration scope.",
      });
      if (error) throw error;
    } else {
      const { error } = await db.from("innovation_challenge_partners").update({ invitation_status: "sent", updated_at: new Date().toISOString() }).eq("id", t.id);
      if (error) throw error;
    }
  }
  const list = targets.map((t) => names[t.partner_id] ?? "partner").join(", ");
  await addTimeline(c.id, { title: "Collaboration invitation sent", detail: list, isPublic: false, by });
  await notifyStaff(c, `Invitation sent: ${c.challenge_code}`, `Collaboration invitation sent to ${list} (demo).`);
  if (c.stage === "approved") await setStage(c, "partner_matching", by);
}

export interface UniversityVerification {
  partner_id: string;
  verification_status: "unverified" | "verification_pending" | "verified" | "verification_rejected" | "inactive";
  verification_source_type: string;
  verification_reference_id: string | null;
  verification_note: string | null;
  verified_at: string | null;
  verified_by_profile_id: string | null;
  eligibility_to_invite: boolean;
  demo_note: string;
}

export async function fetchUniversityVerifications(partnerIds?: string[]) {
  let query = db.from("innovation_partner_verifications").select("*");
  if (partnerIds?.length) query = query.in("partner_id", partnerIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UniversityVerification[];
}

export async function setUniversityVerification(args: {
  partnerId: string;
  status: UniversityVerification["verification_status"];
  sourceType: string;
  referenceId?: string;
  referenceUrl?: string;
  note?: string;
  eligible: boolean;
}) {
  const { data, error } = await db.rpc("set_university_verification", {
    _partner_id: args.partnerId,
    _status: args.status,
    _source_type: args.sourceType,
    _reference_url: args.referenceUrl ?? null,
    _reference_id: args.referenceId ?? null,
    _note: args.note ?? null,
    _eligible: args.eligible,
  });
  if (error) throw error;
  return data as UniversityVerification;
}

export async function markResponse(c: Challenge, row: ChallengePartnerRow, accepted: boolean, by: string, partnerName: string) {
  const { error } = await db
    .from("innovation_challenge_partners")
    .update({ invitation_status: accepted ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw error;
  const roleLabel = row.selected_role ? ROLE_LABELS[row.selected_role] : "Partner";
  if (accepted) {
    await addTimeline(c.id, { stage: c.stage, title: `${roleLabel} joined the project team`, detail: partnerName, by });
    await notifyLinkedCitizens(c, "Innovation project update", `A ${roleLabel.toLowerCase()} has joined "${c.title}".`);
    await notifyStaff(c, `Partner accepted: ${c.challenge_code}`, `${partnerName} accepted the invitation.`);
    if (c.stage === "partner_matching") await setStage(c, "research", by);
  } else {
    await addTimeline(c.id, { title: `${roleLabel} declined the invitation`, detail: partnerName, isPublic: false, by });
    await notifyStaff(c, `Partner declined: ${c.challenge_code}`, `${partnerName} declined. Select an alternate partner.`);
    const { error: se } = await db
      .from("innovation_challenges")
      .update({ stage: "partner_matching", progress_pct: STAGE_PROGRESS["partner_matching"] })
      .eq("id", c.id);
    if (se) throw se;
  }
}

export async function clearRole(c: Challenge, row: ChallengePartnerRow, by: string) {
  await db.from("innovation_challenge_partners").update({ selected_role: null, invitation_status: "none" }).eq("id", row.id);
  await addTimeline(c.id, { title: "Alternate partner requested", isPublic: false, by });
}

// ---------- Phase 3: impact + citizen feedback ----------
export interface ChallengeImpact {
  baseline_reports?: number | null;
  current_reports?: number | null;
  target_reduction_pct?: number | null;
  measurement_period?: string | null;
  impact_measured_at?: string | null;
}

export function impactOf(c: ChallengeImpact) {
  const base = c.baseline_reports ?? null;
  const cur = c.current_reports ?? null;
  const reduction = base && cur !== null ? Math.round(((base - cur) / base) * 100) : null;
  const target = c.target_reduction_pct ?? null;
  const toTarget = reduction !== null && target ? Math.max(0, Math.min(100, Math.round((reduction / target) * 100))) : null;
  return { base, cur, reduction, target, toTarget };
}

export async function saveImpact(c: Challenge, v: { baseline: number | null; current: number | null; target: number | null; period: string }, by: string) {
  const { error } = await db
    .from("innovation_challenges")
    .update({
      baseline_reports: v.baseline,
      current_reports: v.current,
      target_reduction_pct: v.target,
      measurement_period: v.period || null,
      impact_measured_at: new Date().toISOString(),
    })
    .eq("id", c.id);
  if (error) throw error;
  const r = impactOf({ baseline_reports: v.baseline, current_reports: v.current });
  await addTimeline(c.id, {
    title: "Impact measurement updated",
    ...(r.reduction !== null ? { detail: `${r.reduction}% fewer related reports` } : {}),
    by,
  });
}

export const FEEDBACK_STAGES = ["field_pilot", "evaluation", "deployment_approval", "scaled_closed"];

export async function fetchMyFeedback(challengeId: string, userId: string) {
  const { data } = await db
    .from("innovation_challenge_feedback")
    .select("rating, comment")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as { rating: number; comment: string | null } | null;
}

export async function fetchFeedbackSummary(challengeId: string) {
  const { data } = await db.rpc("challenge_feedback_summary", { _challenge_id: challengeId });
  const row = Array.isArray(data) ? data[0] : data;
  return { responses: row?.responses ?? 0, avg: row?.avg_rating ? Number(row.avg_rating) : null };
}

export async function fetchAllFeedback(challengeId: string) {
  const { data } = await db
    .from("innovation_challenge_feedback")
    .select("id, rating, comment, created_at")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: false });
  return (data ?? []) as { id: string; rating: number; comment: string | null; created_at: string }[];
}

export async function submitFeedback(challengeId: string, rating: number, comment: string) {
  const { error } = await db
    .from("innovation_challenge_feedback")
    .insert({ challenge_id: challengeId, rating, comment: comment.trim() || null });
  if (error) throw error;
}

// ---------- Phase 4: partner accounts (university / industry / CSR logins) ----------
export interface MyPartnerOrg {
  id: string;
  name: string;
  organization_type: string;
  city: string;
  expertise_labels: string[];
  innovation_domains: string[];
  available_team_capacity: number;
  current_workload: number;
}

/** Directory records linked to the signed-in partner account (by demo account email). */
export async function fetchMyPartnerOrgs(email: string | null | undefined): Promise<MyPartnerOrg[]> {
  if (!email) return [];
  const { data, error } = await db
    .from("innovation_partners")
    .select("id, name, organization_type, city, expertise_labels, innovation_domains, available_team_capacity, current_workload")
    .ilike("account_email", email);
  if (error) throw error;
  return data ?? [];
}

export interface PartnerInvitation extends ChallengePartnerRow {
  partner_name: string;
  challenge: Challenge | null;
}

/** Challenges this partner account has been matched to, with invitation state. */
export async function fetchMyInvitations(partnerIds: string[], names: Record<string, string>): Promise<PartnerInvitation[]> {
  if (partnerIds.length === 0) return [];
  const { data, error } = await db
    .from("innovation_challenge_partners")
    .select("*, innovation_challenges(*)")
    .in("partner_id", partnerIds)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: ChallengePartnerRow & { innovation_challenges: Challenge | null }) => ({
    ...row,
    partner_name: names[row.partner_id] ?? "Partner",
    challenge: row.innovation_challenges ?? null,
  }));
}

/** Accept or decline an invitation. Stage and timeline are updated server-side. */
export async function respondToInvitation(rowId: string, accepted: boolean, note?: string) {
  const { error } = await db.rpc("partner_respond_invitation", {
    _row_id: rowId,
    _accepted: accepted,
    _note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function fetchMappedPartnerOrg(userId: string): Promise<MyPartnerOrg | null> {
  const { data: mapping, error: mappingError } = await db
    .from("innovation_partner_profiles")
    .select("partner_id")
    .eq("profile_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (mappingError) throw mappingError;
  if (!mapping?.partner_id) return null;
  const { data, error } = await db
    .from("innovation_partners")
    .select("id, name, organization_type, city, expertise_labels, innovation_domains, available_team_capacity, current_workload")
    .eq("id", mapping.partner_id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchMappedPartnerInvitations(partnerId: string): Promise<PartnerInvitation[]> {
  const { data, error } = await db
    .from("innovation_challenge_partners")
    .select("*, innovation_challenges(*)")
    .eq("partner_id", partnerId)
    .in("invitation_status", ["sent", "invited", "accepted", "active_team", "declined"])
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: ChallengePartnerRow & { innovation_challenges: Challenge | null }) => ({
    ...row,
    partner_name: "Mapped partner organization",
    challenge: row.innovation_challenges ?? null,
  }));
}

export async function respondToMappedInvitation(rowId: string, accepted: boolean, note?: string) {
  const { error } = await db.rpc("partner_respond_invitation_by_profile", {
    _row_id: rowId,
    _accepted: accepted,
    _note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function submitMappedPartnerUpdate(args: {
  challengeId: string;
  partnerId: string;
  profileId: string;
  updateType: "clarification_request" | "research_update" | "technical_approach" | "prototype_update" | "field_pilot_update" | "resource_estimate" | "deliverable_metadata" | "ready_for_review";
  title: string;
  publicSummary?: string;
  privateDetails?: string;
  safeFileReference?: string;
}) {
  const { error } = await db.from("innovation_partner_updates").insert({
    challenge_id: args.challengeId,
    partner_id: args.partnerId,
    submitted_by_profile_id: args.profileId,
    update_type: args.updateType,
    title: args.title.trim(),
    public_summary: args.publicSummary?.trim() || null,
    private_details: args.privateDetails?.trim() || null,
    safe_file_reference: args.safeFileReference?.trim() || null,
    is_public: false,
  });
  if (error) throw error;
}

export async function fetchMappedPartnerUpdates(partnerId: string, challengeIds: string[]) {
  if (challengeIds.length === 0) return [];
  const { data, error } = await db
    .from("innovation_partner_updates")
    .select("id, challenge_id, update_type, title, status, created_at, public_summary")
    .eq("partner_id", partnerId)
    .in("challenge_id", challengeIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMappedTeamRoles(challengeIds: string[], partnerId: string) {
  if (challengeIds.length === 0) return [];
  const { data, error } = await db
    .from("innovation_challenge_team_roles")
    .select("challenge_id, role_key, role_label, display_name, organization_name, member_count, status, skills, progress_pct, public_summary")
    .in("challenge_id", challengeIds)
    .eq("partner_id", partnerId);
  if (error) throw error;
  return data ?? [];
}
