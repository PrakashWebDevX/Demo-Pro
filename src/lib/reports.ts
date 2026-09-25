import { supabase } from "@/integrations/supabase/client";

export interface ReportRow {
  id: string;
  public_issue_id: string;
  citizen_id: string | null;
  reporter_name: string | null;
  title: string;
  description: string;
  category_key: string;
  district: string;
  block: string | null;
  municipality: string | null;
  village_or_ward: string | null;
  latitude: number | null;
  longitude: number | null;
  priority: string;
  status: string;
  ai_category: string | null;
  ai_priority: string | null;
  ai_duplicate_count: number;
  ai_recommended_department: string | null;
  ai_next_action: string | null;
  assigned_department_id: string | null;
  officer_remark: string | null;
  is_innovation: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface DepartmentRow {
  id: string;
  name: string;
  name_hi: string | null;
  contact_role: string | null;
  active: boolean;
}

export async function fetchDepartments(): Promise<DepartmentRow[]> {
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as DepartmentRow[];
}

export async function fetchReports(filters?: {
  citizenId?: string;
  status?: string;
  departmentId?: string;
}): Promise<ReportRow[]> {
  let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
  if (filters?.citizenId) query = query.eq("citizen_id", filters.citizenId);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters?.departmentId) query = query.eq("assigned_department_id", filters.departmentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

export async function fetchReport(id: string): Promise<ReportRow | null> {
  const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ReportRow) ?? null;
}

export interface UpdateRow {
  id: string;
  report_id: string;
  updated_by_name: string | null;
  old_status: string | null;
  new_status: string | null;
  remark: string | null;
  created_at: string;
}

export async function fetchTimeline(reportId: string): Promise<UpdateRow[]> {
  const { data, error } = await supabase
    .from("report_updates")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UpdateRow[];
}

export async function fetchMediaUrls(reportId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("report_media")
    .select("file_url")
    .eq("report_id", reportId);
  if (error) throw error;
  const paths = (data ?? []).map((m) => m.file_url as string);
  if (paths.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from("report-media")
    .createSignedUrls(paths, 3600);
  return (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
}

export async function changeReportStatus(args: {
  reportId: string;
  currentStatus: string;
  newStatus: string;
  remark: string;
  userId: string;
  userName: string;
  departmentId?: string | null;
  priority?: string;
}) {
  const patch: Record<string, unknown> = { status: args.newStatus };
  if (args.remark) patch["officer_remark"] = args.remark;
  if (args.departmentId !== undefined && args.departmentId !== null) {
    patch["assigned_department_id"] = args.departmentId;
  }
  if (args.priority) patch["priority"] = args.priority;

  const { error } = await supabase
    .from("reports")
    .update(patch as never)
    .eq("id", args.reportId);
  if (error) throw error;

  const { error: updErr } = await supabase.from("report_updates").insert({
    report_id: args.reportId,
    updated_by: args.userId,
    updated_by_name: args.userName,
    old_status: args.currentStatus,
    new_status: args.newStatus,
    remark: args.remark || null,
  });
  if (updErr) throw updErr;
}
