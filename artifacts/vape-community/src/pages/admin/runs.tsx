import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminApi, type ImportRunSummary } from "@/lib/admin-api";
import { AdminShell } from "./admin-shell";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({
  status,
  errored,
}: {
  status: ImportRunSummary["status"];
  errored: number;
}) {
  const label =
    status === "completed" && errored > 0 ? "partial" : status;
  const colors: Record<string, string> = {
    completed: "bg-green-500/15 text-green-600 dark:text-green-400",
    partial: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${colors[label] ?? "bg-muted"}`}
    >
      {label}
    </span>
  );
}

export default function AdminRunsPage() {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["admin", "import-runs"],
    enabled: !!user,
    queryFn: async () => { const token = await getToken(); return adminApi.listRuns(token!); },
  });

  const handleDownloadErrors = async (runId: number) => {
    const token = await getToken();
    if (!token) return;
    setDownloadingId(runId);
    try {
      await adminApi.downloadErrorsCsv(token, runId);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AdminShell>
      <h2 className="text-lg font-mono font-bold uppercase tracking-wider mb-4">
        Recent imports
      </h2>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No import runs yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-mono uppercase text-xs tracking-wider">When</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Supplier</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Run by</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Source</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Status</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider text-right">Total</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider text-right">New</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider text-right">Updated</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider text-right">Skipped</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider text-right">Errors</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 text-xs font-mono whitespace-nowrap">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="p-3">{r.supplierName ?? `#${r.supplierId}`}</td>
                  <td className="p-3 text-xs">
                    {r.triggeredByUsername ?? (
                      <span className="text-muted-foreground italic">system</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {r.source === "csv-url" ? "URL" : "Upload"}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} errored={r.erroredCount} />
                  </td>
                  <td className="p-3 text-right font-mono">{r.totalRows}</td>
                  <td className="p-3 text-right font-mono">{r.createdCount}</td>
                  <td className="p-3 text-right font-mono">{r.updatedCount}</td>
                  <td className="p-3 text-right font-mono">{r.skippedCount}</td>
                  <td className="p-3 text-right font-mono">{r.erroredCount}</td>
                  <td className="p-3 text-right">
                    {r.erroredCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDownloadErrors(r.id)}
                        disabled={downloadingId === r.id}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        <Download className="h-3 w-3" />
                        {downloadingId === r.id ? "..." : "errors"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
