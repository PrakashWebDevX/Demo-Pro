import { useAuth } from "@/lib/auth";

/** Development-only session info. Never shows or exports the token itself. */
export function DevAuthPanel() {
  const { user, role, session } = useAuth();
  if (!import.meta.env.DEV) return null;
  const expires = session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "—";
  return (
    <div className="fixed bottom-4 left-4 z-40 hidden rounded-md border bg-card p-3 text-xs shadow-md md:block">
      <p className="font-semibold">Dev session panel</p>
      <p>Authenticated: {user ? "Yes" : "No"}</p>
      <p>Role: {role ?? "—"}</p>
      <p>Token expires: {expires}</p>
    </div>
  );
}
