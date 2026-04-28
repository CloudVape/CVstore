import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminApi, type EmailLogEntry } from "@/lib/admin-api";
import { AdminShell } from "./admin-shell";
import { Mail, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const TEMPLATES = [
  "welcome",
  "order-confirmation",
  "shipping-update",
  "delivery-confirmation",
  "refund-confirmation",
  "review-request",
  "marketing-broadcast",
  "newsletter-confirm",
];

const STATUSES = ["pending", "sent", "failed", "skipped"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    sent: { label: "Sent", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-green-500/15 text-green-500" },
    failed: { label: "Failed", icon: <XCircle className="h-3 w-3" />, cls: "bg-red-500/15 text-red-500" },
    pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, cls: "bg-yellow-500/15 text-yellow-500" },
    skipped: { label: "Skipped", icon: <AlertCircle className="h-3 w-3" />, cls: "bg-muted text-muted-foreground" },
  };
  const info = map[status] ?? { label: status, icon: null, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${info.cls}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

export default function AdminEmailLog() {
  const { user, getToken } = useAuth();
  const [templateFilter, setTemplateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-email-log", templateFilter, statusFilter],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.listEmailLog(token!, {
        template: templateFilter === "all" ? undefined : templateFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
    },
    enabled: !!user,
  });

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-48 h-8 text-xs font-mono">
                <SelectValue placeholder="All templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs font-mono">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 font-mono text-xs">
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm font-mono">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Mail className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-mono text-sm">No emails logged yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Recipient</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Template</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden md:table-cell">Subject</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden lg:table-cell">From</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: EmailLogEntry) => (
                  <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{entry.recipient}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden sm:table-cell">{entry.template}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground max-w-[200px] truncate hidden md:table-cell" title={entry.subject}>{entry.subject}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden lg:table-cell">
                      {entry.fromAddress ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={entry.status} />
                      {entry.error && (
                        <p className="text-[10px] text-red-400 mt-1 font-mono truncate max-w-[200px]" title={entry.error}>{entry.error}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
                      {new Date(entry.createdAt).toLocaleString()}
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
