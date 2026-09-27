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

export function VoiceReport({ onUseTranscript }: { onUseTranscript: (text: string) => void }) {
  const { locale } = useLang();
  const [voiceLang, setVoiceLang] = useState<string>(locale);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [status, setStatus] = useState("");
  const recRef = useRef<Recognizer | null>(null);
  const gotSpeech = useRef(false);

  useEffect(() => () => recRef.current?.abort(), []);

  const option = LANGUAGE_OPTIONS.find((o) => o.code === voiceLang);

  const start = () => {
    const Ctor = getRecognizer();
    if (!Ctor) {
      setStatus("Voice reporting is not supported in this browser. Please type your report.");
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = option?.speechLocale ?? "en-IN";
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
      if (finalText) {
        gotSpeech.current = true;
        setTranscript((t) => (t ? `${t} ${finalText.trim()}` : finalText.trim()));
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setStatus("Microphone permission was denied. You can type your report instead.");
      } else if (e.error === "no-speech") {
        setStatus("No speech was detected. Please try again or type your report.");
      } else if (e.error !== "aborted") {
        setStatus("Voice transcription could not be completed. Please try again or type your report.");
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      setStatus((s) => (s.startsWith("Listening") ? (gotSpeech.current ? "Recording stopped. Review the text below." : "No speech was detected. Please try again or type your report.") : s));
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setStatus("Listening… Tap Stop when finished.");
    } catch {
      setStatus("Voice transcription could not be completed. Please try again or type your report.");
    }
  };

  const stop = () => recRef.current?.stop();

  return (
    <section className="card-surface space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Report by Voice</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Voice-to-text demo</span>
      </div>
      <p className="text-sm text-muted-foreground">Select a language, speak your issue, review the text, then submit your report.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="voice-lang">Voice language</Label>
          <select
            id="voice-lang"
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            disabled={listening}
            className="h-11 w-full rounded-md border bg-background px-2 text-sm text-foreground sm:w-56"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.native === o.english ? o.native : `${o.native} — ${o.english}`}
              </option>
            ))}
          </select>
        </div>
        {listening ? (
          <Button type="button" variant="destructive" className="min-h-11" onClick={stop}>
            <Square className="size-4" /> Stop Recording
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11" onClick={start}>
            <Mic className="size-4" /> Start Voice Report
          </Button>
        )}
      </div>
      {option && option.code !== locale ? (
        <p className="text-xs text-muted-foreground">Voice input language selected. App interface language remains unchanged.</p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="voice-transcript">Transcript</Label>
        <Textarea
          id="voice-transcript"
          rows={4}
          value={interim ? `${transcript} ${interim}`.trim() : transcript}
          onChange={(e) => setTranscript(e.target.value)}
          readOnly={listening}
          className="break-words text-base"
        />
      </div>
      <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={!transcript.trim() || listening} onClick={() => onUseTranscript(transcript.trim())}>
        Use Transcript
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium">{status}</p>
      <p className="text-xs text-muted-foreground">Your spoken words are converted to text for this report. Review before submitting.</p>
    </section>
  );
}
