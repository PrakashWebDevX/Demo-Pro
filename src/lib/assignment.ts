/**
 * Smart Assignment — transparent, rule-based matching (not autonomous AI).
 * AI recommends. Government approves.
 * Tables come from docs/sql/2026-09-25_smart_assignment.sql (not yet in generated types).
 */
import { supabase } from "@/integrations/supabase/client";
import type { ReportRow } from "@/lib/reports";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface GovDepartment {
  id: string;
  department_name: string;
  department_type: string;
  service_categories: string[];
  service_category_labels: string[];
  district: string;
  active_status: boolean;
  workload_count: number;
  is_demo: boolean;
}
export interface GovOfficer {
  id: string;
  full_name: string;
  designation: string;
  department_id: string | null;
  district: string;
  urban_or_rural_area: string;
  categories_handled: string[];
  active_status: boolean;
  current_open_assignments: number;
  max_assignment_capacity: number;
  is_demo: boolean;
}
export interface InnovationPartner {
  id: string;
  partner_kind: "university" | "partner";
  name: string;
  organization_type: string;
  city: string;
  state: string;
  expertise_categories: string[];
  expertise_labels: string[];
  innovation_domains: string[];
  available_team_capacity: number;
  current_workload: number;
  active_status: boolean;
}
export interface Match {
  id: string;
  name: string;
  subtitle: string;
  location: string;
  workload: string;
  score: number;
  reason: string;
}
export interface Assignment {
  id: string;
  report_id: string;
  suggested_resolution_type: "standard" | "innovation";
  suggested_priority: string | null;
  area_type: string | null;
  suggested_department_id: string | null;
  suggested_officer_id: string | null;
  suggested_university_id: string | null;
  suggested_partner_id: string | null;
  suggested_innovation_theme: string | null;
  reasoning: string | null;
  confidence: number | null;
  related_count: number;
  suggested_location: string | null;
  top_matches: { departments?: Match[]; officers?: Match[]; universities?: Match[]; partners?: Match[] };
  recommendation_status: "pending" | "approved" | "changed" | "rejected";
  final_resolution_type: string | null;
  final_department_id: string | null;
  final_officer_id: string | null;
  final_university_id: string | null;
  final_partner_id: string | null;
  final_owner_name: string | null;
  due_date: string | null;
  officer_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
}

const OFFICER_COLS =
  "id, full_name, designation, department_id, district, urban_or_rural_area, categories_handled, active_status, current_open_assignments, max_assignment_capacity, is_demo";
const PARTNER_COLS =
  "id, partner_kind, name, organization_type, city, state, expertise_categories, expertise_labels, innovation_domains, available_team_capacity, current_workload, active_status";

export interface Directory {
  departments: GovDepartment[];
  officers: GovOfficer[];
  partners: InnovationPartner[];
}

export async function fetchDirectory(): Promise<Directory> {
  const [d, o, p] = await Promise.all([
    db.from("gov_departments").select("*").order("department_name"),
    db.from("gov_officers").select(OFFICER_COLS).order("full_name"),
    db.from("innovation_partners").select(PARTNER_COLS).order("name"),
  ]);
  if (d.error) throw d.error;
  if (o.error) throw o.error;
  if (p.error) throw p.error;
  return { departments: d.data ?? [], officers: o.data ?? [], partners: p.data ?? [] };
}

