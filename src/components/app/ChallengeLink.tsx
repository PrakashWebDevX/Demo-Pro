import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { CHALLENGE_STAGE_LABELS, fetchChallengeForReport } from "@/lib/challenges";

/** Shows a link to the Innovation Challenge this report belongs to (renders nothing otherwise). */
export function ChallengeLink({ reportId }: { reportId: string }) {
  const { tr } = useLang();
  const { data } = useQuery({
    queryKey: ["report-challenge", reportId],
    queryFn: () => fetchChallengeForReport(reportId),
    retry: false,
  });
  if (!data) return null;
  return (
    <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <p className="flex items-center gap-2 font-semibold">
          <Lightbulb className="size-5 text-accent" aria-hidden="true" />
          {tr("Innovation Challenge")}: {data.title}
        </p>
        <p className="text-sm text-muted-foreground">{tr("Current stage")}: {CHALLENGE_STAGE_LABELS[data.stage]}</p>
      </div>
      <Button asChild>
        <Link to="/challenges/$id" params={{ id: data.id }}>{tr("View challenge")}</Link>
      </Button>
    </div>
  );
}
