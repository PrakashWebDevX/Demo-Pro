import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState, Page, StatCard } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { fetchDepartments, fetchReports } from "@/lib/reports";
import { CATEGORY_LABELS, DISTRICTS, ROLE_LABELS } from "@/lib/constants";
import { INNOVATION_STAGE_LABELS, type InnovationProject } from "@/lib/innovation";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { lang, pick } = useLang();
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({ queryKey: ["all-reports"], queryFn: () => fetchReports() });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("issue_categories").select("*").order("name");
      return (data ?? []) as Array<{ id: string; key: string; name: string; name_hi: string | null }>;
    },
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["innovation-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("innovation_projects").select("*");
      return (data ?? []) as InnovationProject[];
    },
  });
  const { data: applications = [] } = useQuery({
    queryKey: ["all-applications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_applications")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{
        id: string;
        innovation_project_id: string;
        applicant_id: string | null;
        organization_name: string | null;
        support_type: string | null;
        proposal: string | null;
        status: string;
      }>;
    },
  });

  const [newDept, setNewDept] = useState({ name: "", name_hi: "" });

  async function addDepartment() {
    if (!newDept.name.trim()) return;
    const { error } = await supabase
      .from("departments")
      .insert({ name: newDept.name.trim(), name_hi: newDept.name_hi.trim() || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewDept({ name: "", name_hi: "" });
    toast.success(lang === "en" ? "Department added" : "विभाग जोड़ा गया");
    await queryClient.invalidateQueries({ queryKey: ["departments"] });
  }

  async function decideApplication(
    applicationId: string,
    projectId: string,
    applicantId: string | null,
    approve: boolean,
  ) {
    const { error } = await supabase
      .from("partner_applications")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", applicationId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (approve && applicantId) {
      await supabase
        .from("innovation_projects")
        .update({ assigned_partner_id: applicantId, status: "partner_assigned" })
        .eq("id", projectId);
    }
    toast.success(lang === "en" ? "Application updated" : "आवेदन अपडेट हुआ");
    await queryClient.invalidateQueries({ queryKey: ["all-applications"] });
    await queryClient.invalidateQueries({ queryKey: ["innovation-projects"] });
  }

  async function approveDeployment(projectId: string) {
    const { error } = await supabase
      .from("innovation_projects")
      .update({ deployment_approved: true, status: "deployed" })
      .eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "en" ? "Deployment approved" : "तैनाती स्वीकृत");
    await queryClient.invalidateQueries({ queryKey: ["innovation-projects"] });
  }

  const byDistrict = DISTRICTS.map((d) => ({
    district: d,
    count: reports.filter((r) => r.district === d).length,
  })).filter((d) => d.count > 0);

  return (
    <Page
      title={lang === "en" ? "Super Admin" : "सुपर एडमिन"}
      description={
        lang === "en"
          ? "Platform configuration, partner approvals and state-wide analytics."
          : "मंच विन्यास, भागीदार स्वीकृति एवं राज्यव्यापी विश्लेषण।"
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={lang === "en" ? "Total reports" : "कुल शिकायतें"} value={reports.length} />
        <StatCard
          label={lang === "en" ? "Resolved" : "समाधान"}
          value={reports.filter((r) => r.status === "resolved").length}
          tone="success"
        />
        <StatCard
          label={lang === "en" ? "Departments" : "विभाग"}
          value={departments.length}
          tone="accent"
        />
        <StatCard
          label={lang === "en" ? "Innovation projects" : "नवाचार परियोजनाएँ"}
          value={projects.length}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="analytics" className="mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="analytics">{lang === "en" ? "Analytics" : "विश्लेषण"}</TabsTrigger>
          <TabsTrigger value="departments">{lang === "en" ? "Departments" : "विभाग"}</TabsTrigger>
          <TabsTrigger value="categories">{lang === "en" ? "Categories" : "श्रेणियाँ"}</TabsTrigger>
          <TabsTrigger value="partners">{lang === "en" ? "Partners" : "भागीदार"}</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">
              {lang === "en" ? "Reports by district" : "जिलेवार शिकायतें"}
            </h2>
            <ul className="mt-3 space-y-2">
              {byDistrict.map((d) => (
                <li key={d.district} className="flex items-center justify-between gap-3">
                  <span>{d.district}</span>
                  <span className="font-semibold">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-surface p-5">
            <h2 className="text-lg font-semibold">
              {lang === "en" ? "Reports by category" : "श्रेणीवार शिकायतें"}
            </h2>
            <ul className="mt-3 space-y-2">
              {Object.keys(CATEGORY_LABELS).map((key) => {
                const count = reports.filter((r) => r.category_key === key).length;
                if (!count) return null;
                return (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span>{pick(CATEGORY_LABELS[key])}</span>
                    <span className="font-semibold">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card-surface p-5 md:col-span-2">
            <h2 className="text-lg font-semibold">{lang === "en" ? "Roles" : "भूमिकाएँ"}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <li key={key} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span className="font-mono text-sm text-muted-foreground">{key}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="mt-4 space-y-4">
          <div className="card-surface grid gap-4 p-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dept-name">{lang === "en" ? "Department name" : "विभाग का नाम"}</Label>
              <Input
                id="dept-name"
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-hi">{lang === "en" ? "Name in Hindi" : "हिन्दी नाम"}</Label>
              <Input
                id="dept-hi"
                value={newDept.name_hi}
                onChange={(e) => setNewDept({ ...newDept, name_hi: e.target.value })}
                className="h-12 text-base"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addDepartment} className="w-full">
                {lang === "en" ? "Add department" : "विभाग जोड़ें"}
              </Button>
            </div>
          </div>
          <div className="card-surface p-5">
            <ul className="grid gap-2">
              {departments.map((d) => (
                <li key={d.id} className="flex justify-between gap-3">
                  <span>{d.name}</span>
                  <span className="text-muted-foreground">{d.name_hi}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="card-surface p-5">
            <ul className="grid gap-2">
              {categories.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.name_hi}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="partners" className="mt-4 space-y-4">
          {applications.length === 0 ? (
            <EmptyState title={lang === "en" ? "No partner proposals yet" : "कोई प्रस्ताव नहीं"} />
          ) : null}
          {applications.map((a) => {
            const project = projects.find((p) => p.id === a.innovation_project_id);
            return (
              <div key={a.id} className="card-surface p-5">
                <p className="font-semibold">{project?.title ?? "Challenge"}</p>
                <p className="text-sm text-muted-foreground">
                  {a.organization_name ?? "—"} · {a.support_type ?? "—"} · {a.status}
                </p>
                {a.proposal ? <p className="mt-2">{a.proposal}</p> : null}
                {a.status === "pending" ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      onClick={() =>
                        decideApplication(a.id, a.innovation_project_id, a.applicant_id, true)
                      }
                    >
                      {lang === "en" ? "Approve partner" : "भागीदार स्वीकृत करें"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        decideApplication(a.id, a.innovation_project_id, a.applicant_id, false)
                      }
                    >
                      {lang === "en" ? "Reject" : "अस्वीकार"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}

          <h2 className="mt-6 text-xl font-bold">
            {lang === "en" ? "Deployment approvals" : "तैनाती स्वीकृति"}
          </h2>
          {projects
            .filter((p) => !p.deployment_approved)
            .map((p) => (
              <div key={p.id} className="card-surface flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {pick(INNOVATION_STAGE_LABELS[p.status])}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => approveDeployment(p.id)}
                  disabled={p.status !== "deployment_review"}
                >
                  {lang === "en" ? "Approve deployment" : "तैनाती स्वीकृत करें"}
                </Button>
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </Page>
  );
}
