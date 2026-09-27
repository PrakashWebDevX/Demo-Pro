import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { EmptyState, Page } from "@/components/app/Page";
import { useLang } from "@/lib/i18n";
import { CHALLENGE_STAGE_LABELS, fetchChallenges } from "@/lib/challenges";

export const Route = createFileRoute("/_authenticated/challenges/")({
  head: () => ({
    meta: [
      { title: "My Innovation Challenges — Eco-Bridge" },
      { name: "description", content: "Innovation challenges created from citizen reports, with live stage tracking." },
      { property: "og:title", content: "My Innovation Challenges — Eco-Bridge" },
      { property: "og:description", content: "Track innovation challenges from approval to deployment." },
    ],
  }),
  component: ChallengeList,
});

function ChallengeList() {
  const { tr } = useLang();
  const { data = [], isLoading, error } = useQuery({ queryKey: ["challenges"], queryFn: fetchChallenges });
  return (
    <Page title={tr("Innovation Challenges")} description={tr("AI suggests. Government decides.")}>
      {error ? <p className="text-destructive">{(error as Error).message}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? <p className="text-muted-foreground">{tr("Loading…")}</p> : null}
        {!isLoading && !error && data.length === 0 ? <EmptyState title={tr("No innovation challenges yet")} /> : null}
        {data.map((c) => (
          <Link key={c.id} to="/challenges/$id" params={{ id: c.id }} className="card-surface block p-5 transition-colors hover:bg-muted">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
              <Lightbulb className="size-4" aria-hidden="true" />
              {CHALLENGE_STAGE_LABELS[c.stage]}
            </span>
            <h2 className="mt-3 text-lg font-bold">{c.title}</h2>
            <p className="mt-1 line-clamp-2 text-muted-foreground">{c.public_summary ?? c.problem_statement}</p>
            <p className="mt-2 text-sm text-muted-foreground">{c.challenge_code} · {c.location ?? c.district} · {c.progress_pct}%</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
