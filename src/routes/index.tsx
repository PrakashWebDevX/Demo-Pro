import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Cpu,
  HeartHandshake,
  MessageSquare,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import heroImg from "@/assets/hero-citizen.jpg";
import beforeImg from "@/assets/before-waste.jpg";
import afterImg from "@/assets/after-clean.jpg";
import { Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/badges";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS } from "@/lib/constants";
import { VerticalWorkflowTimeline } from "@/components/app/VerticalWorkflowTimeline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eco-Bridge — Report civic issues, track action" },
      {
        name: "description",
        content:
          "Citizens of Jharkhand can report local problems, track government action and follow innovation challenges in one mobile-friendly platform.",
      },
      { property: "og:title", content: "Eco-Bridge" },
      {
        property: "og:description",
        content:
          "Report an issue, track action, and help build a better Jharkhand.",
      },
    ],
  }),
  component: Landing,
});

function useLandingData() {
  return useQuery({
    queryKey: ["landing"],
    queryFn: async () => {
      const [resolved, challenges] = await Promise.all([
        supabase
          .from("reports")
          .select("id, public_issue_id, title, district, category_key, status, resolved_at")
          .eq("status", "resolved")
          .order("resolved_at", { ascending: false })
          .limit(4),
        supabase.from("innovation_projects").select("id, title, district, status"),
      ]);
      return {
        resolved: resolved.data ?? [],
        challenges: challenges.data ?? [],
      };
    },
  });
}

const STEPS = [
  { icon: ClipboardList, en: "Report Issue", hi: "समस्या दर्ज करें" },
  { icon: Cpu, en: "AI Analysis", hi: "एआई विश्लेषण" },
  { icon: UserCheck, en: "Human Approval", hi: "अधिकारी स्वीकृति" },
  { icon: MessageSquare, en: "Solution and Feedback", hi: "समाधान और प्रतिक्रिया" },
];

const ONBOARD = [
  { icon: Smartphone, en: "Report an Issue", hi: "समस्या दर्ज करें", den: "Take a photo, add the location and submit in under a minute.", dhi: "फोटो लें, स्थान जोड़ें और एक मिनट में भेजें।" },
  { icon: BellRing, en: "Track Every Update", hi: "हर अपडेट देखें", den: "Get notified at every step, from review to resolution.", dhi: "समीक्षा से समाधान तक हर चरण की सूचना पाएं।" },
  { icon: HeartHandshake, en: "Help Improve Your Community", hi: "अपने समुदाय को बेहतर बनाएं", den: "Your report helps officers plan real work in your area.", dhi: "आपकी रिपोर्ट से अधिकारी आपके क्षेत्र में काम की योजना बनाते हैं।" },
];

