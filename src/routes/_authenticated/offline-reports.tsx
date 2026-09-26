import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, CloudOff, Edit3, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import {
  deleteOfflineReport,
  getOfflineReport,
  listOfflineReports,
  retryOfflineReport,
  syncOfflineReports,
  type OfflineReportRecord,
} from "@/lib/offline-reports";

export const Route = createFileRoute("/_authenticated/offline-reports")({
  component: OfflineReportsPage,
});

function stateLabel(record: OfflineReportRecord) {
  if (record.syncState === "pending") return "Pending";
  if (record.syncState === "syncing") return "Syncing";
  if (record.syncState === "sent") return "Sent";
  return "Needs Attention";
}

function OfflineReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { tr } = useLang();
  const [records, setRecords] = useState<OfflineReportRecord[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (user) setRecords(await listOfflineReports(user.id));
  }

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  async function syncNow() {
    if (!user) return;
    setBusy(true);
    try {
      const results = await syncOfflineReports(user.id);
      await refresh();
      if (results.some((record) => record.syncState === "sent")) {
        await queryClient.invalidateQueries({ queryKey: ["my-reports", user.id] });
        toast.success(tr("Saved offline reports synced successfully."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setBusy(true);
    await retryOfflineReport(id);
    await refresh();
    setBusy(false);
  }

  async function remove(id: string) {
    await deleteOfflineReport(id);
    await refresh();
    toast.success(tr("Offline report removed."));
  }

  return (
    <Page
      title={tr("Saved Offline Reports", "ऑफलाइन सहेजी गई शिकायतें")}
      description={tr("Reports saved on this device are kept private until they sync.")}
      actions={
        <Button type="button" onClick={syncNow} disabled={busy || !navigator.onLine}>
          <RefreshCw className="size-4" /> {tr("Sync Now")}
        </Button>
      }
    >
      <div className="grid gap-3">
        {records.map((record) => (
          <article key={record.offlineLocalId} className="card-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{record.payload.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {record.payload.district} · {record.mediaCount} media · {new Date(record.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm font-medium">
                {record.syncState === "sent" ? <Cloud className="size-4 text-success" /> : <CloudOff className="size-4 text-warning-foreground" />}
                {stateLabel(record)}
              </span>
            </div>
            {record.error ? <p className="mt-3 text-sm text-destructive">{record.error}</p> : null}
            {record.publicIssueId ? <p className="mt-2 font-mono text-sm">{record.publicIssueId}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {record.syncState !== "sent" ? (
                <>
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link to="/report" search={{ offlineId: record.offlineLocalId }}>
                      <Edit3 className="size-4" /> {tr("Edit")}
                    </Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => retry(record.offlineLocalId)} disabled={busy || !navigator.onLine}>
                    <RefreshCw className="size-4" /> {tr("Retry")}
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={() => remove(record.offlineLocalId)}>
                <Trash2 className="size-4" /> {tr("Delete")}
              </Button>
            </div>
          </article>
        ))}
        {records.length === 0 ? <p className="text-muted-foreground">{tr("No saved offline reports.")}</p> : null}
      </div>
    </Page>
  );
}
