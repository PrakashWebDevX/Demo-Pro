import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, MessageCircle, Smartphone } from "lucide-react";
import { EmptyState, Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

interface NotificationRow {
  id: string;
  report_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

function NotificationsPage() {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: Boolean(user?.id),
  });

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    await queryClient.invalidateQueries({ queryKey: ["unread"] });
  }

  return (
    <Page
      title={t("notifications")}
      description={
        lang === "en" ? "Updates about your reports." : "आपकी शिकायतों से जुड़ी सूचनाएँ।"
      }
      actions={
        items.some((i) => !i.read) ? (
          <Button variant="outline" onClick={markAllRead}>
            {lang === "en" ? "Mark all as read" : "सभी पढ़ा हुआ चिह्नित करें"}
          </Button>
        ) : null
      }
    >
      <div className="grid gap-3">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && items.length === 0 ? (
          <EmptyState
            title={lang === "en" ? "No notifications yet" : "अभी कोई सूचना नहीं"}
            hint={
              lang === "en"
                ? "You will be notified when your report status changes."
                : "स्थिति बदलने पर आपको सूचना मिलेगी।"
            }
          />
        ) : null}
        {items.map((n) => (
          <div
            key={n.id}
            className={`card-surface p-4 ${n.read ? "" : "border-l-4 border-l-accent"}`}
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </p>
                {n.report_id ? (
                  <Button asChild variant="link" className="h-auto px-0">
                    <Link to="/reports/$id" params={{ id: n.report_id }}>
                      {lang === "en" ? "Open report" : "शिकायत खोलें"}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-surface mt-6 flex flex-wrap gap-4 p-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Smartphone className="size-4" aria-hidden="true" /> SMS integration ready
        </span>
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp integration ready
        </span>
        <span>
          {lang === "en"
            ? "(No real messages are sent in this prototype.)"
            : "(इस प्रोटोटाइप में वास्तविक संदेश नहीं भेजे जाते।)"}
        </span>
      </div>
    </Page>
  );
}
