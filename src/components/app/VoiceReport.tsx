import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGE_OPTIONS } from "@/i18n/languages";
import { useLang } from "@/lib/i18n";

/* Minimal typing for the browser Web Speech API (not in TS DOM lib). */
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognizerCtor = new () => Recognizer;

function getRecognizer(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MSG = {
  listening: "Listening… Tap Stop when you finish speaking.",
  unsupported: "Voice reporting is not supported in this browser. Please type your report.",
  denied: "Microphone permission was denied. Please type your report or allow microphone access in browser settings.",
  noSpeech: "No speech was detected. Please try again or type your report.",
  error: "Voice transcription could not be completed. Please try again or type your report.",
  noLocale: "Voice recognition is not configured for this language. Please type your report.",
  stopped: "Recording stopped. Review and edit the text below.",
};

export function VoiceReport({ onUseTranscript }: { onUseTranscript: (text: string) => void }) {
  const { locale } = useLang();
  const [voiceLang, setVoiceLang] = useState<string>(locale);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [status, setStatus] = useState("");
  const recRef = useRef<Recognizer | null>(null);
  const gotSpeech = useRef(false);

  // Feature detection only (no microphone access) after hydration.
  useEffect(() => {
    const ok = !!getRecognizer();
    setSupported(ok);
    if (!ok) setStatus(MSG.unsupported);
  }, []);

  useEffect(() => setVoiceLang(locale), [locale]);

  // Stop on unmount or when leaving the page.
  useEffect(() => {
    const onHide = () => recRef.current?.abort();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const option = LANGUAGE_OPTIONS.find((o) => o.code === voiceLang);

  const start = () => {
    if (recRef.current) return; // prevent multiple sessions
    const Ctor = getRecognizer();
    if (!Ctor) return setStatus(MSG.unsupported);
    if (!option?.speechLocale) return setStatus(MSG.noLocale);
    const rec = new Ctor();
    rec.lang = option.speechLocale;
    rec.continuous = true;
    rec.interimResults = true;
    gotSpeech.current = false;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText.trim()) {
        gotSpeech.current = true;
        setTranscript((t) => (t ? `${t} ${finalText.trim()}` : finalText.trim()));
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setStatus(MSG.denied);
      else if (e.error === "no-speech") setStatus(MSG.noSpeech);
      else if (e.error === "language-not-supported") setStatus(MSG.noLocale);
      else if (e.error !== "aborted") setStatus(MSG.error);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      setStatus((s) => (s === MSG.listening ? (gotSpeech.current ? MSG.stopped : MSG.noSpeech) : s));
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setStatus(MSG.listening);
    } catch {
      recRef.current = null;
      setStatus(MSG.error);
    }
  };

  const stop = () => recRef.current?.stop();

  return (
    <section className="card-surface min-w-0 space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">AI Voice Report</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Voice-to-text demo — no call recording</span>
      </div>
      <p className="text-sm text-muted-foreground">Speak your issue, review the text, and submit your report.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="voice-lang">Voice language</Label>
          <select
            id="voice-lang"
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            disabled={listening}
            className="h-11 w-full rounded-md border bg-background px-2 text-sm text-foreground sm:w-56"
          >
            {LANGUAGE_OPTIONS.filter((o) => o.enabled).map((o) => (
              <option key={o.code} value={o.code}>
                {o.native === o.english ? o.native : `${o.native} — ${o.english}`}
              </option>
            ))}
          </select>
        </div>
        {listening ? (
          <Button type="button" variant="destructive" className="min-h-11 w-full sm:w-auto" onClick={stop}>
            <Square className="size-4" /> Stop Recording
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={start} disabled={supported === false}>
            <Mic className="size-4" /> Start Voice Report
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="voice-transcript">Voice transcript</Label>
        <p className="text-xs text-muted-foreground">Review and edit before submitting.</p>
        <Textarea
          id="voice-transcript"
          rows={4}
          value={interim ? `${transcript} ${interim}`.trim() : transcript}
          onChange={(e) => setTranscript(e.target.value)}
          readOnly={listening}
          className="w-full break-words text-base"
        />
      </div>
      <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={!transcript.trim() || listening} onClick={() => onUseTranscript(transcript.trim())}>
        Use Transcript
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 break-words text-sm font-medium">{status}</p>
      <p className="text-xs text-muted-foreground">Your voice is converted to text in your browser. Review the text before submitting.</p>
    </section>
  );
}