export async function fetchAssignment(reportId: string): Promise<Assignment | null> {
  const { data, error } = await db
    .from("report_assignments")
    .select("*")
    .eq("report_id", reportId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

const INNOVATION_KEYWORDS =
  /sensor|predict|analytics|prototype|repeated|again|every (day|week|monsoon|year|month)|recurring|overflow|cross-department|drone|student|pilot|research|solar|low[- ]cost|mobile app|new solution|we (have )?built|our team|innovation/i;

const THEMES: Record<string, string> = {
  waste: "Smart waste fill-level sensing and collection-route optimisation",
  water: "Leak detection sensors and water-supply monitoring",
  road_damage: "Road-condition analytics and predictive maintenance",
  drainage: "Drain blockage sensing and flood-risk prediction",
  streetlight: "Smart lighting fault detection",
  safety: "Traffic and junction-risk analytics",
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Pure matching — exported so the rules are testable and explainable. */
export function computeMatches(
  report: Pick<ReportRow, "category_key" | "district" | "priority" | "title" | "description"> & {
    area_type?: string | null;
  },
  dir: Directory,
  relatedCount: number,
) {
  const cat = report.category_key;
  const area = (report.area_type ?? "urban") as "urban" | "rural";
  const areaLabel = area === "rural" ? "Rural" : "Urban";

  const departments: Match[] = dir.departments
    .filter((d) => d.active_status)
    .map((d) => {
      const catOk = d.service_categories.includes(cat);
      const areaOk = d.department_type === areaLabel;
      const distOk = d.district === report.district;
      const score = clamp(
        (catOk ? 50 : 0) + (areaOk ? 30 : 0) + (distOk ? 15 : 0) + Math.max(0, 5 - d.workload_count / 5),
      );
      const reasons = [
        catOk ? `handles ${d.service_category_labels.slice(0, 2).join(" / ")}` : "does not list this category",
        areaOk ? `serves ${areaLabel.toLowerCase()} areas` : `is a ${d.department_type.toLowerCase()} department`,
        distOk ? `covers ${d.district}` : `based in ${d.district}`,
      ];
      return {
        id: d.id,
        name: d.department_name,
        subtitle: d.service_category_labels.join(", "),
        location: `${d.district} · ${d.department_type}`,
        workload: `${d.workload_count} open`,
        score,
        reason: `${reasons.join(", ")}.`.replace(/^./, (c) => c.toUpperCase()),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const bestDeptId = departments[0]?.id ?? null;
  const officers: Match[] = dir.officers
    .filter((o) => o.active_status && o.current_open_assignments < o.max_assignment_capacity)
    .map((o) => {
      const deptOk = o.department_id === bestDeptId;
      const catOk = o.categories_handled.includes(cat);
      const distOk = o.district === report.district;
      const areaOk = o.urban_or_rural_area === area || o.urban_or_rural_area === "both";
      const free = 1 - o.current_open_assignments / Math.max(1, o.max_assignment_capacity);
      const score = clamp((deptOk ? 35 : 0) + (catOk ? 25 : 0) + (distOk ? 15 : 0) + (areaOk ? 10 : 0) + free * 15);
      const dept = dir.departments.find((d) => d.id === o.department_id);
      return {
        id: o.id,
        name: o.full_name,
        subtitle: o.designation + (dept ? ` — ${dept.department_name}` : ""),
        location: o.district,
        workload: `${o.current_open_assignments}/${o.max_assignment_capacity} open`,
        score,
        reason: `${catOk ? "Handles this category" : "General oversight"} in ${o.district}${
          free > 0.5 ? " and has available capacity" : ", limited capacity"
        }.`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const text = `${report.title} ${report.description}`;
  const reasonsInnov: string[] = [];
  if (relatedCount >= 5) reasonsInnov.push(`${relatedCount} similar reports in ${report.district}`);
  if (report.priority === "critical") reasonsInnov.push("priority is Critical");
  if (INNOVATION_KEYWORDS.test(text)) reasonsInnov.push("problem looks repeated or needs sensors/analytics");
  const flaggedInnovation = (report as { is_innovation?: boolean | null }).is_innovation === true;
  if (flaggedInnovation) reasonsInnov.push("report was flagged as an innovation idea by the AI triage");
  const innovation =
    flaggedInnovation ||
    relatedCount >= 5 ||
    report.priority === "critical" ||
    (relatedCount >= 3 && reasonsInnov.length > 0);

  const scorePartner = (kind: "university" | "partner") =>
    dir.partners
      .filter((p) => p.partner_kind === kind && p.active_status)
      .map((p) => {
        const catOk = p.expertise_categories.includes(cat);
        const near = p.city === report.district;
        const free = 1 - p.current_workload / Math.max(1, p.available_team_capacity);
        const score = clamp((catOk ? 60 : 0) + (near ? 20 : 5) + free * 15);
        return {
          id: p.id,
          name: p.name,
          subtitle: `${p.organization_type} — ${p.expertise_labels.join(", ")}`,
          location: `${p.city}, ${p.state}`,
          workload: `${p.current_workload}/${p.available_team_capacity} teams busy`,
          score,
          reason: `${catOk ? `Expertise in ${p.expertise_labels.slice(0, 2).join(" & ")}` : "Adjacent expertise"}${
            near ? `, located in ${p.city}` : ""
          }.`,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

  const universities = scorePartner("university");
  const partners = scorePartner("partner");

  const priority =
    report.priority === "critical" || relatedCount >= 10 ? "critical" : relatedCount >= 5 ? "high" : report.priority;

  const top = (m: Match[]) => m[0]?.score ?? 0;
  const confidence = clamp((top(departments) + top(officers)) / 2 - (departments[1] && top(departments) - departments[1].score < 10 ? 10 : 0));

  const deptName = departments[0]?.name ?? "no matching department";
  const offName = officers[0]?.name ?? "no available officer";
  const reasoning = innovation
    ? `Recommended as an Innovation Challenge because ${reasonsInnov.join(", ")}. Routine fixes may not be enough. ${deptName} should own it with ${offName}, supported by ${universities[0]?.name ?? "a university"} and ${partners[0]?.name ?? "an industry partner"}.`
    : `Standard government fix. ${deptName} handles this category for ${areaLabel.toLowerCase()} areas in ${report.district}. ${offName} is the best available officer.`;

  return {
    resolutionType: (innovation ? "innovation" : "standard") as "standard" | "innovation",
    priority,
    area,
    departments,
    officers,
    universities,
    partners,
    theme: innovation ? (THEMES[cat] ?? "Data-driven pilot for a recurring civic problem") : null,
    reasoning,
    confidence,
  };
}

/** Creates (once) the persisted AI suggestion for a report. Staff only (RLS). */
export async function ensureAssignment(
  report: ReportRow & { area_type?: string | null },
  dir: Directory,
): Promise<Assignment> {
  const existing = await fetchAssignment(report.id);
  if (existing) return existing;

  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("category_key", report.category_key)
    .eq("district", report.district)
    .neq("id", report.id)
    .gte("created_at", since);
  const related = Math.max(count ?? 0, report.ai_duplicate_count ?? 0);
  const m = computeMatches(report, dir, related);

  const row = {
    report_id: report.id,
    suggested_resolution_type: m.resolutionType,
    suggested_priority: m.priority,
    area_type: m.area,
    suggested_department_id: m.departments[0]?.id ?? null,
    suggested_officer_id: m.officers[0]?.id ?? null,
    suggested_university_id: m.resolutionType === "innovation" ? (m.universities[0]?.id ?? null) : null,
    suggested_partner_id: m.resolutionType === "innovation" ? (m.partners[0]?.id ?? null) : null,
    suggested_innovation_theme: m.theme,
    reasoning: m.reasoning,
    confidence: m.confidence,
    related_count: related,
    suggested_location: [report.village_or_ward, report.district].filter(Boolean).join(", "),
    top_matches: {
      departments: m.departments,
      officers: m.officers,
      universities: m.universities,
      partners: m.partners,
    },
  };
  const { data, error } = await db.from("report_assignments").insert(row).select("*").single();
  if (error) {
    // Race: another officer created it first.
    const again = await fetchAssignment(report.id);
    if (again) return again;
    throw error;
  }
  return data as Assignment;
}

export interface Decision {
  resolutionType: "standard" | "innovation";
  departmentId: string;
  officerId: string;
  universityId: string | null;
  partnerId: string | null;
  ownerName: string;
  dueDate: string | null;
  note: string;
}

export async function saveDecision(args: {
  assignment: Assignment;
  report: ReportRow;
  decision: Decision;
  userId: string;
  userName: string;
  dir: Directory;
}) {
  const { assignment: a, decision: d, report, dir } = args;
  const unchanged =
    d.resolutionType === a.suggested_resolution_type &&
    d.departmentId === a.suggested_department_id &&
    d.officerId === a.suggested_officer_id &&
    (d.resolutionType === "standard" ||
      (d.universityId === a.suggested_university_id && d.partnerId === a.suggested_partner_id));

  const { error } = await db
    .from("report_assignments")
    .update({
      recommendation_status: unchanged ? "approved" : "changed",
      final_resolution_type: d.resolutionType,
      final_department_id: d.departmentId,
      final_officer_id: d.officerId,
      final_university_id: d.resolutionType === "innovation" ? d.universityId : null,
      final_partner_id: d.resolutionType === "innovation" ? d.partnerId : null,
      final_owner_name: d.ownerName || null,
      due_date: d.dueDate || null,
      officer_note: d.note || null,
      decided_by: args.userId,
      decided_by_name: args.userName,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", a.id);
  if (error) throw error;

  // Workload counters (only on first decision)
  if (!a.decided_at) {
    const off = dir.officers.find((o) => o.id === d.officerId);
    const dep = dir.departments.find((x) => x.id === d.departmentId);
    if (off) await db.from("gov_officers").update({ current_open_assignments: off.current_open_assignments + 1 }).eq("id", off.id);
    if (dep) await db.from("gov_departments").update({ workload_count: dep.workload_count + 1 }).eq("id", dep.id);
    for (const pid of [d.universityId, d.partnerId]) {
      const p = d.resolutionType === "innovation" ? dir.partners.find((x) => x.id === pid) : undefined;
      if (p) await db.from("innovation_partners").update({ current_workload: p.current_workload + 1 }).eq("id", p.id);
    }
  }

  const dep = dir.departments.find((x) => x.id === d.departmentId);
  const off = dir.officers.find((o) => o.id === d.officerId);
  const newStatus = d.resolutionType === "innovation" ? "approved" : "assigned";
  const remark =
    d.resolutionType === "innovation"
      ? `Approved for Innovation. Owner: ${dep?.department_name ?? "—"} (${off?.full_name ?? "—"}).`
      : `Assigned to ${dep?.department_name ?? "—"} — ${off?.full_name ?? "—"}, ${off?.designation ?? ""}.${
          d.dueDate ? ` Due ${d.dueDate}.` : ""
        }`;

  // Submitted → Under Review → Assigned / Approved for Innovation
  const steps = report.status === "submitted" ? ["under_review", newStatus] : [newStatus];
  let current = report.status;
  for (const s of steps) {
    const patch: Record<string, unknown> = { status: s };
    if (s === newStatus) {
      patch["is_innovation"] = d.resolutionType === "innovation";
      if (d.resolutionType === "innovation") patch["priority"] = report.priority;
    }
    const { error: e1 } = await supabase.from("reports").update(patch as never).eq("id", report.id);
    if (e1) throw e1;
    await supabase.from("report_updates").insert({
      report_id: report.id,
      updated_by: args.userId,
      updated_by_name: args.userName,
      old_status: current,
      new_status: s,
      remark: s === newStatus ? remark : "Government review started.",
    });
    current = s;
  }

  // Notifications (best effort; never block the save)
  if (report.citizen_id) {
    await db.from("notifications").insert({
      user_id: report.citizen_id,
      report_id: report.id,
      title: d.resolutionType === "innovation" ? "Approved for Innovation" : "Your report was assigned",
      message: remark,
      type: "status",
    });
  }
  await db.rpc("notify_staff", {
    _report_id: report.id,
    _title: `Assignment: ${report.public_issue_id}`,
    _message: `${remark} (officer & partner notification — demo directory)`,
    _type: "assignment",
  });

  // Phase 2: Innovation Challenge record (idempotent; best effort so the assignment save never fails)
  if (d.resolutionType === "innovation") {
    try {
      const { createChallengeFromReport } = await import("@/lib/challenges");
      await createChallengeFromReport({
        report,
        departmentName: dep?.department_name ?? null,
        officerLabel: off ? `${off.full_name} — ${off.designation}` : null,
        aiReason: a.reasoning,
        theme: a.suggested_innovation_theme,
        userId: args.userId,
        userName: args.userName,
      });
    } catch (e) {
      console.warn("Innovation challenge not created", e);
    }
  }
}
