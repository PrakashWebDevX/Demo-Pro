import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Cpu,
  UserCheck,
  Wrench,
  CheckCircle2,
  Lightbulb,
  Pause,
  Play,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface Step {
  key: string;
  icon: typeof Camera;
  en: string;
  hi: string;
  roleEn: string;
  roleHi: string;
  den: string;
  dhi: string;
  pointsEn: string[];
  pointsHi: string[];
}

const STEPS: Step[] = [
  {
    key: "report",
    icon: Camera,
    en: "Citizen reports the issue",
    hi: "नागरिक समस्या दर्ज करता है",
    roleEn: "Citizen",
    roleHi: "नागरिक",
    den: "A photo or short video, the location and a short description — in the citizen's own language.",
    dhi: "फोटो या छोटा वीडियो, स्थान और संक्षिप्त विवरण — नागरिक की अपनी भाषा में।",
    pointsEn: ["Photos and videos", "Location and district", "Six languages supported"],
    pointsHi: ["फोटो और वीडियो", "स्थान और जिला", "छह भाषाओं में उपलब्ध"],
  },
  {
    key: "ai",
    icon: Cpu,
    en: "Automatic analysis and suggestion",
    hi: "स्वचालित विश्लेषण और सुझाव",
    roleEn: "Assistant",
    roleHi: "सहायक",
    den: "The system groups similar reports, judges urgency and suggests the right department and officer — with the reason shown.",
    dhi: "सिस्टम समान शिकायतों को जोड़ता है, गंभीरता आँकता है और सही विभाग व अधिकारी का सुझाव देता है — कारण सहित।",
    pointsEn: ["Similar reports grouped", "Urgency estimated", "Suggested department and officer"],
    pointsHi: ["समान शिकायतें एकत्र", "गंभीरता का अनुमान", "सुझाया गया विभाग और अधिकारी"],
  },
  {
    key: "approve",
    icon: UserCheck,
    en: "Officer reviews and approves",
    hi: "अधिकारी समीक्षा कर स्वीकृति देता है",
    roleEn: "Government officer",
    roleHi: "सरकारी अधिकारी",
    den: "Nothing is assigned automatically. An officer checks the suggestion, can change it, and then confirms.",
    dhi: "कुछ भी स्वतः नहीं सौंपा जाता। अधिकारी सुझाव जाँचता है, बदल सकता है, फिर पुष्टि करता है।",
    pointsEn: ["Suggestion can be changed", "Workload is visible", "Decision is recorded"],
    pointsHi: ["सुझाव बदला जा सकता है", "कार्यभार दिखता है", "निर्णय दर्ज होता है"],
  },
  {
    key: "work",
    icon: Wrench,
    en: "Work on the ground",
    hi: "ज़मीन पर कार्य",
    roleEn: "Department team",
    roleHi: "विभागीय टीम",
    den: "The assigned team inspects, does the work, and posts progress that the citizen can follow.",
    dhi: "नियुक्त टीम निरीक्षण करती है, कार्य करती है और प्रगति साझा करती है जिसे नागरिक देख सकता है।",
    pointsEn: ["Site inspection", "Progress updates", "Citizen gets notified"],
    pointsHi: ["स्थल निरीक्षण", "प्रगति अपडेट", "नागरिक को सूचना"],
  },
  {
    key: "resolved",
    icon: CheckCircle2,
    en: "Resolved and confirmed",
    hi: "समाधान और पुष्टि",
    roleEn: "Citizen and department",
    roleHi: "नागरिक और विभाग",
    den: "Completion photos are added and the citizen confirms the work and gives a rating.",
    dhi: "कार्य पूरा होने की तस्वीरें जोड़ी जाती हैं और नागरिक पुष्टि व रेटिंग देता है।",
    pointsEn: ["Before and after photos", "Citizen confirmation", "Rating and feedback"],
    pointsHi: ["पहले और बाद की तस्वीरें", "नागरिक पुष्टि", "रेटिंग और प्रतिक्रिया"],
  },
  {
    key: "innovation",
    icon: Lightbulb,
    en: "Repeated problems become innovation challenges",
    hi: "बार-बार की समस्याएँ नवाचार चुनौती बनती हैं",
    roleEn: "Innovation cell and partners",
    roleHi: "नवाचार प्रकोष्ठ और साझेदार",
    den: "When the same problem keeps returning, it is opened as a challenge for universities, startups and funding partners.",
    dhi: "जब वही समस्या बार-बार आती है, तो उसे विश्वविद्यालयों, स्टार्टअप और सहयोगियों के लिए चुनौती के रूप में खोला जाता है।",
    pointsEn: ["Partner matching with scores", "Pilot and evaluation", "Public impact page"],
    pointsHi: ["अंक सहित साझेदार चयन", "पायलट और मूल्यांकन", "सार्वजनिक प्रभाव पृष्ठ"],
  },
];

