import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { Progress } from "@/components/ui/progress";
import { useLang } from "@/lib/i18n";
import { CHALLENGE_STAGE_LABELS, fetchChallenges, impactOf } from "@/lib/challenges";

export const Route = createFileRoute("/_authenticated/impact")({
  head: () => ({
    meta: [
      { title: "Innovation Impact Dashboard — Eco-Bridge" },
      { name: "description", content: "Before and after results for innovation challenges: fewer repeat reports and progress to target." },
      { property: "og:title", content: "Innovation Impact Dashboard — Eco-Bridge" },
      { property: "og:description", content: "See how innovation pilots reduce repeat civic problems." },
    ],
  }),
  component: ImpactDashboard,
});

function ImpactDashboard() {
  const { tr } = useLang();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["challenges"], queryFn: fetchChallenges });
  const measured = data.filter((c) => c.baseline_reports != null && c.current_reports != null);
  const before = measured.reduce((s, c) => s + (c.baseline_reports ?? 0), 0);
  const after = measured.reduce((s, c) => s + (c.current_reports ?? 0), 0);
  const overall = before ? Math.round(((before - after) / before) * 100) : 0;

  return (
    <Page title={tr("Innovation Impact", "नवाचार प्रभाव")} description={tr("Before and after results for each innovation challenge.", "हर नवाचार चुनौती के पहले और बाद के परिणाम।")}>
      {error ? <p className="text-destructive">{(error as Error).message}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label={tr("Active challenges", "सक्रिय चुनौतियाँ")} value={data.length} />
        <StatCard label={tr("Measured", "मापी गई")} value={measured.length} tone="accent" />
        <StatCard label={tr("Repeat reports avoided", "टली हुई शिकायतें")} value={Math.max(0, before - after)} tone="success" />
        <StatCard label={tr("Overall reduction", "कुल कमी")} value={`${overall}%`} tone="success" />
      </div>

      <div className="mt-6 grid gap-4">
        {isLoading ? <p className="text-muted-foreground">{tr("Loading…")}</p> : null}
        {!isLoading && !error && data.length === 0 ? <EmptyState title={tr("No innovation challenges yet")} /> : null}
        {data.map((c) => {
          const i = impactOf(c);
          return (
            <Link key={c.id} to="/challenges/$id" params={{ id: c.id }} className="card-surface block p-5 transition-colors hover:bg-muted">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{c.title}</h2>
                  <p className="text-sm text-muted-foreground">{c.location ?? c.district} · {CHALLENGE_STAGE_LABELS[c.stage]}</p>
                </div>
                <p className="text-2xl font-bold text-success">{i.reduction !== null ? `${i.reduction}%` : "—"}</p>
              </div>
              {i.base !== null ? (
                <>
                  <p className="mt-2 text-sm">
                    {tr("Reports before", "पहले की शिकायतें")}: <b>{i.base}</b> → {tr("Reports now", "अब की शिकायतें")}: <b>{i.cur ?? "—"}</b>
                    {i.target ? ` · ${tr("Target: {t}% fewer reports", "लक्ष्य: {t}% कम शिकायतें", { t: i.target })}` : ""}
                  </p>
                  {i.target ? <Progress value={i.toTarget ?? 0} className="mt-3" aria-label={tr("Progress to target")} /> : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{tr("Not measured yet", "अभी मापा नहीं गया")}</p>
              )}
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
