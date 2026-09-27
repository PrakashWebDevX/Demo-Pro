import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Page } from "@/components/app/Page";
import { PriorityBadge, StatusBadge } from "@/components/app/badges";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { MediaGallery } from "@/components/app/MediaGallery";
import { AssignmentPanel } from "@/components/app/AssignmentPanel";
import { MasterClassificationCard } from "@/components/app/MasterClassificationCard";
import { ChallengeLink } from "@/components/app/ChallengeLink";
import { PartnerVisibilityCard } from "@/components/app/PartnerVisibility";
import {
  changeReportStatus,
  fetchDepartments,
  fetchReportMedia,
  fetchReport,
  fetchTimeline,
} from "@/lib/reports";
import { CATEGORY_LABELS, PRIORITY_LABELS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/officer/$id")({
  component: OfficerReviewPage,
});

function OfficerReviewPage() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const { lang, pick } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: report } = useQuery({ queryKey: ["report", id], queryFn: () => fetchReport(id) });
  const { data: timeline = [] } = useQuery({
    queryKey: ["timeline", id],
    queryFn: () => fetchTimeline(id),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });
  const { data: media = [] } = useQuery({ queryKey: ["media", id], queryFn: () => fetchReportMedia(id) });
  const { data: duplicates = [] } = useQuery({
    queryKey: ["duplicates", id, report?.category_key, report?.district],
    enabled: !!report,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 864e5).toISOString();
      const { data, error } = await supabase
        .from("reports")
        .select("id, title, public_issue_id, status, priority, created_at, village_or_ward")
        .eq("category_key", report!.category_key)
        .eq("district", report!.district)
        .neq("id", report!.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [showDuplicates, setShowDuplicates] = useState(false);
  // Existing citizen feedback row (returns nothing if access rules don't allow it).
  const { data: citizenFeedback } = useQuery({
    queryKey: ["feedback", id],
    queryFn: async () => {
      const { data } = await supabase.from("feedback").select("rating, resolved_successfully").eq("report_id", id).maybeSingle();
      return data as { rating: number; resolved_successfully: boolean | null } | null;
    },
  });

  const [remark, setRemark] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);

  async function act(newStatus: string) {
    if (!report || !user) return;
    setBusy(true);
    try {
      await changeReportStatus({
        reportId: report.id,
        currentStatus: report.status,
        newStatus,
        remark: remark.trim(),
        userId: user.id,
        userName: profile?.full_name ?? "Government Officer",
        departmentId: departmentId || null,
        ...(priority ? { priority } : {}),
      });
      setRemark("");
      await queryClient.invalidateQueries({ queryKey: ["report", id] });
      await queryClient.invalidateQueries({ queryKey: ["timeline", id] });
      await queryClient.invalidateQueries({ queryKey: ["all-reports"] });
      toast.success(lang === "en" ? "Report updated" : "शिकायत अपडेट हुई");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!report) {
    return (
      <Page title={lang === "en" ? "Report not found" : "शिकायत नहीं मिली"}>
        <Button onClick={() => navigate({ to: "/officer", search: { status: undefined, priority: undefined, type: undefined } })}>
          {lang === "en" ? "Back to dashboard" : "वापस डैशबोर्ड"}
        </Button>
      </Page>
    );
  }

  return (
    <Page title={report.title} description={report.public_issue_id}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={report.status} />
              <PriorityBadge priority={report.priority} />
            </div>
            <p className="mt-4 whitespace-pre-line">{report.description}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {pick(CATEGORY_LABELS[report.category_key])} ·{" "}
              {[report.village_or_ward, report.block, report.district].filter(Boolean).join(", ")} ·{" "}
              {report.reporter_name ?? (lang === "en" ? "Citizen" : "नागरिक")}
            </p>
            {media.length > 0 ? (
              <>
                <h2 className="mt-4 text-lg font-semibold">{lang === "en" ? "Citizen Evidence" : "नागरिक प्रमाण"}</h2>
                <MediaGallery media={media} publicId={report.public_issue_id} className="mt-2" />
              </>
            ) : null}
            <h2 className="mt-4 text-lg font-semibold">{lang === "en" ? "Resolution Evidence" : "समाधान प्रमाण"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {lang === "en" ? "Resolution photo will be added after field verification." : "क्षेत्र सत्यापन के बाद समाधान फोटो जोड़ी जाएगी।"}
            </p>
          </div>

          <div className="rounded-lg border border-accent/40 bg-accent/8 p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-accent">
              <Sparkles className="size-5" aria-hidden="true" />
              AI Classification
            </p>
            {!report.ai_category && !report.ai_recommended_department && !report.ai_next_action && !report.ai_priority ? (
              <p className="mt-3 text-sm text-muted-foreground">AI classification is not available for this report.</p>
            ) : (
              <ul className="mt-3 grid gap-1 text-sm">
                <li>
                  Recommended Path:{" "}
                  <b>{report.is_innovation ? "Potential Innovation Issue" : report.ai_category ? "Service Request" : "Officer Review Required"}</b>
                </li>
                {report.ai_category ? <li>Category: <b>{report.ai_category}</b></li> : null}
                {report.ai_priority ? <li>Suggested priority: <b>{report.ai_priority}</b></li> : null}
                {report.ai_recommended_department ? <li>Suggested department: <b>{report.ai_recommended_department}</b></li> : null}
                <li>Similar reports: <b>{report.ai_duplicate_count}</b></li>
                {report.ai_next_action ? <li>Suggested next step: {report.ai_next_action}</li> : null}
              </ul>
            )}
            <p className="mt-3 text-sm font-medium">AI suggests. Government decides.</p>
            <p className="mt-1 text-xs text-muted-foreground">AI suggestions are advisory. Government officer approval is required before action.</p>
          </div>

          {report.ai_next_action || report.ai_recommended_department ? (
            <div className="card-surface break-words p-5">
              <h2 className="text-lg font-semibold">AI Suggested Solution</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                <li className="flex flex-col sm:flex-row sm:gap-1">
                  <span>Recommended Path:</span>
                  <b>{report.is_innovation ? "Potential Innovation Issue" : "Service Request"}</b>
                </li>
                {report.ai_next_action ? (
                  <li className="flex flex-col sm:flex-row sm:gap-1">
                    <span>{report.is_innovation ? "Recommended next step:" : "Suggested direct action:"}</span>
                    <span className="min-w-0">{report.ai_next_action}</span>
                  </li>
                ) : null}
                {report.ai_recommended_department ? (
                  <li className="flex flex-col sm:flex-row sm:gap-1">
                    <span>{report.is_innovation ? "Suggested departments:" : "Recommended department:"}</span>
                    <b className="min-w-0">{report.ai_recommended_department}</b>
                  </li>
                ) : null}
                {!report.is_innovation && report.ai_priority ? (
                  <li className="flex flex-col sm:flex-row sm:gap-1">
                    <span>Priority:</span>
                    <b>{report.ai_priority}</b>
                  </li>
                ) : null}
                {!report.is_innovation ? <li className="text-muted-foreground">Verify work before closing.</li> : null}
              </ul>
              {report.is_innovation ? (
                <p className="mt-3 text-sm font-medium text-warning">
                  Possible options require feasibility review and pilot approval. They are not an approved final solution.
                </p>
              ) : null}
              <p className="mt-3 text-sm font-medium">AI suggestions are advisory. Government officer approval is required before action.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">AI suggestion is not available for this report.</p>
          )}

          <div className="card-surface break-words p-5">
            <h2 className="text-lg font-semibold">Civic Impact Loop</h2>
            <ul className="mt-3 grid gap-2 text-sm">
              <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span>Resolution state:</span> <StatusBadge status={report.status} />
              </li>
              <li className="flex flex-col sm:flex-row sm:gap-1">
                <span>Evidence status:</span>
                <b>{media.length > 0 ? `Citizen evidence available (${media.length})` : "No citizen evidence"}</b>
                <span className="text-muted-foreground">· Resolution photo not yet recorded</span>
              </li>
              {["resolved", "citizen_feedback", "closed"].includes(report.status) ? (
                <li className="flex flex-col sm:flex-row sm:gap-1">
                  <span>Citizen confirmation:</span>
                  <b>
                    {citizenFeedback
                      ? citizenFeedback.resolved_successfully === false
                        ? `Review requested (rating ${citizenFeedback.rating}/5)`
                        : `Confirmed resolved (rating ${citizenFeedback.rating}/5)`
                      : "Awaiting citizen feedback"}
                  </b>
                </li>
              ) : null}
              <li className="flex flex-col sm:flex-row sm:gap-1">
                <span>Related reports (same category and district, last 90 days):</span>
                <b>{duplicates.length}</b>
              </li>
              {report.ai_next_action ? (
                <li className="flex flex-col sm:flex-row sm:gap-1">
                  <span>AI recommendation:</span>
                  <span className="min-w-0">{report.ai_next_action}</span>
                </li>
              ) : null}
            </ul>
            {duplicates.length === 0 && !report.is_innovation ? (
              <p className="mt-3 text-sm text-muted-foreground">Recurrence analysis is not configured for this report.</p>
            ) : null}
            {report.is_innovation || duplicates.length >= 3 ? (
              <div className="mt-3 rounded-md border border-accent/40 bg-accent/8 p-3">
                <p className="font-semibold text-accent">Potential Prevention Review</p>
                <p className="mt-1 text-sm">
                  {report.is_innovation ? "This report is flagged as a potential innovation issue." : `${duplicates.length} related reports suggest a recurring problem.`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">AI suggestions are advisory. Government officer approval is required before action.</p>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">Prevention review action is not configured.</p>
          </div>

          <div className="card-surface p-5">
            <button
              type="button"
              onClick={() => setShowDuplicates((v) => !v)}
              aria-expanded={showDuplicates}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "Duplicate Reports" : "डुप्लिकेट शिकायतें"}
              </h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {duplicates.length}
              </span>
            </button>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "en"
                ? `Similar reports in ${report.district} (same category, last 90 days). Click to view each report.`
                : `${report.district} में मिलती-जुलती शिकायतें (पिछले 90 दिन)।`}
            </p>
            {showDuplicates ? (
              duplicates.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {lang === "en" ? "No duplicate reports found for this issue." : "कोई डुप्लिकेट शिकायत नहीं मिली।"}
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      <Link
                        to="/officer/$id"
                        params={{ id: d.id }}
                        className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                      >
                        <span className="min-w-0 flex-1 font-medium">{d.title}</span>
                        <StatusBadge status={d.status} />
                        <span className="text-xs text-muted-foreground">
                          {d.public_issue_id} · {d.village_or_ward ?? report.district} ·{" "}
                          {new Date(d.created_at).toLocaleDateString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>

          {user ? (
            <MasterClassificationCard
              report={report}
              userId={user.id}
              userName={profile?.full_name ?? "Government Officer"}
            />
          ) : null}

          {user ? (
            <div id="assignment-panel">
              <AssignmentPanel
                report={report}
                userId={user.id}
                userName={profile?.full_name ?? "Government Officer"}
              />
            </div>
          ) : null}

          <PartnerVisibilityCard report={report} />
          <ChallengeLink reportId={report.id} />

          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">
              {lang === "en" ? "Human review and action" : "मानवीय समीक्षा एवं कार्रवाई"}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dept">{lang === "en" ? "Assign department" : "विभाग सौंपें"}</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger id="dept" className="h-12 text-base">
                    <SelectValue
                      placeholder={lang === "en" ? "Select department" : "विभाग चुनें"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {lang === "hi" && d.name_hi ? d.name_hi : d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prio">
                  {lang === "en" ? "Confirm priority" : "प्राथमिकता तय करें"}
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="prio" className="h-12 text-base">
                    <SelectValue placeholder={pick(PRIORITY_LABELS[report.priority])} />
                  </SelectTrigger>
                  <SelectContent>
                    {["high", "medium", "low"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {pick(PRIORITY_LABELS[p])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="remark">
                {lang === "en" ? "Official remark (visible to citizen)" : "आधिकारिक टिप्पणी"}
              </Label>
              <Textarea
                id="remark"
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => act("under_review")} disabled={busy}>
                {lang === "en" ? "Approve for review" : "समीक्षा हेतु स्वीकृत"}
              </Button>
              <Button variant="outline" onClick={() => act("info_requested")} disabled={busy}>
                {lang === "en" ? "Request More Information" : "अधिक जानकारी माँगें"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!departmentId) {
                    toast.error(lang === "en" ? "Select a department first" : "पहले विभाग चुनें");
                    return;
                  }
                  void act("assigned");
                }}
                disabled={busy}
              >
                {lang === "en" ? "Assign Department" : "विभाग सौंपें"}
              </Button>
              <Button variant="outline" onClick={() => act("in_progress")} disabled={busy}>
                {lang === "en" ? "Mark In Progress" : "कार्य जारी करें"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmResolve(true)} disabled={busy}>
                {lang === "en" ? "Mark Resolved" : "समाधान दर्ज करें"}
              </Button>
              {report.status === "resolved" || report.status === "citizen_feedback" ? (
                <Button variant="outline" onClick={() => act("closed")} disabled={busy}>
                  {lang === "en" ? "Close Issue" : "शिकायत बंद करें"}
                </Button>
              ) : null}
              <Button variant="destructive" onClick={() => act("rejected")} disabled={busy}>
                {lang === "en" ? "Reject" : "अस्वीकार करें"}
              </Button>
            </div>
          </div>
        </div>

        <div className="card-surface h-fit p-5">
          <h2 className="text-lg font-semibold">{lang === "en" ? "History" : "इतिहास"}</h2>
          <ol className="mt-4 space-y-4">
            {timeline.map((u) => (
              <li key={u.id}>
                <p className="font-medium">
                  {u.old_status ? `${u.old_status} → ` : ""}
                  {u.new_status}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(u.created_at).toLocaleString()} — {u.updated_by_name ?? "System"}
                </p>
                {u.remark ? <p className="text-sm">{u.remark}</p> : null}
              </li>
            ))}
          </ol>
          <Button asChild variant="link" className="mt-4 px-0">
            <Link to="/officer" search={{ status: undefined, priority: undefined, type: undefined }}>{lang === "en" ? "Back to all reports" : "सभी शिकायतें"}</Link>
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmResolve} onOpenChange={setConfirmResolve}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "en" ? "Confirm resolution" : "समाधान की पुष्टि करें"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "en"
                ? "Marking this issue as Resolved notifies the citizen and asks for feedback. Please confirm that field work is complete."
                : "समाधान दर्ज करने पर नागरिक को सूचना और प्रतिक्रिया का अनुरोध जाएगा। कृपया पुष्टि करें कि कार्य पूर्ण है।"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "en" ? "Cancel" : "रद्द करें"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmResolve(false);
                void act("resolved");
              }}
            >
              {lang === "en" ? "Yes, mark Resolved" : "हाँ, समाधान दर्ज करें"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