const STEP_MS = 3800;

export function VerticalWorkflowTimeline() {
  const { tr, lang } = useLang();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % STEPS.length),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, [playing, visible]);

  const fillPct = useMemo(
    () => ((active + 1) / STEPS.length) * 100,
    [active],
  );

  return (
    <section
      ref={sectionRef}
      className="card-surface mt-8 overflow-hidden p-6 sm:p-8"
      aria-labelledby="workflow-h"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="workflow-h" className="text-xl font-bold">
            {tr("The complete journey, step by step", "पूरी प्रक्रिया, चरण दर चरण")}
          </h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {tr(
              "From the moment a citizen reports a problem to the moment it is fixed — and what happens when the same problem keeps coming back.",
              "नागरिक द्वारा समस्या दर्ज करने से लेकर समाधान तक — और जब वही समस्या बार-बार आए तो क्या होता है।",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? tr("Pause", "रोकें") : tr("Play", "चलाएँ")}
        </Button>
      </div>

      <ol className="relative mt-8 space-y-4 pl-14 sm:pl-16">
        {/* vertical track */}
        <div
          className="pointer-events-none absolute bottom-3 left-[1.4rem] top-3 w-0.5 rounded-full bg-border sm:left-7"
          aria-hidden="true"
        >
          <div
            className="w-full rounded-full bg-accent transition-[height] duration-700 ease-out"
            style={{ height: visible ? `${fillPct}%` : "0%" }}
          />
        </div>

        {STEPS.map((s, i) => {
          const isActive = i === active;
          const isDone = i < active;
          return (
            <li
              key={s.key}
              className="relative"
              data-step-rise=""
              style={{
                animation: visible
                  ? `step-rise 0.5s ease-out ${i * 90}ms both`
                  : undefined,
              }}
            >
              {/* node */}
              <button
                type="button"
                onClick={() => {
                  setActive(i);
                  setPlaying(false);
                }}
                aria-current={isActive ? "step" : undefined}
                aria-label={tr(s.en, s.hi)}
                className={`absolute -left-14 top-3 flex size-11 items-center justify-center rounded-full border-2 transition-all duration-300 sm:-left-16 ${
                  isActive
                    ? "scale-110 border-accent bg-accent text-accent-foreground shadow-lg"
                    : isDone
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                <s.icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
                {isActive ? (
                  <span
                    className="absolute inset-0 animate-ping rounded-full border-2 border-accent opacity-60"
                    aria-hidden="true"
                  />
                ) : null}
              </button>

              <div
                className={`rounded-lg border p-4 transition-all duration-300 ${
                  isActive
                    ? "border-accent/60 bg-accent/5 shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {tr("Step {n}", "चरण {n}", { n: i + 1 })}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {tr(s.roleEn, s.roleHi)}
                  </span>
                </div>
                <p className="mt-1 text-lg font-semibold">{tr(s.en, s.hi)}</p>

                <div
                  className={`grid transition-all duration-500 ease-out ${
                    isActive
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pt-2 text-muted-foreground">{tr(s.den, s.dhi)}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {(lang === "hi" ? s.pointsHi : s.pointsEn).map((p) => (
                        <li
                          key={p}
                          className="rounded-md border border-accent/30 bg-background px-2.5 py-1 text-sm text-foreground/80"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
