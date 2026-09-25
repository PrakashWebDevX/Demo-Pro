import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Headset, Phone, PhoneOff, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { analyseReport } from "@/lib/ai-demo";
import { DISTRICTS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { LANGUAGE_OPTIONS } from "@/i18n/languages";
import { LanguageSelect } from "./LanguageSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PROMPTS = [
  "Hello. Please describe the civic issue you want to report.",
  "Thank you. Please confirm your location.",
  "Your report has been created successfully.",
];
const STEPS = [
  "Tell us your problem",
  "AI understands your location and issue",
  "Your report is created for review",
];
const MIN_KEY = "jsj_phone_minimized";

export function PhoneAssistant() {
  const { tr } = useLang();
  const [minimized, setMinimized] = useState(false);
  const [open, setOpen] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    setMinimized(window.localStorage.getItem(MIN_KEY) === "1");
  }, []);

  function setMin(v: boolean) {
    window.localStorage.setItem(MIN_KEY, v ? "1" : "0");
    setMinimized(v);
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        {minimized ? (
          <button
            type="button"
            onClick={() => setMin(false)}
            aria-label="Open Report by Phone assistant"
            className="pulse-once relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <Phone className="size-6" />
            <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-3.5" />
            </span>
          </button>
        ) : (
          <section
            aria-label="Report by Phone"
            className="pulse-once w-[17.5rem] rounded-xl border bg-card p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Phone className="size-5" />
                <Headset className="absolute -bottom-1 -right-1 size-5 rounded-full bg-accent p-0.5 text-accent-foreground" />
              </span>
              <div className="flex-1">
                <p className="font-semibold leading-tight">{tr("Report by Phone")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr("Speak in your language. AI creates your report.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMin(true)}
                aria-label={tr("Minimise phone assistant")}
                className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" onClick={() => setOpen(true)}>
                <Phone className="size-4" /> {tr("Start AI Call")}
              </Button>
              <Button variant="outline" onClick={() => setShowHow(true)}>
                {tr("How it works", "यह कैसे काम करता है")}
              </Button>
            </div>
          </section>
        )}
      </div>

      <Dialog open={showHow} onOpenChange={setShowHow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("How Report by Phone works")}</DialogTitle>
            <DialogDescription>
              {tr("Demo voice assistant — real call integration can be connected later.")}
            </DialogDescription>
          </DialogHeader>
          <StepList active={-1} />
        </DialogContent>
      </Dialog>

      <CallDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function StepList({ active }: { active: number }) {
  const { tr } = useLang();
  return (
    <ol className="grid gap-2">
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={`flex items-center gap-3 rounded-md border p-3 ${i <= active ? "border-accent bg-accent/10" : ""}`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </span>
          <span className="font-medium">{tr(s)}</span>
        </li>
      ))}
    </ol>
  );
}

function CallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { tr, locale } = useLang();
  const language = LANGUAGE_OPTIONS.find((l) => l.code === locale)?.english ?? "English";
  const [inCall, setInCall] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [district, setDistrict] = useState(profile?.district ?? "Ranchi");
  const [place, setPlace] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; publicId: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!inCall) return;
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [inCall]);

  useEffect(() => {
    if (!open) {
      setInCall(false);
      setSeconds(0);
      setStep(0);
      setText("");
      setPlace("");
      setCreated(null);
    }
  }, [open]);

  async function createReport() {
    if (!user) return;
    if (text.trim().length < 10) {
      toast.error(tr("Please describe the issue in at least 10 characters."));
      return;
    }
    setSaving(true);
    const s = analyseReport({ title: text, description: text, categoryKey: "other", district });
    const title = `${s.category_label} issue reported by phone`;
    const { data, error } = await supabase
      .from("reports")
      .insert({
        citizen_id: user.id,
        reporter_name: profile?.full_name ?? null,
        title,
        description: `${text.trim()}${place ? `\n\nLocation stated: ${place}` : ""}\n\n(Call language: ${language})`,
        category_key: s.category_key,
        district,
        village_or_ward: place || null,
        priority: s.priority,
        status: "submitted",
        ai_category: s.category_label,
        ai_priority: s.priority,
        ai_duplicate_count: 0,
        ai_recommended_department: s.recommended_department,
        ai_next_action: s.next_action,
        source: "AI Phone Call",
        public_issue_id: "",
      })
      .select("id, public_issue_id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? tr("Could not create the report."));
      return;
    }
    await supabase.from("report_updates").insert({
      report_id: data.id,
      updated_by: user.id,
      updated_by_name: profile?.full_name ?? "Citizen",
      old_status: null,
      new_status: "submitted",
      remark: "Created via AI Phone Assistant (demo).",
    });
    setSaving(false);
    setInCall(false);
    setStep(2);
    setCreated({ id: data.id, publicId: data.public_issue_id });
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr("AI Phone Assistant")}</DialogTitle>
          <DialogDescription>
            {tr("Demo voice assistant — real call integration can be connected later.")}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="grid gap-3">
            <p>{tr("Please log in so the report can be saved to your account.")}</p>
            <Button asChild>
              <Link to="/auth">{tr("Log in")}</Link>
            </Button>
          </div>
        ) : created ? (
          <div className="grid gap-3 text-center">
            <p className="text-lg font-semibold">{tr(PROMPTS[2] ?? "")}</p>
            <p className="text-muted-foreground">
              {tr("Report ID {id} is pending officer review.", undefined, { id: created.publicId })}
            </p>
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate({ to: "/reports/$id", params: { id: created.id } });
              }}
            >
              {tr("View My Report")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <StepList active={inCall ? step : -1} />

            <div className="grid gap-1.5">
              <Label htmlFor="call-lang">{tr("Call language")}</Label>
              <LanguageSelect id="call-lang" />
            </div>

            {!inCall ? (
              <Button size="lg" className="h-14 text-lg" onClick={() => setInCall(true)}>
                <Phone className="size-5" /> {tr("Start Demo Call")}
              </Button>
            ) : (
              <div className="rounded-lg bg-primary p-4 text-primary-foreground">
                <div className="flex items-center justify-between text-sm">
                  <span>{tr("Demo call")} · {language}</span>
                  <span className="font-mono" aria-live="off">
                    {mm}:{ss}
                  </span>
                </div>
                <div className="my-3 flex h-10 items-center justify-center gap-1" aria-hidden="true">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className="wave-bar h-full w-1.5 rounded-full bg-accent"
                      style={{ animationDelay: `${(i % 5) * 0.12}s` }}
                    />
                  ))}
                </div>
                <p className="text-center font-medium" aria-live="polite">
                  “{tr(PROMPTS[Math.min(step, 1)] ?? "")}”
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setInCall(false);
                    setSeconds(0);
                    setStep(0);
                  }}
                >
                  <PhoneOff className="size-4" /> {tr("End call")}
                </Button>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="call-text">{tr("Type your issue instead")}</Label>
              <Textarea
                id="call-text"
                rows={3}
                value={text}
                onChange={(e) => { setText(e.target.value); if (e.target.value.trim().length >= 10) setStep((s) => Math.max(s, 1)); }}
                onBlur={() => text.trim().length >= 10 && setStep((s) => Math.max(s, 1))}
                placeholder="e.g. Garbage has not been collected near the market for a week."
              />
            </div>

            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="call-district">{tr("District")}</Label>
                  <select
                    id="call-district"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="h-11 rounded-md border bg-background px-3"
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="call-place">{tr("Area / landmark")}</Label>
                  <input
                    id="call-place"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    className="h-11 rounded-md border bg-background px-3"
                    placeholder="e.g. Ward 12, Main Road"
                  />
                </div>
              </div>
            </>

            <Button size="lg" onClick={createReport} disabled={saving}>
              {saving ? tr("Creating report…") : tr("Create Report")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
