import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { ApprovedInnovationCases } from "@/components/app/PartnerVisibility";
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
import {
  CHALLENGE_STAGE_LABELS,
  ROLE_LABELS,
  fetchMyInvitations,
  fetchMyPartnerOrgs,
  respondToInvitation,
  fetchMappedPartnerOrg,
  fetchMappedPartnerInvitations,
  respondToMappedInvitation,
  submitMappedPartnerUpdate,
  fetchMappedPartnerUpdates,
  fetchMappedTeamRoles,
  fetchUniversityVerifications,
  type PartnerInvitation,
} from "@/lib/challenges";

export const Route = createFileRoute("/_authenticated/partner")({
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const { role } = useAuth();
  if (role === "university_partner" || role === "industry_partner") {
    return <MappedPartnerPortal role={role} />;
  }
  return <LegacyPartnerDashboard />;
}

function MappedPartnerPortal({ role }: { role: "university_partner" | "industry_partner" }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const university = role === "university_partner";
  const { data: organization, isLoading: loadingOrg } = useQuery({
    queryKey: ["mapped-partner-org", user?.id],
    queryFn: () => fetchMappedPartnerOrg(user!.id),
    enabled: Boolean(user?.id),
  });
  const { data: invitations = [], isLoading: loadingInvitations } = useQuery({
    queryKey: ["mapped-partner-invitations", organization?.id],
    queryFn: () => fetchMappedPartnerInvitations(organization!.id),
    enabled: Boolean(organization?.id),
  });
  const { data: verificationRows = [] } = useQuery({
    queryKey: ["mapped-partner-verification", organization?.id],
    queryFn: () => fetchUniversityVerifications([organization!.id]),
    enabled: university && Boolean(organization?.id),
  });
  const challengeIds = invitations.flatMap((inv) => inv.challenge ? [inv.challenge.id] : []);
  const { data: updates = [] } = useQuery({
    queryKey: ["mapped-partner-updates", organization?.id, challengeIds.join(",")],
    queryFn: () => fetchMappedPartnerUpdates(organization!.id, challengeIds),
    enabled: Boolean(organization?.id),
  });
  const { data: teamRoles = [] } = useQuery({
    queryKey: ["mapped-partner-team-roles", organization?.id, challengeIds.join(",")],
    queryFn: () => fetchMappedTeamRoles(challengeIds, organization!.id),
    enabled: Boolean(organization?.id),
  });

  async function respond(rowId: string, accepted: boolean) {
    await respondToMappedInvitation(rowId, accepted);
    await queryClient.invalidateQueries({ queryKey: ["mapped-partner-invitations"] });
  }

  async function submitUpdate(challengeId: string, type: "clarification_request" | "research_update" | "technical_approach" | "prototype_update" | "field_pilot_update" | "resource_estimate" | "ready_for_review") {
    if (!user || !organization) return;
    await submitMappedPartnerUpdate({
      challengeId,
      partnerId: organization.id,
      profileId: user.id,
      updateType: type,
      title: type.replaceAll("_", " "),
      publicSummary: "Demo partner update submitted for government review.",
    });
    toast.success("Update submitted for government review.");
  }

  if (loadingOrg || loadingInvitations) return <Page title="Partner Portal"><p className="text-muted-foreground">Loading…</p></Page>;
  if (!organization) return <Page title="Partner Portal"><EmptyState title="Partner organization mapping is not configured." hint="Ask an administrator to configure the secure demo mapping." /></Page>;

  return (
    <Page title={university ? "University Partner Portal" : "Industry / Startup Partner Portal"} description={organization.name}>
      <p className="text-sm text-muted-foreground">Demo account workspace. Only explicitly mapped and invited challenges are shown.</p>
      <p className="mt-2 rounded-md bg-muted p-3 text-sm">Only government-approved public-safe case information is shown.</p>
      {university ? <p className="mt-2 text-sm text-muted-foreground">Verification status: {verificationRows[0]?.verification_status ?? "unverified"}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Invited challenges" value={invitations.filter((x) => x.invitation_status === "sent").length} tone="accent" />
        <StatCard label="Accepted / Active" value={invitations.filter((x) => x.invitation_status === "accepted").length} tone="success" />
        <StatCard label="Declined" value={invitations.filter((x) => x.invitation_status === "declined").length} />
      </div>
      <div className="mt-8 grid gap-3">
        {invitations.length === 0 ? <EmptyState title="No mapped challenge invitations" /> : null}
        {invitations.map((inv) => inv.challenge ? (
          <article key={inv.id} className="card-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{inv.challenge.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{inv.challenge.category_label ?? inv.challenge.category_key} · {inv.challenge.district} · {inv.challenge.area_type}</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">{inv.invitation_status}</span>
            </div>
            <p className="mt-3">{inv.challenge.public_summary ?? inv.challenge.problem_statement}</p>
            <p className="mt-2 text-sm text-muted-foreground">Stage: {inv.challenge.stage} · Progress: {inv.challenge.progress_pct}% · Target: {inv.challenge.target_metric ?? "—"}</p>
            {teamRoles.filter((team: any) => team.challenge_id === inv.challenge!.id).map((team: any) => (
              <div key={team.role_key} className="mt-3 rounded-md bg-muted p-3 text-sm">
                <p className="font-semibold">{team.role_label}: {team.display_name}</p>
                {team.member_count ? <p>Team size: {team.member_count}</p> : null}
                {team.skills?.length ? <p>Skills: {team.skills.join(", ")}</p> : null}
                <p className="text-muted-foreground">{team.status}</p>
              </div>
            ))}
            {updates.filter((update: any) => update.challenge_id === inv.challenge!.id).length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Submitted updates: {updates.filter((update: any) => update.challenge_id === inv.challenge!.id).length}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link to="/challenges/$id" params={{ id: inv.challenge.id }}>View challenge</Link></Button>
              {inv.invitation_status === "sent" || inv.invitation_status === "invited" ? <>
                <Button onClick={() => void respond(inv.id, true)}>Accept Invitation</Button>
                <Button variant="outline" onClick={() => void respond(inv.id, false)}>Decline</Button>
                <Button variant="outline" onClick={() => void submitUpdate(inv.challenge!.id, "clarification_request")}>Request Clarification</Button>
              </> : null}
              {inv.invitation_status === "accepted" ? <>
                <Button variant="outline" onClick={() => void submitUpdate(inv.challenge!.id, university ? "research_update" : "technical_approach")}>{university ? "Submit Research Update" : "Submit Technical Approach"}</Button>
                <Button variant="outline" onClick={() => void submitUpdate(inv.challenge!.id, university ? "prototype_update" : "prototype_update")}>Submit Prototype Update</Button>
                {!university ? <Button variant="outline" onClick={() => void submitUpdate(inv.challenge!.id, "field_pilot_update")}>Submit Field Pilot Update</Button> : null}
                {!university ? <Button variant="outline" onClick={() => void submitUpdate(inv.challenge!.id, "resource_estimate")}>Submit Resource Estimate</Button> : null}
                <Button variant="outline" onClick={() => void submitUpdate(inv.challenge!.id, university ? "ready_for_review" : "ready_for_review")}>Ready for Government Review</Button>
              </> : null}
            </div>
          </article>
        ) : null)}
      </div>
      <ApprovedInnovationCases />
    </Page>
  );
}

function LegacyPartnerDashboard() {
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

  const { data: orgs = [] } = useQuery({
    queryKey: ["my-partner-orgs", user?.email],
    queryFn: () => fetchMyPartnerOrgs(user?.email),
    enabled: Boolean(user?.email),
  });

  const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
  const { data: invitations = [] } = useQuery({
    queryKey: ["my-invitations", orgs.map((o) => o.id).join(",")],
    queryFn: () => fetchMyInvitations(orgs.map((o) => o.id), orgNames),
    enabled: orgs.length > 0,
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

      {orgs.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold">
            {lang === "en" ? "Innovation challenge invitations" : "नवाचार चुनौती आमंत्रण"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {orgs.map((o) => o.name).join(", ")} ·{" "}
            {lang === "en"
              ? "Demo Data — Replace with Verified Government and Partner Directory in Production."
              : "डेमो डेटा — उत्पादन में सत्यापित सरकारी एवं भागीदार निर्देशिका से बदलें।"}
          </p>
          <div className="mt-3 grid gap-3">
            {invitations.length === 0 ? (
              <EmptyState
                title={lang === "en" ? "No invitations yet" : "अभी कोई आमंत्रण नहीं"}
                hint={
                  lang === "en"
                    ? "Government officers invite matched partners after approving an innovation challenge."
                    : "अधिकारी चुनौती स्वीकृत करने के बाद भागीदारों को आमंत्रित करते हैं।"
                }
              />
            ) : null}
            {invitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onDone={() => queryClient.invalidateQueries({ queryKey: ["my-invitations"] })}
              />
            ))}
          </div>
        </section>
      ) : null}

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

function InvitationCard({
  invitation,
  onDone,
}: {
  invitation: PartnerInvitation;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const [busy, setBusy] = useState(false);
  const c = invitation.challenge;
  const pending = invitation.invitation_status === "sent";

  async function respond(accepted: boolean) {
    setBusy(true);
    try {
      await respondToInvitation(invitation.id, accepted);
      toast.success(
        accepted
          ? lang === "en"
            ? "Invitation accepted"
            : "आमंत्रण स्वीकार किया गया"
          : lang === "en"
            ? "Invitation declined"
            : "आमंत्रण अस्वीकार किया गया",
      );
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save response");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel: Record<string, string> = {
    none: lang === "en" ? "Shortlisted" : "सूचीबद्ध",
    sent: lang === "en" ? "Invitation received" : "आमंत्रण प्राप्त",
    accepted: lang === "en" ? "Accepted" : "स्वीकृत",
    declined: lang === "en" ? "Declined" : "अस्वीकृत",
  };

  return (
    <div className="card-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{c?.title ?? invitation.partner_name}</h3>
          <p className="text-sm text-muted-foreground">
            {invitation.partner_name}
            {invitation.selected_role ? ` · ${ROLE_LABELS[invitation.selected_role]}` : ""}
            {c ? ` · ${CHALLENGE_STAGE_LABELS[c.stage] ?? c.stage}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {statusLabel[invitation.invitation_status]}
        </span>
      </div>

      {c?.problem_statement ? (
        <p className="mt-2 line-clamp-3 text-muted-foreground">{c.problem_statement}</p>
      ) : null}

      {invitation.match_score !== null ? (
        <p className="mt-2 text-sm">
          <b>{lang === "en" ? "Match score: " : "मिलान स्कोर: "}</b>
          {invitation.match_score}/100
          {invitation.match_reason ? ` — ${invitation.match_reason}` : ""}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {c ? (
          <Button asChild variant="outline">
            <Link to="/challenges/$id" params={{ id: c.id }}>
              {lang === "en" ? "View challenge" : "चुनौती देखें"}
            </Link>
          </Button>
        ) : null}
        {pending ? (
          <>
            <Button onClick={() => respond(true)} disabled={busy}>
              {lang === "en" ? "Accept invitation" : "आमंत्रण स्वीकारें"}
            </Button>
            <Button variant="outline" onClick={() => respond(false)} disabled={busy}>
              {lang === "en" ? "Decline" : "अस्वीकार करें"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
