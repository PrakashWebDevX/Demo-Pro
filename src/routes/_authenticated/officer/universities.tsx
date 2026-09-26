import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, isStaffRole } from "@/lib/auth";
import { fetchDirectory } from "@/lib/assignment";
import { fetchUniversityVerifications, setUniversityVerification, type UniversityVerification } from "@/lib/challenges";
import { Page, EmptyState } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/officer/universities")({
  component: UniversityVerificationDirectory,
});

const DEMO_NOTE = "Demo Verification Data — Official verification required before production use.";

function UniversityVerificationDirectory() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const allowed = isStaffRole(role);
  const { data: directory, isLoading } = useQuery({
    queryKey: ["university-verification-directory"],
    queryFn: fetchDirectory,
    enabled: allowed,
  });
  const universities = (directory?.partners ?? []).filter((partner) => partner.partner_kind === "university");
  const { data: verificationRows = [] } = useQuery({
    queryKey: ["university-verifications", universities.map((partner) => partner.id).join(",")],
    queryFn: () => fetchUniversityVerifications(universities.map((partner) => partner.id)),
    enabled: allowed && universities.length > 0,
  });
  const byPartner = new Map(verificationRows.map((row) => [row.partner_id, row]));

  if (!allowed) return <Page title="University Verification Directory"><EmptyState title="Government staff access required." /></Page>;
  if (isLoading) return <Page title="University Verification Directory"><p className="text-muted-foreground">Loading…</p></Page>;

  async function save(partnerId: string, status: UniversityVerification["verification_status"], defaultEligible: boolean) {
    if (!window.confirm(`Confirm university verification status: ${status}?`)) return;
    const current = byPartner.get(partnerId);
    const reference = (document.getElementById(`reference-${partnerId}`) as HTMLInputElement | null)?.value.trim();
    const note = (document.getElementById(`note-${partnerId}`) as HTMLInputElement | null)?.value.trim();
    const sourceType = (document.getElementById(`source-${partnerId}`) as HTMLSelectElement | null)?.value || current?.verification_source_type || "Demo Record";
    const eligibleBox = document.getElementById(`eligible-${partnerId}`) as HTMLInputElement | null;
    // Only a verified university may be eligible; the officer's toggle applies when verifying.
    const eligible = status === "verified" ? (eligibleBox?.checked ?? defaultEligible) : false;
    try {
      await setUniversityVerification({
        partnerId,
        status,
        eligible,
        sourceType,
        ...((reference || current?.verification_reference_id) ? { referenceId: reference || current!.verification_reference_id! } : {}),
        note: note || current?.verification_note || DEMO_NOTE,
      });
      await queryClient.invalidateQueries({ queryKey: ["university-verifications"] });
      toast.success("Verification decision saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save verification.");
    }
  }

  return (
    <Page title="University Verification Directory" description="Manual government verification for innovation partners.">
      <p className="mb-5 rounded-md bg-muted p-3 text-sm text-muted-foreground">{DEMO_NOTE} No automatic UGC, AICTE, or government API validation is performed.</p>
      <div className="grid gap-4">
        {universities.length === 0 ? <EmptyState title="No university partners found." /> : null}
        {universities.map((partner) => {
          const verification = byPartner.get(partner.id);
          const status = verification?.verification_status ?? "unverified";
          const canInvite = status === "verified" && partner.active_status && Boolean(verification?.eligibility_to_invite);
          return (
            <article key={partner.id} className="card-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{partner.name}</h2>
                  <p className="text-sm text-muted-foreground">{partner.organization_type} · {partner.city}, {partner.state}</p>
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">{status}</span>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p><b>Expertise:</b> {partner.expertise_labels.join(", ") || "—"}</p>
                <p><b>Innovation domains:</b> {partner.innovation_domains.join(", ") || "—"}</p>
                <p><b>Capacity:</b> {partner.available_team_capacity}</p>
                <p><b>Current workload:</b> {partner.current_workload}</p>
                <p><b>Source:</b> {verification?.verification_source_type ?? "—"}</p>
                <p><b>Reference:</b> {verification?.verification_reference_id ?? "—"}</p>
                <p><b>Verified date:</b> {verification?.verified_at ? new Date(verification.verified_at).toLocaleDateString() : "—"}</p>
                <p><b>Verified by:</b> {verification?.verified_by_profile_id ? "Government staff (recorded)" : verification?.verification_status === "verified" ? "Demo Innovation Administrator" : "—"}</p>
                <p><b>Active status:</b> {partner.active_status ? "Active" : "Inactive"}</p>
                <p><b>Invitation eligibility:</b> {canInvite ? "Eligible" : "Not eligible"}</p>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{verification?.verification_note ?? DEMO_NOTE}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void save(partner.id, "verification_pending", false)}>Mark Verification Pending</Button>
                <Button onClick={() => void save(partner.id, "verified", true)}>Mark Verified</Button>
                <Button variant="outline" onClick={() => void save(partner.id, "verification_rejected", false)}>Reject Verification</Button>
                <Button variant="outline" onClick={() => void save(partner.id, "inactive", false)}>Mark Inactive</Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor={`reference-${partner.id}`}>Reference ID / URL</Label><Input id={`reference-${partner.id}`} defaultValue={verification?.verification_reference_id ?? ""} placeholder="Manual demo reference" /></div>
                <div className="space-y-1"><Label htmlFor={`source-${partner.id}`}>Verification source</Label>
                  <select id={`source-${partner.id}`} defaultValue={verification?.verification_source_type ?? "Demo Record"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {["Demo Record", "UGC Reference", "AICTE Reference", "Manual Document Review"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 self-end text-sm"><input id={`eligible-${partner.id}`} type="checkbox" defaultChecked={verification?.eligibility_to_invite ?? true} /> Eligible to invite (applies when marked Verified)</label>
                <div className="space-y-1"><Label htmlFor={`note-${partner.id}`}>Verification note</Label><Input id={`note-${partner.id}`} defaultValue={verification?.verification_note ?? DEMO_NOTE} /></div>
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
