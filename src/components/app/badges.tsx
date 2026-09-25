import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-secondary text-secondary-foreground",
  under_review: "bg-info/12 text-info",
  approved: "bg-accent/15 text-accent",
  assigned: "bg-accent/15 text-accent",
  in_progress: "bg-warning/18 text-warning-foreground",
  resolved: "bg-success/15 text-success",
  rejected: "bg-destructive/12 text-destructive",
  info_requested: "bg-warning/18 text-warning-foreground",
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-secondary text-secondary-foreground",
  medium: "bg-info/12 text-info",
  high: "bg-warning/20 text-warning-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { pick } = useLang();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium",
        STATUS_STYLE[status] ?? "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {pick(STATUS_LABELS[status]) || status}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const { pick, lang, tr } = useLang();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium",
        PRIORITY_STYLE[priority] ?? "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {pick(PRIORITY_LABELS[priority]) || priority} {tr("priority", "प्राथमिकता")}
    </span>
  );
}
