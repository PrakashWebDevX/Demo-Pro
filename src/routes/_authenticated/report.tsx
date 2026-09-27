import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Video,
  CloudOff,
  Loader2,
  MapPin,
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
import { VoiceReport } from "@/components/app/VoiceReport";
import { CATEGORY_KEYS, CATEGORY_LABELS, DISTRICTS } from "@/lib/constants";
import { analyseReport } from "@/lib/ai-demo";
import { fetchDepartments, uploadReportMedia } from "@/lib/reports";
import { deleteOfflineReport, getOfflineMediaFiles, getOfflineReport, saveOfflineReport } from "@/lib/offline-reports";
import { LanguageSelect } from "@/components/app/LanguageSelect";
import {
  MAX_IMAGES,
  validateImages,
  validateVideo,
  formatBytes,
} from "@/lib/media";

export const Route = createFileRoute("/_authenticated/report")({
  component: ReportIssuePage,
});

const DRAFT_KEY = "jsj_offline_draft";

interface DraftState {
  category_key: string;
  title: string;
  description: string;
  district: string;
  area_type: "urban" | "rural";
  block: string;
  municipality: string;
  village_or_ward: string;
  latitude: string;
  longitude: string;
  location_accuracy_meters: string;
  location_captured_at: string;
  location_text: string;
  location_consent: boolean;
}

const emptyDraft: DraftState = {
  category_key: "",
  title: "",
  description: "",
  district: "Ranchi",
  area_type: "urban",
  block: "",
  municipality: "",
  village_or_ward: "",
  latitude: "",
  longitude: "",
  location_accuracy_meters: "",
  location_captured_at: "",
  location_text: "",
  location_consent: false,
};

