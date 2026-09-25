import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALL_SUCCESS_KEY = "eco-bridge-install-success-shown";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function PwaRuntime() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    }

    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return offline ? (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 bg-primary px-4 py-3 text-center text-sm text-primary-foreground shadow-lg">
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>You are offline. Saved information will be available when your connection returns.</span>
    </div>
  ) : null;
}

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem("eco-bridge-install-dismissed") === "true") return;

    const fallbackTimer = window.setTimeout(() => setHelpVisible(true), 1500);
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      window.clearTimeout(fallbackTimer);
      setHelpVisible(false);
      setPromptEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setPromptEvent(null);
      if (localStorage.getItem(INSTALL_SUCCESS_KEY) !== "true") {
        toast.success("ECO-BRIDGE is installed. You can now open it like an app.");
        localStorage.setItem(INSTALL_SUCCESS_KEY, "true");
      }
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (dismissed || isStandalone()) return null;

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "dismissed") {
      sessionStorage.setItem("eco-bridge-install-dismissed", "true");
      setDismissed(true);
    }
  };

  if (!promptEvent) {
    return helpVisible ? (
      <p className="mt-3 max-w-sm text-sm text-primary-foreground/80">
        Open this site in Chrome, then choose ‘Install app’ or ‘Add to Home screen’.
      </p>
    ) : null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" onClick={install}>
        <Download className="size-4" aria-hidden="true" />
        Install ECO-BRIDGE App
      </Button>
    </div>
  );
}