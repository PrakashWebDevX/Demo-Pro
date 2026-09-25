import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { PriorityBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { fetchDepartments, fetchReports } from "@/lib/reports";
import { CATEGORY_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/department")({
  component: DepartmentDashboard,
});

const OVERDUE_DAYS = 7;

function DepartmentDashboard() {
  const { profile } = useAuth();
  const { lang, t, pick } = useLang();

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["dept-reports", profile?.department_id],
    queryFn: () => fetchReports(),
  });

  const myDept = departments.find((d) => d.id === profile?.department_id);
  const deptReports = useMemo(
    () =>
      profile?.department_id
        ? reports.filter((r) => r.assigned_department_id === profile.department_id)
        : reports,
    [reports, profile?.department_id],
  );

  const unassigned = reports.filter((r) => !r.assigned_department_id && r.status !== "resolved");
  const overdue = deptReports.filter(
    (r) =>
      r.status !== "resolved" &&
      Date.now() - new Date(r.created_at).getTime() > OVERDUE_DAYS * 86400000,
  );
  const fieldAction = deptReports.filter((r) => ["assigned", "in_progress"].includes(r.status));
  const resolved = deptReports.filter((r) => r.status === "resolved");

  return (
    <Page
      title={lang === "en" ? "Department Dashboard" : "विभाग डैशबोर्ड"}
      description={
        myDept
          ? `${lang === "hi" && myDept.name_hi ? myDept.name_hi : myDept.name}`
          : lang === "en"
            ? "Workload and field action across assigned issues."
            : "सौंपी गई शिकायतों का कार्यभार एवं क्षेत्रीय कार्रवाई।"
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={lang === "en" ? "Assigned to department" : "विभाग को सौंपी"}
          value={deptReports.length}
        />
        <StatCard
          label={lang === "en" ? "Unassigned issues" : "बिना सौंपी शिकायतें"}
          value={unassigned.length}
          tone="accent"
        />
        <StatCard
          label={lang === "en" ? "Overdue (7+ days)" : "विलंबित (7+ दिन)"}
          value={overdue.length}
          tone="warning"
        />
        <StatCard label={t("resolved")} value={resolved.length} tone="success" />
      </div>

      <h2 className="mt-8 text-xl font-bold">
        {lang === "en" ? "Field action list" : "क्षेत्रीय कार्य सूची"}
      </h2>
      <div className="mt-3 grid gap-3">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && fieldAction.length === 0 ? (
          <EmptyState title={lang === "en" ? "No field work pending" : "कोई क्षेत्रीय कार्य शेष नहीं"} />
        ) : null}
        {fieldAction.map((r) => (
          <div key={r.id} className="card-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-muted-foreground">{r.public_issue_id}</span>
              <span className="flex gap-2">
                <PriorityBadge priority={r.priority} />
                <StatusBadge status={r.status} />
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold">{r.title}</p>
            <p className="text-sm text-muted-foreground">
              {pick(CATEGORY_LABELS[r.category_key])} · {r.district}
            </p>
            <Button asChild className="mt-3">
              <Link to="/officer/$id" params={{ id: r.id }}>
                {lang === "en" ? "Open and update" : "खोलें और अपडेट करें"}
              </Link>
            </Button>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">
        {lang === "en" ? "Overdue issues" : "विलंबित शिकायतें"}
      </h2>
      <div className="mt-3 grid gap-3">
        {overdue.length === 0 ? (
          <EmptyState title={lang === "en" ? "Nothing overdue" : "कोई विलंबित शिकायत नहीं"} />
        ) : null}
        {overdue.map((r) => (
          <Link
            key={r.id}
            to="/officer/$id"
            params={{ id: r.id }}
            className="card-surface block p-4 transition-colors hover:bg-muted"
          >
            <p className="font-semibold">{r.title}</p>
            <p className="text-sm text-muted-foreground">
              {r.public_issue_id} ·{" "}
              {Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)}{" "}
              {lang === "en" ? "days open" : "दिन से लंबित"}
            </p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
