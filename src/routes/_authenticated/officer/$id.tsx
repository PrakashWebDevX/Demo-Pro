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
import { MediaGallery } from "@/components/app/MediaGallery";
import { AssignmentPanel } from "@/components/app/AssignmentPanel";
import { MasterClassificationCard } from "@/components/app/MasterClassificationCard";
import { ChallengeLink } from "@/components/app/ChallengeLink";
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
        <Button onClick={() => navigate({ to: "/officer" })}>
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
              <MediaGallery media={media} publicId={report.public_issue_id} className="mt-4" />
            ) : null}
          </div>

          <div className="rounded-lg border border-accent/40 bg-accent/8 p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-accent">
              <Sparkles className="size-5" aria-hidden="true" />
              {lang === "en"
                ? "AI suggestion — pending human approval"
                : "एआई सुझाव — मानव स्वीकृति शेष"}
            </p>
            <ul className="mt-3 grid gap-1 text-sm">
              <li>
                {lang === "en" ? "Classified category" : "वर्गीकृत श्रेणी"}:{" "}
                <b>{report.ai_category ?? "—"}</b>
              </li>
              <li>
                {lang === "en" ? "Suggested priority" : "सुझाई प्राथमिकता"}:{" "}
                <b>{report.ai_priority ?? "—"}</b>
              </li>
              <li>
                {lang === "en" ? "Recommended department" : "सुझाया विभाग"}:{" "}
                <b>{report.ai_recommended_department ?? "—"}</b>
              </li>
              <li>
                {lang === "en" ? "Possible duplicates" : "संभावित डुप्लिकेट"}:{" "}
                <b>{report.ai_duplicate_count}</b>
              </li>
              {report.ai_next_action ? (
                <li>
                  {lang === "en" ? "Recommended next action" : "अनुशंसित अगला कदम"}:{" "}
                  {report.ai_next_action}
                </li>
              ) : null}
            </ul>
            <p className="mt-3 text-sm font-medium">
              {lang === "en"
                ? "AI helps decisions. Humans approve actions."
                : "एआई निर्णय में मदद करता है। कार्रवाई मनुष्य स्वीकृत करते हैं।"}
            </p>
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
            <Link to="/officer">{lang === "en" ? "Back to all reports" : "सभी शिकायतें"}</Link>
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
