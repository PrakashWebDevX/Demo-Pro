import { supabase } from "@/integrations/supabase/client";
import { CHALLENGE_STAGES, CHALLENGE_STAGE_LABELS } from "@/lib/challenges";

// These queries intentionally exclude citizen identity, coordinates, media, notes, contacts, and proposals.
const db = supabase as any;
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);
const REVIEW_STATUSES = new Set(["submitted", "under_review", "info_requested"]);

export interface OperationsDashboard {
  overview: {
    total: number;
    simple: number;
    innovation: number;
    needsReview: number;
    highCritical: number;
    resolvedThisMonth: number;
    overdue: number;
  };
  simple: Record<string, number> & { overdue: number };
  innovation: Record<string, number>;
  areas: { urban: number; rural: number; districts: Array<{ name: string; count: number }> };
  categories: Array<{ key: string; count: number }>;
  priorities: Array<{ key: string; count: number }>;
  departments: Array<{ id: string; name: string; open: number; total: number }>;
  myQueueAvailable: false;
}

interface DashboardReport {
  id: string;
  status: string;
  priority: string;
  is_innovation: boolean;
  area_type: string | null;
  district: string;
  category_key: string;
  created_at: string;
  resolved_at: string | null;
  assigned_department_id: string | null;
}

interface AssignmentRow {
  report_id: string;
  final_resolution_type: string | null;
  final_department_id: string | null;
  due_date: string | null;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function orderedCounts(map: Map<string, number>) {
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export async function fetchOperationsDashboard(): Promise<OperationsDashboard> {
  const [reportsResult, assignmentsResult, updatesResult, challengesResult, linksResult, departmentsResult, govDepartmentsResult] = await Promise.all([
    db.from("reports").select("id,status,priority,is_innovation,area_type,district,category_key,created_at,resolved_at,assigned_department_id"),
    db.from("report_assignments").select("report_id,final_resolution_type,final_department_id,due_date"),
    db.from("report_updates").select("report_id,new_status,created_at"),
    db.from("innovation_challenges").select("id,stage"),
    db.from("innovation_challenge_reports").select("report_id,challenge_id"),
    db.from("departments").select("id,name"),
    db.from("gov_departments").select("id,department_name"),
  ]);

  for (const result of [reportsResult, assignmentsResult, updatesResult, challengesResult, linksResult, departmentsResult, govDepartmentsResult]) {
    if (result.error) throw result.error;
  }

  const reports = (reportsResult.data ?? []) as DashboardReport[];
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const assignmentByReport = new Map(assignments.map((assignment) => [assignment.report_id, assignment]));
  const challengeIds = new Set((linksResult.data ?? []).map((link: { report_id: string; challenge_id: string }) => link.report_id));
  const updatesByReport = new Map<string, Array<{ status: string; created_at: string }>>();
  for (const update of (updatesResult.data ?? []) as Array<{ report_id: string; new_status: string | null; created_at: string }>) {
    if (!update.new_status) continue;
    const list = updatesByReport.get(update.report_id) ?? [];
    list.push({ status: update.new_status, created_at: update.created_at });
    updatesByReport.set(update.report_id, list);
  }

  const resolutionTime = (report: DashboardReport) => {
    if (report.resolved_at) return report.resolved_at;
    return updatesByReport
      .get(report.id)
      ?.filter((update) => update.status === "resolved" || update.status === "closed")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.created_at ?? null;
  };
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const today = new Date().toISOString().slice(0, 10);
  const counts = { total: reports.length, simple: 0, innovation: 0, needsReview: 0, highCritical: 0, resolvedThisMonth: 0, overdue: 0 };
  const simple: Record<string, number> & { overdue: number } = { submitted: 0, under_review: 0, assigned: 0, in_progress: 0, resolved: 0, citizen_feedback: 0, closed: 0, overdue: 0 };
  const innovation: Record<string, number> = Object.fromEntries(CHALLENGE_STAGES.map((stage) => [stage, 0]));
  for (const challenge of (challengesResult.data ?? []) as Array<{ id: string; stage: string }>) {
    if (challenge.stage in innovation) innovation[challenge.stage] = (innovation[challenge.stage] ?? 0) + 1;
  }
  const districtCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  const departmentCounts = new Map<string, { open: number; total: number }>();
  const departmentNames = new Map<string, string>([
    ...(departmentsResult.data ?? []).map((department: { id: string; name: string }) => [department.id, department.name] as const),
    ...(govDepartmentsResult.data ?? []).map((department: { id: string; department_name: string }) => [department.id, department.department_name] as const),
  ]);

  for (const report of reports) {
    const assignment = assignmentByReport.get(report.id);
    const hasInnovationDecision = assignment?.final_resolution_type === "innovation" || challengeIds.has(report.id);
    const hasSimpleDecision = assignment?.final_resolution_type === "standard";
    const isInnovation = hasInnovationDecision || (!hasSimpleDecision && !assignment?.final_resolution_type && report.is_innovation);
    if (isInnovation) counts.innovation++;
    else counts.simple++;
    if (REVIEW_STATUSES.has(report.status)) counts.needsReview++;
    if (["high", "critical"].includes(report.priority) && !TERMINAL_STATUSES.has(report.status)) counts.highCritical++;
    const resolvedAt = resolutionTime(report);
    if (resolvedAt && new Date(resolvedAt) >= monthStart) counts.resolvedThisMonth++;
    const overdue = Boolean(assignment?.due_date && assignment.due_date < today && !TERMINAL_STATUSES.has(report.status));
    if (overdue) counts.overdue++;
    if (!isInnovation) {
      if (report.status in simple) simple[report.status] = (simple[report.status] ?? 0) + 1;
      if (overdue) simple.overdue++;
    }
    if (report.area_type === "urban") increment(districtCounts, "urban");
    if (report.area_type === "rural") increment(districtCounts, "rural");
    increment(categoryCounts, report.category_key);
    increment(priorityCounts, report.priority);
    const departmentId = assignment?.final_department_id ?? report.assigned_department_id;
    if (departmentId) {
      const current = departmentCounts.get(departmentId) ?? { open: 0, total: 0 };
      current.total++;
      if (!TERMINAL_STATUSES.has(report.status)) current.open++;
      departmentCounts.set(departmentId, current);
    }
  }

  return {
    overview: counts,
    simple,
    innovation,
    areas: {
      urban: districtCounts.get("urban") ?? 0,
      rural: districtCounts.get("rural") ?? 0,
      districts: [...reports.reduce((map, report) => map.set(report.district, (map.get(report.district) ?? 0) + 1), new Map<string, number>())]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
    categories: orderedCounts(categoryCounts),
    priorities: orderedCounts(priorityCounts),
    departments: [...departmentCounts.entries()]
      .map(([id, counts]) => ({ id, name: departmentNames.get(id) ?? "Unlabelled department", ...counts }))
      .sort((a, b) => b.open - a.open),
    myQueueAvailable: false,
  };
}

export function subscribeOperationsDashboard(onChange: () => void) {
  const channel = supabase
    .channel("government-operations-dashboard")
    .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "report_assignments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "innovation_challenges" }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export { CHALLENGE_STAGE_LABELS };
