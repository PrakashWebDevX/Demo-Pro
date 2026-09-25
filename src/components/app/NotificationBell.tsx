import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Row {
  id: string;
  report_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["bell", user?.id];

  const { data: items = [] } = useQuery({
    queryKey: key,
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, report_id, title, message, read, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Row;
          toast(n.title, { description: n.message });
          queryClient.invalidateQueries({ queryKey: ["bell"] });
          queryClient.invalidateQueries({ queryKey: ["unread"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    queryClient.invalidateQueries({ queryKey: ["bell"] });
    queryClient.invalidateQueries({ queryKey: ["unread"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-primary-foreground hover:bg-primary-foreground/10"
          aria-label={`Notifications, ${unread} unread`}
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-warning px-1 text-xs font-bold text-warning-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button variant="link" size="sm" className="h-auto min-h-0 px-0" onClick={markAllRead}>
              Mark all as read
            </Button>
          ) : null}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No notifications yet.</li>
          ) : null}
          {items.map((n) => (
            <li key={n.id} className={`border-b p-3 text-sm ${n.read ? "" : "bg-muted"}`}>
              <p className="font-medium">{n.title}</p>
              <p className="text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
        <div className="p-2">
          <Button asChild variant="outline" className="w-full">
            <Link to="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
