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
  const { user } = Route.useRouteContext();
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
      return data as { rating: number; comment: string | null; resolved_successfully?: boolean | null } | null;
    },
  });

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [resolvedConfirmed, setResolvedConfirmed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  async function submitFeedback() {
    if (!user || !report) return;
    if (!resolvedConfirmed && !comment.trim()) {
      toast.error("Please add a short reason for requesting review.");
      return;
    }
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
                {tr("Citizen Evidence", "नागरिक प्रमाण")}
              </h2>
              <MediaGallery media={media} publicId={report.public_issue_id} className="mt-3" />
            </div>
          ) : null}

          <div className="card-surface break-words p-5">
            <h2 className="text-lg font-semibold">{tr("Outcome and Verification", "परिणाम एवं सत्यापन")}</h2>
            <dl className="mt-3 grid gap-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <dt className="text-muted-foreground">{tr("Current status", "वर्तमान स्थिति")}</dt>
                <dd><StatusBadge status={report.status} /></dd>
              </div>
              {feedbackStage && (latest?.remark || report.officer_remark) ? (
                <div>
                  <dt className="text-muted-foreground">{tr("Government Update", "सरकारी अपडेट")}</dt>
                  <dd className="font-medium">
                    {latest?.remark || report.officer_remark}
                    {latest ? <span className="block text-xs font-normal text-muted-foreground">{new Date(latest.created_at).toLocaleString()}</span> : null}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">{tr("Resolution Evidence", "समाधान प्रमाण")}</dt>
                <dd className="text-muted-foreground">
                  {tr("Resolution photo will be added after field verification.", "क्षेत्र सत्यापन के बाद समाधान फोटो जोड़ी जाएगी।")}
                </dd>
              </div>
              {feedbackStage ? (
                <div>
                  <dt className="text-muted-foreground">{tr("Verification Status", "सत्यापन स्थिति")}</dt>
                  <dd className="font-medium">
                    {feedback
                      ? feedback.resolved_successfully === false
                        ? tr("Citizen requested review", "नागरिक ने समीक्षा का अनुरोध किया")
                        : tr("Confirmed resolved by citizen", "नागरिक द्वारा समाधान की पुष्टि")
                      : tr("Awaiting citizen confirmation", "नागरिक पुष्टि की प्रतीक्षा")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

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
                      {tr("Is this issue resolved?", "क्या यह समस्या हल हो गई?")}
                    </p>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        className="min-h-11"
                        variant={resolvedConfirmed ? "default" : "outline"}
                        onClick={() => setResolvedConfirmed(true)}
                      >
                        {tr("Yes, resolved", "हाँ, हल हो गई")}
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11"
                        variant={!resolvedConfirmed ? "default" : "outline"}
                        onClick={() => setResolvedConfirmed(false)}
                      >
                        {tr("Request Review", "समीक्षा का अनुरोध")}
                      </Button>
                    </div>
                    {!resolvedConfirmed ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {tr("Add a short reason in the comment below. Your response is shared with the officer; the report status is not changed automatically.", "नीचे टिप्पणी में संक्षिप्त कारण लिखें। स्थिति स्वतः नहीं बदलेगी।")}
                      </p>
                    ) : null}
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
          <h2 className="text-lg font-semibold">{tr("Report Progress", "शिकायत की प्रगति")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {report.public_issue_id ? (
              <div className="flex flex-wrap justify-between gap-x-3">
                <dt className="text-muted-foreground">{tr("Report ID", "शिकायत आईडी")}</dt>
                <dd className="break-all font-medium">{report.public_issue_id}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">{tr("Current status", "वर्तमान स्थिति")}</dt>
              <dd><StatusBadge status={report.status} /></dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-3">
              <dt className="text-muted-foreground">{tr("Last updated", "अंतिम अपडेट")}</dt>
              <dd className="font-medium">
                {new Date(latest?.created_at ?? report.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
          <ol className="mt-4 space-y-4 border-l-2 border-border pl-4">
            <li className="relative">
              <span className="absolute -left-[23px] top-1.5 size-3 rounded-full bg-success" aria-hidden="true" />
              <p className="font-medium">{pick(STATUS_LABELS["submitted"])}</p>
              <p className="text-sm text-muted-foreground">{new Date(report.created_at).toLocaleString()}</p>
            </li>
            {timeline
              .filter((u) => u.new_status && u.new_status !== "submitted")
              .map((u) => (
                <li key={u.id} className="relative">
                  <span className="absolute -left-[23px] top-1.5 size-3 rounded-full bg-success" aria-hidden="true" />
                  <p className="break-words font-medium">
                    {pick(STATUS_LABELS[u.new_status ?? ""]) || u.new_status}
                  </p>
                  <p className="break-words text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleString()}
                    {u.remark ? ` — ${u.remark}` : ""}
                  </p>
                </li>
              ))}
          </ol>
          {timeline.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {tr("No status updates have been recorded yet.", "अभी तक कोई स्थिति अपडेट दर्ज नहीं हुआ है।")}
            </p>
          ) : null}
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
