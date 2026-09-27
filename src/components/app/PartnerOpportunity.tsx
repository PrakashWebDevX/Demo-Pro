import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { fetchReportThumbnails } from "@/lib/reports";

interface ProjectLike {
  description: string;
  expected_outcome: string | null;
  deadline: string | null;
  government_comments: string | null;
  source_report_id: string | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-1 text-sm break-words whitespace-pre-line">{children}</div>
    </div>
  );
}

/** Role-specific view of a government-approved case (a project linked to a report). */
export function PartnerOpportunity({ project, role }: { project: ProjectLike; role: string | null }) {
  const reportId = project.source_report_id;
  const { data: thumbs = {}, isLoading } = useQuery({
    queryKey: ["approved-case-thumbs", reportId],
    queryFn: () => fetchReportThumbnails([reportId as string]),
    enabled: Boolean(reportId),
    retry: false,
  });
  if (!reportId || (role !== "university" && role !== "partner")) return null;
  const isUniversity = role === "university";
  const img = thumbs[reportId];

  return (
    <div className="card-surface p-5">
      <p className="text-xs font-semibold text-accent">Government-Approved Innovation Case</p>
      <h2 className="text-lg font-semibold">
        {isUniversity ? "Research Collaboration Opportunity" : "Pilot Solution Opportunity"}
      </h2>
      <Section title="Government Challenge">{project.description}</Section>
      <Section title="Approved Evidence">
        {img ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <img src={img} alt="Approved evidence" className="h-40 w-full rounded-lg object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="flex h-28 w-full max-w-xs flex-col items-center justify-center rounded-lg bg-muted p-2 text-center text-xs text-muted-foreground">
            <ImageOff className="mb-1 size-5" aria-hidden="true" />
            <span>{isLoading ? "Loading…" : "Evidence image unavailable"}</span>
            {!isLoading ? <span>Government verification in progress</span> : null}
          </div>
        )}
      </Section>
      {isUniversity && project.expected_outcome ? (
        <Section title="Expected Deliverables">{project.expected_outcome}</Section>
      ) : null}
      {isUniversity && project.deadline ? (
        <Section title="Timeline">Deadline: {new Date(project.deadline).toLocaleDateString()}</Section>
      ) : null}
      <Section title="Government Decision Note">
        {project.government_comments ? <p>{project.government_comments}</p> : null}
        <p className="text-muted-foreground">
          {isUniversity
            ? "AI suggestions are advisory. Government approval is required before any pilot or implementation."
            : "This case is an opportunity for review. It is not a purchase order, contract, or implementation approval."}
        </p>
      </Section>
    </div>
  );
}
