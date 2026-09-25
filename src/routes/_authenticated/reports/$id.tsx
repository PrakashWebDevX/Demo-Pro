import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, MapPin, Star } from "lucide-react";
import { downloadReceipt } from "@/lib/receipt";
import { Page } from "@/components/app/Page";
import { PriorityBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { MediaGallery } from "@/components/app/MediaGallery";
import { CitizenAssignmentCard, useReportRealtime } from "@/components/app/CitizenAssignmentCard";
import { ChallengeLink } from "@/components/app/ChallengeLink";
import { fetchDepartments, fetchReportMedia, fetchReport, fetchTimeline } from "@/lib/reports";
import { CATEGORY_LABELS, STATUS_FLOW, STATUS_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  component: ReportDetailPage,
});

function ReportDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { tr, lang, pick } = useLang();
  const queryClient = useQueryClient();
  useReportRealtime(id);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchReport(id),
  });
  const { data: timeline = [] } = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => fetchTimeline(id),
  });
  const { data: media = [] } = useQuery({
    queryKey: ["media", id],
    queryFn: () => fetchReportMedia(id),
  });
  const { data: feedback } = useQuery({
    queryKey: ["feedback", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("feedback")
        .select("*")
        .eq("report_id", id)
        .maybeSingle();
      return data as { rating: number; comment: string | null } | null;
    },
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [resolvedConfirmed, setResolvedConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  async function submitFeedback() {
    if (!user || !report) return;
    setSaving(true);
    const { error } = await supabase.from("feedback").insert({
      report_id: report.id,
      citizen_id: user.id,
      rating,
      comment: comment.trim() || null,
      resolved_successfully: resolvedConfirmed,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setThanks(true);
    await queryClient.invalidateQueries({ queryKey: ["feedback", id] });
  }

  if (isLoading) {
    return (
      <Page title={tr("Loading report…", "लोड हो रहा है…")}>
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    );
  }

  if (!report) {
    return (
      <Page title={tr("Report not found", "शिकायत नहीं मिली")}>
        <Button asChild>
          <Link to="/reports">{tr("Back to my reports", "वापस जाएँ")}</Link>
        </Button>
      </Page>
    );
  }

  const flowStatus = report.status === "approved" ? "under_review" : report.status;
  const currentIndex = STATUS_FLOW.indexOf(flowStatus as (typeof STATUS_FLOW)[number]);
  const isOwner = report.citizen_id === user?.id;
  const latest = timeline.length > 0 ? timeline[timeline.length - 1] : undefined;
  const feedbackStage = ["resolved", "citizen_feedback", "closed"].includes(report.status);

  return (
    <Page
      title={report.title}
      description={report.public_issue_id}
      actions={
        <Button
          variant="outline"
          onClick={async () => {
            const depts = await fetchDepartments();
            downloadReceipt({
              report,
              department: depts.find((d) => d.id === report.assigned_department_id)?.name ?? null,
              timeline,
              feedback: feedback ?? null,
            });
          }}
        >
          <Download className="size-4" /> Download Report Receipt
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={report.status} />
              <PriorityBadge priority={report.priority} />
              {report.is_innovation ? (
                <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
                  {tr("Innovation challenge", "नवाचार चुनौती")}
                </span>
              ) : null}
            </div>
            <p className="mt-4 whitespace-pre-line">{report.description}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{tr("Category", "श्रेणी")}</dt>
                <dd className="font-medium">{pick(CATEGORY_LABELS[report.category_key])}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{tr("Location", "स्थान")}</dt>
                <dd className="font-medium">
                  {[report.village_or_ward, report.block, report.district]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {tr("Reported on", "दर्ज तिथि")}
                </dt>
                <dd className="font-medium">{new Date(report.created_at).toLocaleString()}</dd>
              </div>
              {report.latitude && report.longitude ? (
                <div>
                  <dt className="text-muted-foreground">
                    {tr("Map pin", "मानचित्र बिंदु")}
                  </dt>
                  <dd className="flex items-center gap-1 font-medium">
                    <MapPin className="size-4 text-primary" aria-hidden="true" />
                    {report.latitude}, {report.longitude}
                  </dd>
                </div>
              ) : null}
            </dl>
            {latest ? (
              <p className="mt-4 rounded-md bg-muted p-3 text-sm">
                <b>{tr("Latest update: ", "नवीनतम अपडेट: ")}</b>
                {pick(STATUS_LABELS[latest.new_status ?? ""]) || latest.new_status} —{" "}
                {new Date(latest.created_at).toLocaleString()}
                {latest.remark ? ` — ${latest.remark}` : ""}
              </p>
            ) : null}
            {report.officer_remark ? (
              <p className="mt-4 rounded-md bg-muted p-3 text-sm">
                <b>{tr("Official remark: ", "आधिकारिक टिप्पणी: ")}</b>
                {report.officer_remark}
              </p>
            ) : null}
          </div>

          <CitizenAssignmentCard
            reportId={report.id}
            source={(report as { source?: string }).source}
            areaType={(report as { area_type?: string | null }).area_type ?? null}
          />

          <ChallengeLink reportId={report.id} />

          {media.length > 0 ? (
            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">
                {tr("Evidence", "प्रमाण")}
              </h2>
              <MediaGallery media={media} publicId={report.public_issue_id} className="mt-3" />
            </div>
          ) : null}

          {isOwner && feedbackStage ? (
            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">
                {tr("Your feedback", "आपकी प्रतिक्रिया")}
              </h2>
              {feedback || thanks ? (
                <p className="mt-3 flex items-center gap-2 text-success">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                  {tr("Thank you for your feedback.", "आपकी प्रतिक्रिया के लिए धन्यवाद।")}
                  {feedback ? ` (${feedback.rating}/5)` : ""}
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  <div>
                    <p className="font-medium">
                      {tr("Was your issue resolved?", "क्या आपकी समस्या हल हुई?")}
                    </p>
                    <div className="mt-2 flex gap-3">
                      <Button
                        type="button"
                        variant={resolvedConfirmed ? "default" : "outline"}
                        onClick={() => setResolvedConfirmed(true)}
                      >
                        {tr("Yes", "हाँ")}
                      </Button>
                      <Button
                        type="button"
                        variant={!resolvedConfirmed ? "default" : "outline"}
                        onClick={() => setResolvedConfirmed(false)}
                      >
                        {tr("No", "नहीं")}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">{tr("Rating", "रेटिंग")}</p>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          aria-label={`${n} ${tr("stars", "स्टार")}`}
                          className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
                        >
                          <Star
                            className={`size-7 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comment">{tr("Comment", "टिप्पणी")}</Label>
                    <Textarea
                      id="comment"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <Button onClick={submitFeedback} disabled={saving}>
                    {tr("Submit feedback", "प्रतिक्रिया भेजें")}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="card-surface h-fit p-5">
          <h2 className="text-lg font-semibold">
            {tr("Status timeline", "स्थिति समयरेखा")}
          </h2>
          <ol className="mt-4 space-y-4">
            {STATUS_FLOW.map((s, i) => {
              const done = currentIndex >= i && currentIndex !== -1;
              const entry = timeline.find((u) => u.new_status === s);
              const at =
                entry?.created_at ?? (s === "submitted" ? report.created_at : null);
              return (
                <li key={s} className="flex gap-3">
                  <span
                    className={`mt-1 size-3 shrink-0 rounded-full ${done ? "bg-success" : "bg-border"}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className={`font-medium ${done ? "" : "text-muted-foreground"}`}>
                      {pick(STATUS_LABELS[s])}
                    </p>
                    {at ? (
                      <p className="text-sm text-muted-foreground">
                        {new Date(at).toLocaleString()}
                        {entry?.remark ? ` — ${entry.remark}` : ""}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {report.status === "rejected" || report.status === "info_requested" ? (
            <p className="mt-4 rounded-md bg-warning/15 p-3 text-sm">
              {pick(STATUS_LABELS[report.status])}
            </p>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