function Landing() {
  const { tr, lang, t, pick } = useLang();
  const { data } = useLandingData();

  return (
    <Page>
      <section className="card-surface overflow-hidden">
        <div className="grid bg-primary text-primary-foreground lg:grid-cols-2">
        <div className="px-6 py-10 sm:px-10 sm:py-14">
          <p className="text-sm font-medium uppercase tracking-wide text-primary-foreground/80">
            Government of Jharkhand · प्रोटोटाइप
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
            {tr("Together, we turn local problems into local solutions.", "मिलकर, हम स्थानीय समस्याओं को स्थानीय समाधान में बदलते हैं।")}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-primary-foreground/90">
            {tr("Report an issue, track action, and help build a better Jharkhand.", "समस्या दर्ज करें, कार्रवाई देखें, और बेहतर झारखंड बनाने में सहयोग करें।")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/report">
                <ClipboardList className="size-5" /> {t("report_issue")}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/reports">
                <Search className="size-5" /> {t("track_my_report")}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/innovation">
                <Users className="size-5" />{" "}
                {tr("Explore Innovation Challenges", "नवाचार चुनौतियाँ देखें")}
              </Link>
            </Button>
          </div>
        </div>
        <div className="relative min-h-64 lg:min-h-full">
          <img
            src={heroImg}
            alt="A woman in Jharkhand photographs a pothole on her street with her smartphone to report it"
            width={1024}
            height={1024}
            fetchPriority="high"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-bold">{tr("How it works", "यह कैसे काम करता है")}</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.en} className="relative rounded-lg border bg-card p-4">
                <div className="flex size-11 items-center justify-center rounded-full border-2 border-accent text-accent">
                  <s.icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-sm font-semibold text-muted-foreground">
                  {tr("Step {n}", "चरण {n}", { n: i + 1 })}
                </p>
                <p className="text-lg font-semibold">{tr(s.en, s.hi)}</p>
                {i < STEPS.length - 1 ? (
                  <ArrowRight className="absolute right-3 top-6 hidden size-4 text-muted-foreground lg:block" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label={tr("Getting started", "शुरुआत")}>
        {ONBOARD.map((o) => (
          <div key={o.en} className="card-surface flex gap-4 p-5 sm:flex-col sm:gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <o.icon className="size-7" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-lg font-semibold">{tr(o.en, o.hi)}</p>
              <p className="mt-1 text-muted-foreground">{tr(o.den, o.dhi)}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-lg border-l-4 border-warning bg-warning/12 p-5">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-6 shrink-0 text-warning-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">
              {tr("Emergency help", "आपातकालीन सहायता")}
            </h2>
            <p className="mt-1 text-foreground/90">
              {tr("For emergencies, contact the appropriate official emergency service. This platform is a civic reporting prototype and does not replace emergency services.", "आपातकाल में कृपया संबंधित आधिकारिक आपातकालीन सेवा से संपर्क करें। यह मंच आपातकालीन सेवाओं का विकल्प नहीं है।")}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
          <p className="mt-2 text-3xl font-bold">{data?.resolved.length ?? 0}+</p>
          <p className="text-muted-foreground">
            {tr("Issues resolved recently", "हाल में हल हुई शिकायतें")}
          </p>
        </div>
        <div className="card-surface p-5">
          <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
          <p className="mt-2 text-3xl font-bold">10</p>
          <p className="text-muted-foreground">
            {tr("Districts in the demo coverage", "डेमो में शामिल जिले")}
          </p>
        </div>
        <div className="card-surface p-5">
          <Users className="size-6 text-accent" aria-hidden="true" />
          <p className="mt-2 text-3xl font-bold">{data?.challenges.length ?? 0}</p>
          <p className="text-muted-foreground">
            {tr("Open innovation challenges", "खुली नवाचार चुनौतियाँ")}
          </p>
        </div>
      </section>

      <section className="card-surface mt-8 p-6" aria-labelledby="impact-h">
        <h2 id="impact-h" className="text-xl font-bold">
          {tr("Impact story: Ranchi waste clean-up", "प्रभाव कहानी: रांची कचरा सफाई")}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {tr("A citizen reported overflowing garbage. The municipal team cleared it and installed a new bin. (Demo illustration)", "एक नागरिक ने कचरे की शिकायत की। नगर टीम ने सफाई कर नया डस्टबिन लगाया। (डेमो चित्र)")}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { src: beforeImg, label: tr("Reported", "दर्ज"), tone: "bg-warning text-warning-foreground", alt: "Before: overflowing garbage bins and bags piled on a street corner" },
            { src: afterImg, label: tr("Resolved", "हल"), tone: "bg-success text-success-foreground", alt: "After: the same kind of street corner swept clean with a new green waste bin" },
          ].map((p) => (
            <figure key={p.label} className="relative overflow-hidden rounded-lg">
              <img src={p.src} alt={p.alt} width={944} height={704} loading="lazy" decoding="async" sizes="(min-width: 640px) 50vw, 100vw" className="aspect-[4/3] w-full object-cover" />
              <figcaption className={`absolute left-3 top-3 rounded-md px-3 py-1 text-sm font-semibold ${p.tone}`}>{p.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">
          {tr("Recently resolved issues", "हाल में हल हुई शिकायतें")}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(data?.resolved ?? []).map((r) => (
            <div key={r.id} className="card-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-muted-foreground">{r.public_issue_id}</span>
                <StatusBadge status={r.status as string} />
              </div>
              <p className="mt-2 font-semibold">{r.title}</p>
              <p className="text-sm text-muted-foreground">
                {pick(CATEGORY_LABELS[r.category_key as string])} · {r.district}
              </p>
            </div>
          ))}
          {(data?.resolved.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">
              {tr("No resolved issues yet.", "अभी कोई हल हुई शिकायत नहीं।")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="card-surface mt-8 p-6">
        <h2 className="text-xl font-bold">
          {tr("Partner collaboration", "साझेदार सहयोग")}
        </h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {tr("Universities, student teams, startups, industries and CSR partners can take up approved innovation challenges — from research and prototype to field pilot and deployment.", "विश्वविद्यालय, छात्र टीमें, स्टार्टअप, उद्योग और सीएसआर साझेदार स्वीकृत नवाचार चुनौतियों पर कार्य कर सकते हैं।")}
        </p>
        <Button asChild className="mt-4">
          <Link to="/innovation">
            {t("innovation")} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="card-surface mt-8 p-6">
        <h2 className="text-xl font-bold">
          {tr("Demo mode for presentation", "प्रस्तुति हेतु डेमो मोड")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {tr("Switch between demo roles instantly on the login page. Each role keeps its own permissions.", "लॉगिन पृष्ठ पर डेमो भूमिकाएँ तुरंत बदलें। हर भूमिका की अपनी अनुमतियाँ हैं।")}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/auth">
            {tr("Open Demo Mode", "डेमो मोड खोलें")} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <VerticalWorkflowTimeline />
    </Page>
  );
}
