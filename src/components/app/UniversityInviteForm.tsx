import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendUniversityInvitation, type UniversityVerification } from "@/lib/challenges";

const UNIVERSITY_ROLES = ["Lead Research Partner", "Prototype Partner", "Pilot Evaluation Partner"] as const;

const BLOCK_REASON: Record<UniversityVerification["verification_status"], string> = {
  unverified: "University is not verified yet.",
  verification_pending: "Verification is pending approval.",
  verified: "Invitation eligibility is turned off.",
  verification_rejected: "Verification was rejected.",
  inactive: "University is marked inactive.",
};

export function UniversityInviteForm({
  challengeId,
  partnerId,
  partnerActive,
  verification,
  invitationStatus,
  onSent,
}: {
  challengeId: string;
  partnerId: string;
  partnerActive: boolean;
  verification: UniversityVerification | undefined;
  invitationStatus: string | undefined;
  onSent: () => void;
}) {
  const status = verification?.verification_status ?? "unverified";
  const eligible = status === "verified" && Boolean(verification?.eligibility_to_invite) && partnerActive;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>(UNIVERSITY_ROLES[0]);
  const [contribution, setContribution] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const alreadyInvited = invitationStatus === "invited" || invitationStatus === "accepted" || invitationStatus === "active_team";

  const verifyLink = (
    <Link to="/officer/universities" className="text-sm font-medium text-accent underline-offset-2 hover:underline">
      Verify University
    </Link>
  );

  if (!eligible) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled>Send Invitation</Button>
        <span className="text-xs text-muted-foreground">{partnerActive ? BLOCK_REASON[status] : "University is inactive."}</span>
        {verifyLink}
      </div>
    );
  }

  async function send() {
    if (!contribution.trim() || !targetDate) {
      toast.error("Add expected contribution and target date.");
      return;
    }
    if (!window.confirm(`Send invitation as ${role}?`)) return;
    setBusy(true);
    try {
      await sendUniversityInvitation({ challengeId, partnerId, role, contribution: contribution.trim(), targetDate, scope: scope.trim() });
      toast.success("Invitation sent to university.");
      setOpen(false);
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={alreadyInvited} onClick={() => setOpen((v) => !v)}>
          {alreadyInvited ? "Invitation sent" : open ? "Cancel" : "Send Invitation"}
        </Button>
        <span className="text-xs text-muted-foreground">Verified · eligible to invite</span>
        {verifyLink}
      </div>
      {open ? (
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>University role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIVERSITY_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`target-${partnerId}`}>Target date</Label>
            <Input id={`target-${partnerId}`} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`contrib-${partnerId}`}>Expected contribution</Label>
            <Input id={`contrib-${partnerId}`} value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="e.g. Sensor prototype and data model" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`scope-${partnerId}`}>Scope (no private citizen data)</Label>
            <Input id={`scope-${partnerId}`} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Public-safe summary of the work" />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" disabled={busy} onClick={() => void send()}>Confirm & Send Invitation</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
