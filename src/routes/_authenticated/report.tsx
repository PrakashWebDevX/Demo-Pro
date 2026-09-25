import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  CloudOff,
  Loader2,
  MapPin,
  Mic,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Page } from "@/components/app/Page";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { CATEGORY_KEYS, CATEGORY_LABELS, DISTRICTS } from "@/lib/constants";
import { analyseReport } from "@/lib/ai-demo";
import { fetchDepartments } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/report")({
  component: ReportIssuePage,
});

const DRAFT_KEY = "jsj_offline_draft";

interface DraftState {
  category_key: string;
  title: string;
  description: string;
  district: string;
  block: string;
  municipality: string;
  village_or_ward: string;
  latitude: string;
  longitude: string;
}

const emptyDraft: DraftState = {
  category_key: "",
  title: "",
  description: "",
  district: "Ranchi",
  block: "",
  municipality: "",
  village_or_ward: "",
  latitude: "",
  longitude: "",
};

function ReportIssuePage() {
  const { user, profile } = useAuth();
  const { lang, pick, t } = useLang();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<DraftState>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [created, setCreated] = useState<{ id: string; publicId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["existing-for-ai"],
    queryFn: async () => {
      const { data } = await supabase.from("reports").select("category_key, district, title");
      return (data ?? []) as Array<{ category_key: string; district: string; title: string }>;
    },
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        setForm({ ...emptyDraft, ...(JSON.parse(raw) as DraftState) });
        setSavedOffline(true);
      } catch {
        /* ignore corrupt draft */
      }
    }
  }, []);

  useEffect(() => {
    if (profile?.district) setForm((f) => (f.district ? f : { ...f, district: profile.district! }));
  }, [profile?.district]);

  const suggestion = useMemo(
    () =>
      analyseReport({
        title: form.title,
        description: form.description,
        categoryKey: form.category_key,
        district: form.district,
        existing,
      }),
    [form.title, form.description, form.category_key, form.district, existing],
  );

  function saveDraft() {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setSavedOffline(true);
    toast.success(
      lang === "en"
        ? "Saved offline on this device. Submit when internet is available."
        : "इस डिवाइस पर ऑफलाइन सहेजा गया। इंटरनेट आने पर जमा करें।",
    );
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error(lang === "en" ? "Location is not available" : "स्थान उपलब्ध नहीं है");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(5),
          longitude: pos.coords.longitude.toFixed(5),
        }));
        toast.success(lang === "en" ? "Location added" : "स्थान जोड़ा गया");
      },
      () =>
        toast.error(
          lang === "en"
            ? "Could not get location. Please enter it manually."
            : "स्थान नहीं मिला। कृपया मैन्युअल रूप से भरें।",
        ),
    );
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function validateStep(n: number): string | null {
    if (n === 1 && !form.category_key) {
      return lang === "en" ? "Please select a category." : "कृपया श्रेणी चुनें।";
    }
    if (n === 2) {
      if (form.title.trim().length < 5)
        return lang === "en" ? "Title must be at least 5 characters." : "शीर्षक कम से कम 5 अक्षर।";
      if (form.description.trim().length < 15)
        return lang === "en"
          ? "Please describe the issue in at least 15 characters."
          : "कृपया कम से कम 15 अक्षरों में विवरण दें।";
    }
    if (n === 4 && !form.district) {
      return lang === "en" ? "Please select a district." : "कृपया जिला चुनें।";
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    setError(err);
    if (!err) setStep((s) => Math.min(5, s + 1));
  }

  async function submitReport() {
    for (const n of [1, 2, 4]) {
      const err = validateStep(n);
      if (err) {
        setError(err);
        return;
      }
    }
    if (!user) return;
    setSubmitting(true);
    setError(null);

    const departmentId =
      departments.find((d) => d.name === suggestion.recommended_department)?.id ?? null;

    const { data, error: insertError } = await supabase
      .from("reports")
      .insert({
        citizen_id: user.id,
        reporter_name: profile?.full_name ?? null,
        title: form.title.trim(),
        description: form.description.trim(),
        category_key: form.category_key,
        district: form.district,
        block: form.block || null,
        municipality: form.municipality || null,
        village_or_ward: form.village_or_ward || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        priority: suggestion.priority,
        status: "submitted",
        ai_category: suggestion.category_label,
        ai_priority: suggestion.priority,
        ai_duplicate_count: suggestion.duplicate_count,
        ai_recommended_department: suggestion.recommended_department,
        ai_next_action: suggestion.next_action,
        public_issue_id: "",
      })
      .select("id, public_issue_id")
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError(insertError?.message ?? "Could not submit the report.");
      return;
    }

    if (file) {
      const path = `${user.id}/${data.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("report-media")
        .upload(path, file, { contentType: file.type });
      if (!uploadError) {
        await supabase
          .from("report_media")
          .insert({ report_id: data.id, file_url: path, file_type: file.type });
      }
    }

    window.localStorage.removeItem(DRAFT_KEY);
    setSubmitting(false);
    setCreated({ id: data.id, publicId: data.public_issue_id as string });
    setStep(6);
  }

  if (created) {
    return (
      <Page title={lang === "en" ? "Report submitted" : "शिकायत दर्ज हो गई"}>
        <div className="card-surface mx-auto max-w-xl p-6 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold">
            {lang === "en" ? "Thank you" : "धन्यवाद"}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {lang === "en"
              ? "Your issue will be reviewed by the concerned team."
              : "आपकी शिकायत संबंधित टीम द्वारा देखी जाएगी।"}
          </p>
          <p className="mt-4 rounded-md bg-muted p-4 font-mono text-xl font-bold">
            {created.publicId}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate({ to: "/reports/$id", params: { id: created.id } })}>
              {lang === "en" ? "View status timeline" : "स्थिति देखें"}
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/citizen" })}>
              {t("dashboard")}
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={t("report_issue")}
      description={
        lang === "en"
          ? "Five simple steps. You can save an offline draft at any time."
          : "पाँच आसान चरण। आप कभी भी ऑफलाइन ड्राफ्ट सहेज सकते हैं।"
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <Progress value={(step / 5) * 100} aria-label="Form progress" />
          <p className="mt-2 text-sm text-muted-foreground">
            {lang === "en" ? `Step ${step} of 5` : `चरण ${step} / 5`}
            {savedOffline ? (
              <span className="ml-3 inline-flex items-center gap-1 text-warning-foreground">
                <CloudOff className="size-4" aria-hidden="true" />
                {lang === "en" ? "Saved Offline" : "ऑफलाइन सहेजा गया"}
              </span>
            ) : null}
          </p>
        </div>

        <div className="card-surface p-5 sm:p-6">
          {step === 1 ? (
            <fieldset>
              <legend className="text-lg font-semibold">
                {lang === "en" ? "1. Select category" : "1. श्रेणी चुनें"}
              </legend>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {CATEGORY_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, category_key: key })}
                    aria-pressed={form.category_key === key}
                    className={`rounded-lg border p-4 text-left text-base font-medium transition-colors ${
                      form.category_key === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    {pick(CATEGORY_LABELS[key])}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "2. Describe the issue" : "2. समस्या बताएं"}
              </h2>
              <p className="text-muted-foreground">
                {lang === "en"
                  ? "Write in simple words: what is wrong, since when, and who is affected."
                  : "सरल शब्दों में लिखें: क्या समस्या है, कब से है, और किसे परेशानी है।"}
              </p>
              <div className="space-y-2">
                <Label htmlFor="title">{lang === "en" ? "Title" : "शीर्षक"}</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-12 text-base"
                  placeholder={
                    lang === "en" ? "Garbage not collected in Ward 24" : "वार्ड 24 में कचरा नहीं उठा"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{lang === "en" ? "Description" : "विवरण"}</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="text-base"
                />
              </div>
              <Button type="button" variant="outline" disabled className="w-full sm:w-auto">
                <Mic className="size-4" />
                {lang === "en" ? "Voice note (coming soon)" : "वॉइस नोट (जल्द)"}
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "3. Add evidence" : "3. प्रमाण जोड़ें"}
              </h2>
              <div className="space-y-2">
                <Label htmlFor="photo">
                  {lang === "en" ? "Take or upload a photo / document" : "फोटो या दस्तावेज़ जोड़ें"}
                </Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={pickFile}
                  className="h-12 py-2.5 text-base"
                />
              </div>
              {preview ? (
                <div className="space-y-2">
                  <img
                    src={preview}
                    alt={lang === "en" ? "Selected evidence preview" : "चयनित प्रमाण"}
                    className="max-h-64 w-full rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                  >
                    <Trash2 className="size-4" /> {lang === "en" ? "Remove" : "हटाएँ"}
                  </Button>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Camera className="size-4" aria-hidden="true" />
                  {lang === "en" ? "A photo helps officers act faster." : "फोटो से कार्रवाई तेज होती है।"}
                </p>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "4. Add location" : "4. स्थान जोड़ें"}
              </h2>
              <Button type="button" variant="outline" onClick={useMyLocation}>
                <MapPin className="size-4" />
                {lang === "en" ? "Use my current location" : "मेरा वर्तमान स्थान लें"}
              </Button>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="district-select">{lang === "en" ? "District" : "जिला"}</Label>
                  <Select
                    value={form.district}
                    onValueChange={(v) => setForm({ ...form, district: v })}
                  >
                    <SelectTrigger id="district-select" className="h-12 text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block">
                    {lang === "en" ? "Block / Municipality" : "प्रखंड / नगरपालिका"}
                  </Label>
                  <Input
                    id="block"
                    value={form.block}
                    onChange={(e) => setForm({ ...form, block: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ward">
                    {lang === "en" ? "Village / Ward" : "गाँव / वार्ड"}
                  </Label>
                  <Input
                    id="ward"
                    value={form.village_or_ward}
                    onChange={(e) => setForm({ ...form, village_or_ward: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="latlng">
                    {lang === "en" ? "Map pin (latitude, longitude)" : "मानचित्र बिंदु"}
                  </Label>
                  <Input
                    id="latlng"
                    value={form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : ""}
                    onChange={(e) => {
                      const [la, lo] = e.target.value.split(",").map((s) => s.trim());
                      setForm({ ...form, latitude: la ?? "", longitude: lo ?? "" });
                    }}
                    placeholder="23.36, 85.31"
                    className="h-12 text-base"
                  />
                </div>
              </div>
              {form.latitude && form.longitude ? (
                <div className="rounded-md bg-muted p-4 text-sm">
                  <MapPin className="mr-2 inline size-4 text-primary" aria-hidden="true" />
                  {lang === "en" ? "Map pin set at" : "स्थान चिह्नित"} {form.latitude},{" "}
                  {form.longitude}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {lang === "en" ? "5. Review and submit" : "5. जाँचें और जमा करें"}
              </h2>
              <dl className="grid gap-2 rounded-md bg-muted p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{lang === "en" ? "Category" : "श्रेणी"}</dt>
                  <dd className="font-medium">{pick(CATEGORY_LABELS[form.category_key])}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{lang === "en" ? "Title" : "शीर्षक"}</dt>
                  <dd className="font-medium">{form.title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{lang === "en" ? "Location" : "स्थान"}</dt>
                  <dd className="font-medium">
                    {[form.village_or_ward, form.block, form.district].filter(Boolean).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{lang === "en" ? "Photo" : "फोटो"}</dt>
                  <dd className="font-medium">
                    {file ? file.name : lang === "en" ? "Not added" : "नहीं जोड़ा"}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg border border-accent/40 bg-accent/8 p-4">
                <p className="flex items-center gap-2 font-semibold text-accent">
                  <Sparkles className="size-5" aria-hidden="true" />
                  {lang === "en"
                    ? "AI suggestion — pending human approval"
                    : "एआई सुझाव — अधिकारी की स्वीकृति शेष"}
                </p>
                <ul className="mt-3 grid gap-1 text-sm">
                  <li>
                    {lang === "en" ? "Category" : "श्रेणी"}: <b>{suggestion.category_label}</b>
                  </li>
                  <li>
                    {lang === "en" ? "Suggested priority" : "सुझाई प्राथमिकता"}:{" "}
                    <b>{suggestion.priority}</b>
                  </li>
                  <li>
                    {lang === "en" ? "Possible duplicates" : "संभावित डुप्लिकेट"}:{" "}
                    <b>{suggestion.duplicate_count}</b>
                  </li>
                  <li>
                    {lang === "en" ? "Suggested department" : "सुझाया विभाग"}:{" "}
                    <b>{suggestion.recommended_department}</b>
                  </li>
                  <li>{suggestion.location_relevance}</li>
                  <li>
                    {lang === "en" ? "Next action" : "अगला कदम"}: {suggestion.next_action}
                  </li>
                </ul>
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-md bg-destructive/10 p-3 text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                {t("back")}
              </Button>
            ) : null}
            {step < 5 ? (
              <Button type="button" onClick={goNext}>
                {t("next")}
              </Button>
            ) : (
              <Button type="button" onClick={submitReport} disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("submit")}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={saveDraft}>
              <CloudOff className="size-4" /> {t("save_offline")}
            </Button>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {lang === "en"
            ? "Offline drafts are stored in this browser only (prototype offline support)."
            : "ऑफलाइन ड्राफ्ट केवल इसी ब्राउज़र में सहेजे जाते हैं (प्रोटोटाइप सुविधा)।"}
        </p>
      </div>
    </Page>
  );
}
