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

type TriggerFilter = "all" | "scheduled" | "manual";

export default function AdminRunsPage() {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState<number | "all">("all");

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["admin", "import-runs"],
    enabled: !!user,
    queryFn: async () => { const token = await getToken(); return adminApi.listRuns(token!); },
  });

  const suppliers = Array.from(
    new Map(runs.map((r) => [r.supplierId, r.supplierName ?? `#${r.supplierId}`])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredRuns = runs.filter((r) => {
    if (triggerFilter === "scheduled" && r.triggeredByUserId !== null) return false;
    if (triggerFilter === "manual" && r.triggeredByUserId === null) return false;
    if (supplierFilter !== "all" && r.supplierId !== supplierFilter) return false;
    return true;
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

  const filterOptions: { value: TriggerFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "manual", label: "Manual only" },
    { value: "scheduled", label: "Scheduled only" },
  ];

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-mono font-bold uppercase tracking-wider">
          Recent imports
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {suppliers.length > 0 && (
            <select
              value={supplierFilter === "all" ? "all" : String(supplierFilter)}
              onChange={(e) =>
                setSupplierFilter(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="h-7 rounded-md border border-border bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All suppliers</option>
              {suppliers.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTriggerFilter(opt.value)}
                className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                  triggerFilter === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filteredRuns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          {runs.length === 0 ? "No import runs yet." : "No runs match the selected filter."}
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
              {filteredRuns.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 text-xs font-mono whitespace-nowrap">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="p-3">{r.supplierName ?? `#${r.supplierId}`}</td>
                  <td className="p-3 text-xs">
                    {r.triggeredByUserId === null ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-violet-500/15 text-violet-600 dark:text-violet-400">
                        Scheduled
                      </span>
                    ) : (
                      r.triggeredByUsername ?? <span className="text-muted-foreground italic">unknown</span>
                    )}
                  </td>
                  <td className="p-3 text-xs font-mono uppercase tracking-wider">
                    {r.source.endsWith("-url") ? "URL" : "Upload"}
                    {" · "}
                    {r.source.split("-")[0] ?? "csv"}
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
