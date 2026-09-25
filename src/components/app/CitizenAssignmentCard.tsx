import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { fetchAssignment, fetchDirectory } from "@/lib/assignment";

/** Live subscription for one report (reports, timeline, assignment) — no global subscriptions. */
export function useReportRealtime(reportId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`report-${reportId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reports", filter: `id=eq.${reportId}` }, () =>
        qc.invalidateQueries({ queryKey: ["report", reportId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "report_updates", filter: `report_id=eq.${reportId}` }, () =>
        qc.invalidateQueries({ queryKey: ["timeline", reportId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "report_assignments", filter: `report_id=eq.${reportId}` }, () =>
        qc.invalidateQueries({ queryKey: ["assignment-public", reportId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback", filter: `report_id=eq.${reportId}` }, () =>
        qc.invalidateQueries({ queryKey: ["feedback", reportId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [reportId, qc]);
}

export function CitizenAssignmentCard({ reportId, source, areaType }: { reportId: string; source?: string | undefined; areaType?: string | null }) {
  const { tr } = useLang();
  const { data: a } = useQuery({ queryKey: ["assignment-public", reportId], queryFn: () => fetchAssignment(reportId), retry: false });
  const { data: dir } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory, enabled: !!a?.decided_at, retry: false });

  const decided = a && a.decided_at && a.recommendation_status !== "rejected";
  const dept = dir?.departments.find((d) => d.id === a?.final_department_id);
  const off = dir?.officers.find((o) => o.id === a?.final_officer_id);
  const src = source === "phone" || source === "ai_phone" ? tr("AI Phone Call") : source === "mobile" ? tr("Mobile") : tr("Web");

  return (
    <div className="card-surface p-5">
      <h2 className="text-lg font-semibold">{tr("Assignment")}</h2>
      {(() => {
        // Internal labels stay hidden; only a citizen-safe message after officer approval.
        const c = a as (typeof a & { classification_status?: string; classification_final_type?: string | null }) | undefined;
        const approved = c && (c.classification_status === "approved" || c.classification_status === "changed");
        const msg = !approved
          ? tr("Your report is under review.")
          : c!.classification_final_type === "innovation"
            ? tr("Your report is contributing to an innovation solution for this community.")
            : tr("Your issue has been assigned to the responsible department.");
        return <p className="mt-2 rounded-md bg-muted/50 p-3 text-sm font-medium">{msg}</p>;
      })()}
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{tr("Source")}</dt>
          <dd className="font-medium">{src}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tr("Area")}</dt>
          <dd className="font-medium">{areaType === "rural" ? tr("Rural") : areaType === "urban" ? tr("Urban") : "—"}</dd>
        </div>
        {decided ? (
          <>
            <div>
              <dt className="text-muted-foreground">{tr("Assigned department")}</dt>
              <dd className="font-medium">{dept?.department_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{tr("Assigned officer")}</dt>
              <dd className="font-medium">
                {off ? `${off.full_name}, ${off.designation}` : "—"}
              </dd>
              <dd className="text-xs text-muted-foreground">{tr("Contact: department office (via this portal)")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{tr("Due date")}</dt>
              <dd className="font-medium">{a!.due_date ? new Date(a!.due_date).toLocaleDateString() : "—"}</dd>
            </div>
            {a!.final_resolution_type === "innovation" ? (
              <div>
                <dt className="text-muted-foreground">{tr("Resolution type")}</dt>
                <dd className="font-medium">{tr("Innovation Challenge")}</dd>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground sm:col-span-2">
            {tr("A government officer is reviewing your report. The department and officer will appear here once assigned.")}
          </p>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{tr("Updates appear here automatically.")}</p>
    </div>
  );
}
