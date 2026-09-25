import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, FileText, HelpCircle, Search } from "lucide-react";
import { Page, StatCard } from "@/components/app/Page";
import { StatusBadge } from "@/components/app/badges";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { fetchReports } from "@/lib/reports";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/citizen")({
  component: CitizenDashboard,
});

function CitizenDashboard() {
  const { user, profile } = useAuth();
  const { tr, lang, t, pick } = useLang();

  const { data: reports = [] } = useQuery({
    queryKey: ["my-reports", user?.id],
    queryFn: () => fetchReports({ citizenId: user!.id }),
    enabled: Boolean(user?.id),
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    enabled: Boolean(user?.id),
  });

  const counts = {
    total: reports.length,
    review: reports.filter((r) => ["under_review", "submitted", "info_requested"].includes(r.status))
      .length,
    progress: reports.filter((r) => ["assigned", "approved", "in_progress"].includes(r.status)).length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  };

  const tiles = [
    { to: "/report", icon: ClipboardList, label: t("report_issue") },
    { to: "/reports", icon: FileText, label: t("my_reports") },
    { to: "/reports", icon: Search, label: t("track_status") },
    { to: "/notifications", icon: Bell, label: t("notifications") },
    { to: "/help", icon: HelpCircle, label: t("help_faq") },
  ];

  return (
    <Page
      title={`${tr("Namaste", "नमस्ते")}, ${profile?.full_name ?? ""}`}
      description={
        tr("Report a local problem and follow what the government does next.", "स्थानीय समस्या दर्ज करें और आगे की कार्रवाई देखें।")
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="card-surface flex items-center gap-4 p-5 transition-colors hover:bg-muted"
          >
            <span className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <tile.icon className="size-6" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold">
              {tile.label}
              {tile.to === "/notifications" && unread > 0 ? (
                <span className="ml-2 rounded-full bg-warning px-2 py-0.5 text-sm text-warning-foreground">
                  {unread}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("total_reports")} value={counts.total} />
        <StatCard label={t("under_review")} value={counts.review} tone="accent" />
        <StatCard label={t("in_progress")} value={counts.progress} tone="warning" />
        <StatCard label={t("resolved")} value={counts.resolved} tone="success" />
      </div>

      <h2 className="mt-8 text-xl font-bold">
        {tr("Recent reports", "हाल की शिकायतें")}
      </h2>
      <div className="mt-3 grid gap-3">
        {reports.slice(0, 4).map((r) => (
          <Link
            key={r.id}
            to="/reports/$id"
            params={{ id: r.id }}
            className="card-surface block p-4 transition-colors hover:bg-muted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm text-muted-foreground">{r.public_issue_id}</span>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-2 font-semibold">{r.title}</p>
            <p className="text-sm text-muted-foreground">
              {pick(CATEGORY_LABELS[r.category_key])} · {r.district} ·{" "}
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
        {reports.length === 0 ? (
          <p className="text-muted-foreground">
            {tr("You have not reported any issue yet.", "आपने अभी कोई शिकायत दर्ज नहीं की है।")}
          </p>
        ) : null}
      </div>
    </Page>
  );
}