function ReportIssuePage() {
  const { user, profile } = useAuth();
  const { tr, lang, pick, t } = useLang();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<DraftState>(emptyDraft);
  const [images, setImages] = useState<Array<{ file: File; url: string }>>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [created, setCreated] = useState<{ id: string; publicId: string } | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [editingOfflineId, setEditingOfflineId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
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
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const offlineId = new URLSearchParams(window.location.search).get("offlineId");
    if (offlineId) {
      void getOfflineReport(offlineId).then((record) => {
        if (!record || record.userId !== user?.id) return;
        setEditingOfflineId(record.offlineLocalId);
        setForm((current) => ({
          ...current,
          category_key: record.payload.category_key,
          title: record.payload.title,
          description: record.payload.description,
          district: record.payload.district,
          area_type: record.payload.area_type,
          block: record.payload.block ?? "",
          municipality: record.payload.municipality ?? "",
          village_or_ward: record.payload.village_or_ward ?? "",
          latitude: record.payload.latitude?.toString() ?? "",
          longitude: record.payload.longitude?.toString() ?? "",
          location_accuracy_meters: record.payload.location_accuracy_meters?.toString() ?? "",
          location_captured_at: record.payload.location_captured_at ?? "",
          location_text: record.payload.location_text,
          location_consent: Boolean(record.payload.latitude && record.payload.longitude),
        }));
        setSavedOffline(true);
        void getOfflineMediaFiles(record.offlineLocalId).then((files) => {
          setImages(files.filter((file) => file.type.startsWith("image/")).map((file) => ({ file, url: URL.createObjectURL(file) })));
          setVideo(files.find((file) => file.type.startsWith("video/")) ?? null);
        });
      });
    }
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user?.id]);

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
      tr("Saved offline on this device. Submit when internet is available.", "इस डिवाइस पर ऑफलाइन सहेजा गया। इंटरनेट आने पर जमा करें।"),
    );
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error(tr("Location is not available", "स्थान उपलब्ध नहीं है"));
      return;
    }
    const confirmed = window.confirm(
      tr(
        "ECO-BRIDGE uses your device location only to route this report to the correct local authority. Continue?",
        "ECO-BRIDGE आपके डिवाइस के स्थान का उपयोग केवल इस शिकायत को सही स्थानीय प्राधिकरण तक भेजने के लिए करता है। जारी रखें?",
      ),
    );
    if (!confirmed) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(5),
          longitude: pos.coords.longitude.toFixed(5),
          location_accuracy_meters: pos.coords.accuracy.toFixed(1),
          location_captured_at: new Date(pos.timestamp).toISOString(),
          location_consent: false,
        }));
        toast.success(tr(`Location added. Estimated accuracy: ${Math.round(pos.coords.accuracy)} metres.`, `स्थान जोड़ा गया। अनुमानित सटीकता: ${Math.round(pos.coords.accuracy)} मीटर।`));
      },
      (positionError) => {
        const message = positionError.code === GeolocationPositionError.PERMISSION_DENIED
          ? tr("Location permission was denied. You can enter the location manually.", "स्थान की अनुमति नहीं मिली। आप स्थान मैन्युअल रूप से दर्ज कर सकते हैं।")
          : positionError.code === GeolocationPositionError.TIMEOUT
            ? tr("Location timed out. Please try again or enter the location manually.", "स्थान प्राप्त करने में समय समाप्त हो गया। फिर प्रयास करें या स्थान मैन्युअल रूप से दर्ज करें।")
            : tr("Location is unavailable. You can enter the location manually.", "स्थान उपलब्ध नहीं है। आप स्थान मैन्युअल रूप से दर्ज कर सकते हैं।");
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function accuracyLabel() {
    const accuracy = Number(form.location_accuracy_meters);
    if (!Number.isFinite(accuracy)) return "";
    if (accuracy <= 50) return tr("High accuracy location", "उच्च सटीकता वाला स्थान");
    if (accuracy <= 200) return tr("Approximate location — please confirm", "अनुमानित स्थान — कृपया पुष्टि करें");
    return tr("Low accuracy — move outdoors, enable GPS, or use manual location", "कम सटीकता — बाहर जाएँ, GPS चालू करें या स्थान मैन्युअल रूप से दर्ज करें");
  }

  function pickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const err = validateImages(picked, images.length);
    if (err) {
      setMediaError(tr(err));
      return;
    }
    setMediaError(null);
    setImages((prev) => [...prev, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function pickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;
    const err = validateVideo(f);
    if (err) {
      setMediaError(tr(err));
      return;
    }
    setMediaError(null);
    setVideo(f);
  }

  function validateStep(n: number): string | null {
    if (n === 1 && !form.category_key) {
      return tr("Please select a category.", "कृपया श्रेणी चुनें।");
    }
    if (n === 2) {
      if (form.title.trim().length < 5)
        return tr("Title must be at least 5 characters.", "शीर्षक कम से कम 5 अक्षर।");
      if (form.description.trim().length < 15)
        return tr("Please describe the issue in at least 15 characters.", "कृपया कम से कम 15 अक्षरों में विवरण दें।");
    }
    if (n === 4 && !form.district) {
      return tr("Please select a district.", "कृपया जिला चुनें।");
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

    const payload = {
      reporter_name: profile?.full_name ?? null,
      title: form.title.trim(),
      description: form.description.trim(),
      category_key: form.category_key,
      district: form.district,
      area_type: form.area_type,
      block: form.block || null,
      municipality: form.municipality || null,
      village_or_ward: form.location_text || form.village_or_ward || null,
      location_text: form.location_text,
      latitude: form.location_consent && form.latitude ? Number(form.latitude) : null,
      longitude: form.location_consent && form.longitude ? Number(form.longitude) : null,
      location_accuracy_meters: form.location_consent && form.location_accuracy_meters ? Number(form.location_accuracy_meters) : null,
      location_captured_at: form.location_consent ? form.location_captured_at || null : null,
      priority: suggestion.priority,
      ai_category: suggestion.category_label,
      ai_priority: suggestion.priority,
      ai_duplicate_count: suggestion.duplicate_count,
      ai_recommended_department: suggestion.recommended_department,
      ai_next_action: suggestion.next_action,
      is_innovation: suggestion.is_innovation,
      language: lang,
    };

    if (!online) {
      if (editingOfflineId) await deleteOfflineReport(editingOfflineId);
      await saveOfflineReport({
        userId: user.id,
        payload,
        images: images.map((image) => image.file),
        video,
      });
      window.localStorage.removeItem(DRAFT_KEY);
      setSubmitting(false);
      setQueuedOffline(true);
      return;
    }

    const offlineLocalId = crypto.randomUUID();
    const { location_text: _locationText, language: _language, ...cloudPayload } = payload;
    const { data, error: insertError } = await (supabase.from("reports") as any)
      .insert({
        client_submission_id: offlineLocalId,
        citizen_id: user.id,
        ...cloudPayload,
        status: "submitted",
        public_issue_id: "",
      })
      .select("id, public_issue_id")
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError(insertError?.message ?? tr("Could not submit the report."));
      return;
    }

    const files = [...images.map((i) => i.file), ...(video ? [video] : [])];
    if (files.length > 0) {
      const { failed } = await uploadReportMedia(user.id, data.id, files);
      if (failed > 0) toast.warning(tr("Some media could not be uploaded, but your report was saved."));
    }

    window.localStorage.removeItem(DRAFT_KEY);
    setSubmitting(false);
    setCreated({ id: data.id, publicId: data.public_issue_id as string });
    setStep(6);
  }

  if (queuedOffline) {
    return (
      <Page title={tr("Report saved on this device", "शिकायत इस डिवाइस पर सहेजी गई")}>
        <div className="card-surface mx-auto max-w-xl p-6 text-center">
          <CloudOff className="mx-auto size-14 text-warning-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">
            {tr("Report saved on this device. It will be sent automatically when internet returns.", "शिकायत इस डिवाइस पर सहेजी गई है। इंटरनेट आने पर यह अपने आप भेजी जाएगी।")}
          </p>
          <Button className="mt-6" onClick={() => navigate({ to: "/offline-reports" })}>
            {tr("View Saved Offline Reports")}
          </Button>
        </div>
      </Page>
    );
  }

  if (created) {
    return (
      <Page title={tr("Report submitted", "शिकायत दर्ज हो गई")}>
        <div className="card-surface mx-auto max-w-xl p-6 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold">
            {tr("Thank you", "धन्यवाद")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {tr("Your issue will be reviewed by the concerned team.", "आपकी शिकायत संबंधित टीम द्वारा देखी जाएगी।")}
          </p>
          <p className="mt-4 rounded-md bg-muted p-4 font-mono text-xl font-bold">
            {created.publicId}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate({ to: "/reports/$id", params: { id: created.id } })}>
              {tr("View status timeline", "स्थिति देखें")}
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
      actions={<LanguageSelect id="report-lang" />}
      description={
        tr("Five simple steps. You can save an offline draft at any time.", "पाँच आसान चरण। आप कभी भी ऑफलाइन ड्राफ्ट सहेज सकते हैं।")
      }
    >
      <div className="mx-auto max-w-2xl">
        <div className="card-surface mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">
              {tr("Prefer to speak?", "बोलकर बताना चाहते हैं?")}{" "}
              <span className="ml-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                {tr("Demo voice assistant", "डेमो वॉइस सहायक")}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {tr("Report your issue using the AI Voice Assistant.", "एआई वॉइस सहायक से अपनी समस्या दर्ज करें।")}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("eco-open-phone-assistant"))}>
            {tr("Start Voice Report", "वॉइस रिपोर्ट शुरू करें")}
          </Button>
        </div>
        <div className="mb-4">
          <Progress value={(step / 5) * 100} aria-label="Form progress" />
          <p className="mt-2 text-sm text-muted-foreground">
            {tr("Step {n} of 5", "चरण {n} / 5", { n: step })}
            {savedOffline ? (
              <span className="ml-3 inline-flex items-center gap-1 text-warning-foreground">
                <CloudOff className="size-4" aria-hidden="true" />
                {tr("Saved Offline", "ऑफलाइन सहेजा गया")}
              </span>
            ) : null}
          </p>
        </div>

        <div className="card-surface p-5 sm:p-6">
          {step === 1 ? (
            <fieldset>
              <legend className="text-lg font-semibold">
                {tr("1. Select category", "1. श्रेणी चुनें")}
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
                {tr("2. Describe the issue", "2. समस्या बताएं")}
              </h2>
              <p className="text-muted-foreground">
                {tr("Write in simple words: what is wrong, since when, and who is affected.", "सरल शब्दों में लिखें: क्या समस्या है, कब से है, और किसे परेशानी है।")}
              </p>
              <div className="space-y-2">
                <Label htmlFor="title">{tr("Title", "शीर्षक")}</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-12 text-base"
                  placeholder={
                    tr("Garbage not collected in Ward 24", "वार्ड 24 में कचरा नहीं उठा")
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{tr("Description", "विवरण")}</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="text-base"
                />
              </div>
              <VoiceReport
                onUseTranscript={(text) =>
                  setForm((f) => ({ ...f, description: f.description ? `${f.description}\n${text}` : text }))
                }
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {tr("3. Add evidence", "3. प्रमाण जोड़ें")}
              </h2>
              <div className="space-y-2">
                <Label htmlFor="photos">{tr("Add photos (1 to 5)")}</Label>
                <p className="text-sm text-muted-foreground">
                  {tr("JPG, JPEG, PNG or WEBP. Maximum 5 MB each.")}
                </p>
                {images.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map((img, i) => (
                      <li key={img.url} className="relative overflow-hidden rounded-md border">
                        <img
                          src={img.url}
                          alt={tr("Selected photo {n}", undefined, { n: i + 1 })}
                          className="aspect-square w-full object-cover"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          onClick={() => removeImage(i)}
                          aria-label={tr("Remove photo {n}", undefined, { n: i + 1 })}
                          className="absolute right-1 top-1 size-9"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {images.length < MAX_IMAGES ? (
                  <label
                    htmlFor="photos"
                    className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-base font-medium hover:bg-muted"
                  >
                    <ImagePlus className="size-5" aria-hidden="true" />
                    {images.length === 0 ? tr("Choose photos") : tr("Add more photos")}
                  </label>
                ) : null}
                <input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={pickImages}
                  className="sr-only"
                />
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {images.length > 0
                    ? tr("{n} of 5 photos selected", undefined, { n: images.length })
                    : null}
                </p>
                {images.length === 0 ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Camera className="size-4" aria-hidden="true" />
                    {tr("A photo helps officers act faster.", "फोटो से कार्रवाई तेज होती है।")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="video">{tr("Add a short video (optional)")}</Label>
                <p className="text-sm text-muted-foreground">
                  {tr("Optional: upload a short video only if it helps explain the issue.")}{" "}
                  {tr("MP4, MOV or WEBM. Maximum 20 MB.")}
                </p>
                {video ? (
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <Video className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{video.name}</p>
                      <p className="text-sm text-muted-foreground">{formatBytes(video.size)}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setVideo(null)}>
                      <Trash2 className="size-4" /> {tr("Remove video")}
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="video"
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                    onChange={pickVideo}
                    className="h-12 py-2.5 text-base"
                  />
                )}
              </div>

              {mediaError ? (
                <p role="alert" className="rounded-md bg-destructive/10 p-3 text-destructive">
                  {mediaError}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {tr("4. Add location", "4. स्थान जोड़ें")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tr("ECO-BRIDGE uses your device location only to route this report to the correct local authority.", "ECO-BRIDGE आपके डिवाइस के स्थान का उपयोग केवल इस शिकायत को सही स्थानीय प्राधिकरण तक भेजने के लिए करता है।")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={useMyLocation}>
                  <MapPin className="size-4" />
                  {tr("Use my current location", "मेरा वर्तमान स्थान लें")}
                </Button>
                <Button type="button" variant="outline" disabled title={tr("Map selection will be available in a future update.")}>
                  <MapPin className="size-4" />
                  {tr("Choose on map")}
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-text">{tr("Enter location manually", "स्थान मैन्युअल रूप से दर्ज करें")}</Label>
                <Input
                  id="location-text"
                  value={form.location_text}
                  onChange={(e) => setForm({ ...form, location_text: e.target.value })}
                  placeholder={tr("Landmark, street, or nearby place")}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>{tr("Area type")}</Label>
                <div className="flex gap-2">
                  {(["urban", "rural"] as const).map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant={form.area_type === v ? "default" : "outline"}
                      className="h-12 flex-1 text-base"
                      onClick={() => setForm({ ...form, area_type: v })}
                    >
                      {v === "urban" ? tr("Urban (city / town)") : tr("Rural (village)")}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="district-select">{tr("District", "जिला")}</Label>
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
                    {tr("Block / Municipality", "प्रखंड / नगरपालिका")}
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
                    {tr("Village / Ward", "गाँव / वार्ड")}
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
                    {tr("Map pin (latitude, longitude)", "मानचित्र बिंदु")}
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
                  {tr("Map pin set at", "स्थान चिह्नित")} {form.latitude},{" "}
                  {form.longitude}
                  {form.location_accuracy_meters ? (
                    <>
                      <span className="mx-2">·</span>
                      {tr("Estimated accuracy", "अनुमानित सटीकता")} {Math.round(Number(form.location_accuracy_meters))} m
                      <p className="mt-2 font-medium">{accuracyLabel()}</p>
                    </>
                  ) : null}
                </div>
              ) : null}
              {form.latitude && form.longitude ? (
                <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.location_consent}
                    onChange={(e) => setForm({ ...form, location_consent: e.target.checked })}
                    className="mt-1 size-4"
                  />
                  <span>{tr("I agree to share this issue location for report processing.", "मैं रिपोर्ट प्रक्रिया के लिए इस शिकायत का स्थान साझा करने की सहमति देता/देती हूँ।")}</span>
                </label>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {tr("5. Review and submit", "5. जाँचें और जमा करें")}
              </h2>
              <dl className="grid gap-2 rounded-md bg-muted p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{tr("Category", "श्रेणी")}</dt>
                  <dd className="font-medium">{pick(CATEGORY_LABELS[form.category_key])}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{tr("Title", "शीर्षक")}</dt>
                  <dd className="font-medium">{form.title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{tr("Location", "स्थान")}</dt>
                  <dd className="font-medium">
                    {[form.village_or_ward, form.block, form.district].filter(Boolean).join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{tr("Photos", "फोटो")}</dt>
                  <dd className="font-medium">
                    {images.length > 0 ? images.length : tr("Not added", "नहीं जोड़ा")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{tr("Video")}</dt>
                  <dd className="truncate font-medium">
                    {video ? video.name : tr("Not added", "नहीं जोड़ा")}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg border border-accent/40 bg-accent/8 p-4">
                <p className="flex items-center gap-2 font-semibold text-accent">
                  <Sparkles className="size-5" aria-hidden="true" />
                  {tr("AI suggestion — pending human approval", "एआई सुझाव — अधिकारी की स्वीकृति शेष")}
                </p>
                <ul className="mt-3 grid gap-1 text-sm">
                  <li>
                    {tr("Category", "श्रेणी")}: <b>{suggestion.category_label}</b>
                  </li>
                  <li>
                    {tr("Suggested priority", "सुझाई प्राथमिकता")}:{" "}
                    <b>{suggestion.priority}</b>
                  </li>
                  <li>
                    {tr("Possible duplicates", "संभावित डुप्लिकेट")}:{" "}
                    <b>{suggestion.duplicate_count}</b>
                  </li>
                  <li>
                    {tr("Suggested department", "सुझाया विभाग")}:{" "}
                    <b>{suggestion.recommended_department}</b>
                  </li>
                  <li>{suggestion.location_relevance}</li>
                  <li>
                    {tr("Next action", "अगला कदम")}: {suggestion.next_action}
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
          {tr("Offline drafts are stored in this browser only (prototype offline support).", "ऑफलाइन ड्राफ्ट केवल इसी ब्राउज़र में सहेजे जाते हैं (प्रोटोटाइप सुविधा)।")}
        </p>
      </div>
    </Page>
  );
}
