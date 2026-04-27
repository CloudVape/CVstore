import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminApi, type NewsletterSubscriber } from "@/lib/admin-api";
import { AdminShell } from "./admin-shell";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-500/15 text-green-500",
    pending: "bg-yellow-500/15 text-yellow-500",
    unsubscribed: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

export default function AdminSubscribers() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? null;

  const { data: subs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: () => adminApi.listSubscribers(token!),
    enabled: !!token,
  });

  const confirmed = subs.filter((s: NewsletterSubscriber) => s.status === "confirmed").length;
  const pending = subs.filter((s: NewsletterSubscriber) => s.status === "pending").length;
  const unsubscribed = subs.filter((s: NewsletterSubscriber) => s.status === "unsubscribed").length;

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Confirmed", value: confirmed, cls: "text-green-500" },
            { label: "Pending", value: pending, cls: "text-yellow-500" },
            { label: "Unsubscribed", value: unsubscribed, cls: "text-muted-foreground" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-black font-mono mt-1 ${stat.cls}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 font-mono text-xs">
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm font-mono">Loading...</p>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-mono text-sm">No subscribers yet</p>
            <p className="font-mono text-xs mt-1 opacity-60">The footer subscribe form is live — share it!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden md:table-cell">Subscribed</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((sub: NewsletterSubscriber) => (
                  <tr key={sub.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{sub.email}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={sub.status} /></td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground hidden md:table-cell">
                      {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
