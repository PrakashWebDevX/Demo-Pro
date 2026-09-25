import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import {
  INNOVATION_STAGES,
  INNOVATION_STAGE_LABELS,
  type InnovationProject,
} from "@/lib/innovation";

export const Route = createFileRoute("/_authenticated/partner")({
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const { user, profile } = useAuth();
  const { lang, pick } = useLang();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["partner-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InnovationProject[];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["my-applications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_applications")
        .select("*")
        .eq("applicant_id", user!.id);
      return (data ?? []) as Array<{
        id: string;
        innovation_project_id: string;
        status: string;
        support_type: string | null;
      }>;
    },
    enabled: Boolean(user?.id),
  });

  const mine = projects.filter((p) => p.assigned_partner_id === user?.id);
  const open = projects.filter((p) => p.status === "open");

  return (
    <Page
      title={lang === "en" ? "Innovation Partner Workspace" : "नवाचार भागीदार कार्यस्थल"}
      description={profile?.organization_name ?? ""}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={lang === "en" ? "Open challenges" : "खुली चुनौतियाँ"}
          value={open.length}
          tone="accent"
        />
        <StatCard
          label={lang === "en" ? "My proposals" : "मेरे प्रस्ताव"}
          value={applications.length}
        />
        <StatCard
          label={lang === "en" ? "Assigned projects" : "सौंपी परियोजनाएँ"}
          value={mine.length}
          tone="success"
        />
      </div>

      <h2 className="mt-8 text-xl font-bold">
        {lang === "en" ? "My assigned projects" : "मेरी परियोजनाएँ"}
      </h2>
      <div className="mt-3 grid gap-4">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && mine.length === 0 ? (
          <EmptyState
            title={lang === "en" ? "No assigned projects yet" : "अभी कोई परियोजना नहीं"}
            hint={
              lang === "en"
                ? "Express interest in an open challenge below."
                : "नीचे दी गई चुनौतियों में रुचि दर्ज करें।"
            }
          />
        ) : null}
        {mine.map((p) => (
          <ProjectWorkspace
            key={p.id}
            project={p}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["partner-projects"] })}
          />
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">
        {lang === "en" ? "Open challenges" : "खुली चुनौतियाँ"}
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {open.map((p) => {
          const app = applications.find((a) => a.innovation_project_id === p.id);
          return (
            <div key={p.id} className="card-surface p-5">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{p.description}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {p.district} · {pick(INNOVATION_STAGE_LABELS[p.status])}
                {app
                  ? ` · ${lang === "en" ? "Proposal" : "प्रस्ताव"}: ${app.status}`
                  : ""}
              </p>
              <Button asChild className="mt-3">
                <Link to="/innovation/$id" params={{ id: p.id }}>
                  {lang === "en" ? "View challenge" : "चुनौती देखें"}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

function ProjectWorkspace({
  project,
  onSaved,
}: {
  project: InnovationProject;
  onSaved: () => void;
}) {
  const { lang, pick } = useLang();
  const [status, setStatus] = useState(project.status);
  const [research, setResearch] = useState(project.research_notes ?? "");
  const [prototype, setPrototype] = useState(project.prototype_url ?? "");
  const [pilot, setPilot] = useState(project.pilot_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("innovation_projects")
      .update({
        status,
        research_notes: research.trim() || null,
        prototype_url: prototype.trim() || null,
        pilot_notes: pilot.trim() || null,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "en" ? "Progress saved" : "प्रगति सहेजी गई");
    onSaved();
  }

  return (
    <div className="card-surface p-5">
      <h3 className="text-lg font-semibold">{project.title}</h3>
      <p className="text-sm text-muted-foreground">
        {pick(INNOVATION_STAGE_LABELS[project.status])}
        {project.deployment_approved
          ? ` · ${lang === "en" ? "Deployment approved" : "तैनाती स्वीकृत"}`
          : ""}
      </p>
      <div className="mt-4 grid gap-4">
        <div className="space-y-2">
          <Label htmlFor={`stage-${project.id}`}>{lang === "en" ? "Stage" : "चरण"}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id={`stage-${project.id}`} className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INNOVATION_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {pick(INNOVATION_STAGE_LABELS[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`research-${project.id}`}>
            {lang === "en" ? "Research notes" : "अनुसंधान टिप्पणी"}
          </Label>
          <Textarea
            id={`research-${project.id}`}
            rows={3}
            value={research}
            onChange={(e) => setResearch(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`proto-${project.id}`}>
            {lang === "en" ? "Prototype link" : "प्रोटोटाइप लिंक"}
          </Label>
          <Input
            id={`proto-${project.id}`}
            value={prototype}
            onChange={(e) => setPrototype(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`pilot-${project.id}`}>
            {lang === "en" ? "Field pilot update" : "क्षेत्रीय परीक्षण अपडेट"}
          </Label>
          <Textarea
            id={`pilot-${project.id}`}
            rows={3}
            value={pilot}
            onChange={(e) => setPilot(e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {lang === "en" ? "Save progress" : "प्रगति सहेजें"}
        </Button>
        {project.government_comments ? (
          <p className="rounded-md bg-muted p-3 text-sm">
            <b>{lang === "en" ? "Government comments: " : "सरकारी टिप्पणी: "}</b>
            {project.government_comments}
          </p>
        ) : null}
      </div>
    </div>
  );
}
