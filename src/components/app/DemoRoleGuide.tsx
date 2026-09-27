import { useEffect, useState } from "react";
import { X } from "lucide-react";

export const DEMO_GUIDE_KEY = "eco-demo-guide";
const SHOWN_KEY = "eco-demo-guide-shown";

const GUIDES: Record<string, { title: string; text: string }> = {
  "citizen@demo.jh": { title: "Citizen", text: "Try: Report issue → Track update." },
  "officer@demo.jh": { title: "Officer", text: "Try: Review AI suggestion → Approve action." },
  "university@demo.jh": { title: "University", text: "Try: Open invitation → Add research update." },
  "industry@demo.jh": { title: "Industry", text: "Try: Open invitation → Add prototype update." },
};

export function isDemoGuideEmail(email: string) {
  return email.trim().toLowerCase() in GUIDES;
}

export function DemoRoleGuide() {
  const [guide, setGuide] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    const email = sessionStorage.getItem(DEMO_GUIDE_KEY);
    if (!email || sessionStorage.getItem(SHOWN_KEY)) return;
    const g = GUIDES[email];
    if (g) {
      setGuide(g);
      sessionStorage.setItem(SHOWN_KEY, "1");
    }
  }, []);

  if (!guide) return null;
  return (
    <div
      role="status"
      className="card-surface fixed bottom-4 right-4 z-50 max-w-xs p-4 shadow-lg"
    >
      <button
        type="button"
        aria-label="Dismiss guide"
        onClick={() => setGuide(null)}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <p className="text-xs font-semibold uppercase text-accent">{guide.title} demo guide</p>
      <p className="mt-1 pr-4 text-sm">{guide.text}</p>
    </div>
  );
}
