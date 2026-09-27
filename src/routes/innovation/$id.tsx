import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PartnerOpportunity } from "@/components/app/PartnerOpportunity";
import { useLang } from "@/lib/i18n";
import { INNOVATION_STAGES, INNOVATION_STAGE_LABELS, type InnovationProject } from "@/lib/innovation";

export const Route = createFileRoute("/innovation/$id")({
  component: InnovationDetail,
});

function InnovationDetail() {
  const { id } = Route.useParams();
  const { user, profile, role } = useAuth();
  const { lang, pick } = useLang();
  const queryClient = useQueryClient();

  const [organization, setOrganization] = useState("");
  const [supportType, setSupportType] = useState("");
  const [proposal, setProposal] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["innovation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as InnovationProject | null;
    },
  });

  const { data: myApplication } = useQuery({
    queryKey: ["application", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_applications")
        .select("*")
        .eq("innovation_project_id", id)
        .eq("applicant_id", user!.id)
        .maybeSingle();
      return data as { id: string; status: string } | null;
    },
    enabled: Boolean(user?.id),
  });

  async function apply() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("partner_applications").insert({
      innovation_project_id: id,
      applicant_id: user.id,
      organization_name: organization.trim() || profile?.organization_name || null,
      support_type: supportType.trim() || null,
      proposal: proposal.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "en" ? "Proposal submitted" : "प्रस्ताव भेजा गया");
    await queryClient.invalidateQueries({ queryKey: ["application", id] });
  }

  if (isLoading) {
    return (
      <Page title={lang === "en" ? "Loading…" : "लोड हो रहा है…"}>
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    );
  }

  if (!project) {
    return (
      <Page title={lang === "en" ? "Challenge not found" : "चुनौती नहीं मिली"}>
        <Button asChild>
          <Link to="/innovation">{lang === "en" ? "All challenges" : "सभी चुनौतियाँ"}</Link>
        </Button>
      </Page>
    );
  }

  const stageIndex = INNOVATION_STAGES.indexOf(project.status as (typeof INNOVATION_STAGES)[number]);
  const canApply = user && (role === "university" || role === "partner");

  return (
    <Page title={project.title} description={project.district ?? "Jharkhand"}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-5">
            <p className="whitespace-pre-line">{project.description}</p>
            {project.expected_outcome ? (
              <p className="mt-4">
                <b>{lang === "en" ? "Expected outcome: " : "अपेक्षित परिणाम: "}</b>
                {project.expected_outcome}
              </p>
            ) : null}
            {project.deadline ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {lang === "en" ? "Deadline" : "अंतिम तिथि"}:{" "}
                {new Date(project.deadline).toLocaleDateString()}
              </p>
            ) : null}
          </div>

          <PartnerOpportunity project={project} role={role} />

          {canApply ? (
            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "Express interest" : "रुचि दर्ज करें"}
              </h2>
              {myApplication ? (
                <p className="mt-3 flex items-center gap-2 text-success">
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                  {lang === "en"
                    ? `Your proposal is ${myApplication.status}.`
                    : "आपका प्रस्ताव दर्ज है।"}
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org">
                      {lang === "en" ? "Organisation name" : "संस्था का नाम"}
                    </Label>
                    <Input
                      id="org"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder={profile?.organization_name ?? ""}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="support">
                      {lang === "en"
                        ? "Support type (funding, technology, mentorship, implementation)"
                        : "सहयोग का प्रकार"}
                    </Label>
                    <Input
                      id="support"
                      value={supportType}
                      onChange={(e) => setSupportType(e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposal">
                      {lang === "en" ? "Solution proposal" : "समाधान प्रस्ताव"}
                    </Label>
                    <Textarea
                      id="proposal"
                      rows={4}
                      value={proposal}
                      onChange={(e) => setProposal(e.target.value)}
                    />
                  </div>
                  <Button onClick={apply} disabled={saving}>
                    {lang === "en" ? "Submit proposal" : "प्रस्ताव भेजें"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="card-surface p-5">
              <p>
                {lang === "en"
                  ? "Sign in as a university team or industry partner to express interest."
                  : "रुचि दर्ज करने के लिए विश्वविद्यालय या उद्योग भागीदार के रूप में लॉगिन करें।"}
              </p>
              <Button asChild className="mt-3">
                <Link to="/auth">{lang === "en" ? "Sign in" : "लॉगिन"}</Link>
              </Button>
            </div>
          )}

          {(project.research_notes || project.prototype_url || project.pilot_notes) && (
            <div className="card-surface p-5">
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "Project workspace" : "परियोजना कार्यस्थल"}
              </h2>
              {project.research_notes ? (
                <p className="mt-3">
                  <b>{lang === "en" ? "Research: " : "अनुसंधान: "}</b>
                  {project.research_notes}
                </p>
              ) : null}
              {project.prototype_url ? (
                <p className="mt-2">
                  <b>{lang === "en" ? "Prototype: " : "प्रोटोटाइप: "}</b>
                  {project.prototype_url}
                </p>
              ) : null}
              {project.pilot_notes ? (
                <p className="mt-2">
                  <b>{lang === "en" ? "Field pilot: " : "क्षेत्रीय परीक्षण: "}</b>
                  {project.pilot_notes}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="card-surface h-fit p-5">
          <h2 className="text-lg font-semibold">
            {lang === "en" ? "Innovation workflow" : "नवाचार प्रक्रिया"}
          </h2>
          <ol className="mt-4 space-y-4">
            {INNOVATION_STAGES.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span
                  className={`mt-1 size-3 shrink-0 rounded-full ${stageIndex >= i ? "bg-success" : "bg-border"}`}
                  aria-hidden="true"
                />
                <p className={stageIndex >= i ? "font-medium" : "text-muted-foreground"}>
                  {pick(INNOVATION_STAGE_LABELS[s])}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="card-surface mt-6 p-5">
        <h2 className="font-semibold">Suggested Innovation Direction</h2>
        <p className="mt-2 text-sm text-muted-foreground">AI suggestions are advisory. Government approval is required before any pilot or implementation.</p>
      </div>
    </Page>
  );
}
