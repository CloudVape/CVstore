import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { adminApi, type Supplier, type FeedFormat } from "@/lib/admin-api";
import { AdminShell } from "./admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ExternalLink, Upload, Clock, Play, Pause, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Mirrors the backend scheduler's isDue() logic to compute the next run time.
 * - hourly: lastRunAt + 1h
 * - daily/weekly with hourOfDay: next occurrence of that UTC hour after the
 *   minimum elapsed time (23h / 6.5d) has passed
 * - daily/weekly without hourOfDay: lastRunAt + 24h / 7d
 */
function computeNextRun(
  schedule: NonNullable<Supplier["schedule"]>,
  lastRunAt: string | null,
): Date | null {
  const freq = schedule.frequency;
  if (freq === "manual") return null;

  const now = new Date();

  if (freq === "hourly") {
    if (!lastRunAt) return now;
    const next = new Date(new Date(lastRunAt).getTime() + 60 * 60 * 1000);
    return next < now ? now : next;
  }

  // daily or weekly — backend uses 23h / 6.5d as min elapsed to avoid drift
  const minElapsedMs = freq === "daily" ? 23 * 60 * 60 * 1000 : 6.5 * 24 * 60 * 60 * 1000;
  const nominalMs = freq === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  if (!lastRunAt) {
    if (schedule.hourOfDay !== null && schedule.hourOfDay !== undefined) {
      const candidate = new Date();
      candidate.setUTCHours(schedule.hourOfDay, 0, 0, 0);
      if (candidate <= now) {
        candidate.setUTCDate(candidate.getUTCDate() + (freq === "daily" ? 1 : 7));
      }
      return candidate;
    }
    return now;
  }

  const lastRun = new Date(lastRunAt);
  const eligibleAfter = new Date(lastRun.getTime() + minElapsedMs);

  if (schedule.hourOfDay !== null && schedule.hourOfDay !== undefined) {
    const candidate = new Date(eligibleAfter);
    candidate.setUTCHours(schedule.hourOfDay, 0, 0, 0);
    if (candidate < eligibleAfter) {
      candidate.setUTCDate(candidate.getUTCDate() + (freq === "daily" ? 1 : 7));
    }
    return candidate;
  }

  return new Date(lastRun.getTime() + nominalMs);
}

function formatNextRun(
  schedule: NonNullable<Supplier["schedule"]>,
  lastRunAt: string | null,
): string {
  if (!schedule.enabled) return "Paused";
  if (schedule.frequency === "manual") return "Manual only";
  const next = computeNextRun(schedule, lastRunAt);
  if (!next) return "—";
  if (next <= new Date()) return "Overdue — running soon";
  return `Next: ${next.toLocaleString()}`;
}

function ScheduleForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: Supplier;
  onSubmit: (schedule: Supplier["schedule"]) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const seed = initial.schedule;
  const [enabled, setEnabled] = useState<boolean>(!!seed?.enabled);
  const [frequency, setFrequency] = useState<NonNullable<Supplier["schedule"]>["frequency"]>(
    seed?.frequency ?? "daily",
  );
  const [hourOfDay, setHourOfDay] = useState<number>(seed?.hourOfDay ?? 3);
  const [notes, setNotes] = useState<string>(seed?.notes ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          enabled,
          frequency,
          hourOfDay: frequency === "daily" || frequency === "weekly" ? hourOfDay : null,
          notes: notes.trim() ? notes.trim() : null,
        });
      }}
    >
      <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-400">
        <strong className="font-mono uppercase tracking-wider">Automatic sync is active.</strong>{" "}
        The background scheduler checks for due imports every minute. Only suppliers
        with a CSV URL source and a column mapping will be synced automatically.
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable automatic sync for <span className="font-medium">{initial.name}</span>
      </label>

      <div className="space-y-2">
        <Label>Frequency</Label>
        <Select
          value={frequency}
          onValueChange={(v) => setFrequency(v as typeof frequency)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual only</SelectItem>
            <SelectItem value="hourly">Every hour</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(frequency === "daily" || frequency === "weekly") && (
        <div className="space-y-2">
          <Label htmlFor="sched-hour">Hour of day (0–23, server time)</Label>
          <Input
            id="sched-hour"
            type="number"
            min={0}
            max={23}
            value={hourOfDay}
            onChange={(e) => setHourOfDay(Number(e.target.value))}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sched-notes">Notes (optional)</Label>
        <Input
          id="sched-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. supplier publishes new feed at 2am UTC"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save schedule"}
        </Button>
      </DialogFooter>
    </form>
  );
}

const FEED_FORMAT_LABELS: Record<FeedFormat, string> = {
  csv: "CSV / Excel",
  json: "JSON array",
  xml: "XML feed",
  shopify: "Shopify export",
};

function SupplierForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Supplier;
  onSubmit: (
    body: Pick<Supplier, "name" | "sourceType" | "feedFormat" | "sourceUrl">,
  ) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sourceType, setSourceType] = useState<Supplier["sourceType"]>(
    initial?.sourceType ?? "csv-upload",
  );
  const [feedFormat, setFeedFormat] = useState<FeedFormat>(
    initial?.feedFormat ?? "csv",
  );
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: name.trim(),
          sourceType,
          feedFormat,
          sourceUrl:
            sourceType === "csv-url" && sourceUrl.trim() ? sourceUrl.trim() : null,
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="sup-name">Supplier name</Label>
        <Input
          id="sup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Vape Wholesale"
          required
          minLength={1}
        />
      </div>
      <div className="space-y-2">
        <Label>Feed format</Label>
        <Select
          value={feedFormat}
          onValueChange={(v) => setFeedFormat(v as FeedFormat)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FEED_FORMAT_LABELS) as FeedFormat[]).map((fmt) => (
              <SelectItem key={fmt} value={fmt}>
                {FEED_FORMAT_LABELS[fmt]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Feed delivery</Label>
        <Select
          value={sourceType}
          onValueChange={(v) => setSourceType(v as Supplier["sourceType"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv-upload">File upload</SelectItem>
            <SelectItem value="csv-url">From URL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {sourceType === "csv-url" && (
        <div className="space-y-2">
          <Label htmlFor="sup-url">Feed URL</Label>
          <Input
            id="sup-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://supplier.example.com/feed.json"
          />
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initial ? "Save changes" : "Create supplier"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function AdminSuppliersPage() {
  const { user, getToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [scheduling, setScheduling] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["admin", "suppliers"],
    enabled: !!user,
    queryFn: async () => { const token = await getToken(); return adminApi.listSuppliers(token!); },
  });

  const createMut = useMutation({
    mutationFn: async (body: Pick<Supplier, "name" | "sourceType" | "feedFormat" | "sourceUrl">) => {
      const token = await getToken();
      return adminApi.createSupplier(token!, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      setCreateOpen(false);
      toast({ title: "Supplier created" });
    },
    onError: (err: Error) =>
      toast({ title: "Create failed", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: Partial<Supplier>;
    }) => {
      const token = await getToken();
      return adminApi.updateSupplier(token!, id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      setEditing(null);
      toast({ title: "Supplier updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      return adminApi.deleteSupplier(token!, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast({ title: "Supplier deleted" });
    },
    onError: (err: Error) =>
      toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const resetCooldownMut = useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      return adminApi.resetSupplierAlertCooldown(token!, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      toast({ title: "Alert cooldown reset", description: "The next failure will immediately send an alert." });
    },
    onError: (err: Error) =>
      toast({ title: "Reset failed", description: err.message, variant: "destructive" }),
  });

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-mono font-bold uppercase tracking-wider">
          Suppliers
        </h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create supplier</DialogTitle>
            </DialogHeader>
            <SupplierForm
              onSubmit={(body) => createMut.mutate(body)}
              onCancel={() => setCreateOpen(false)}
              submitting={createMut.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading suppliers…</p>
      ) : suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground mb-4">
            No suppliers yet. Create one to start importing products.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Name</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Source</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Last run</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider">Mapping</th>
                <th className="p-3 font-mono uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-muted">
                      {s.sourceType === "csv-url" ? "URL" : "Upload"}
                    </span>
                    <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {FEED_FORMAT_LABELS[s.feedFormat ?? "csv"]}
                    </span>
                    </div>
                    {s.sourceUrl && (
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> view feed
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {s.lastRunAt
                      ? new Date(s.lastRunAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {Object.keys(s.columnMapping ?? {}).length} fields mapped
                    {s.schedule && s.schedule.frequency !== "manual" ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary">
                          <Clock className="h-3 w-3" /> {s.schedule.frequency}
                          {(s.schedule.frequency === "daily" ||
                            s.schedule.frequency === "weekly") &&
                          s.schedule.hourOfDay != null
                            ? ` @ ${String(s.schedule.hourOfDay).padStart(2, "0")}:00`
                            : ""}
                        </div>
                        <div className={`text-[10px] normal-case ${s.schedule.enabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                          {formatNextRun(s.schedule, s.lastRunAt)}
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link href={`/admin/import?supplierId=${s.id}`}>
                        <Button size="sm" variant="default" className="gap-1">
                          <Upload className="h-3 w-3" />
                          Import
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setScheduling(s)}
                        className="gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        Schedule
                      </Button>
                      {s.schedule && s.schedule.frequency !== "manual" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          title={s.schedule.enabled ? "Pause automatic sync" : "Resume automatic sync"}
                          disabled={updateMut.isPending}
                          onClick={() =>
                            updateMut.mutate({
                              id: s.id,
                              body: {
                                schedule: { ...s.schedule!, enabled: !s.schedule!.enabled },
                              },
                            })
                          }
                        >
                          {s.schedule.enabled ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {s.lastAlertSentAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          title={`Alert cooldown active since ${new Date(s.lastAlertSentAt).toLocaleString()} — click to reset`}
                          disabled={resetCooldownMut.isPending}
                          onClick={() => resetCooldownMut.mutate(s.id)}
                        >
                          <BellOff className="h-3 w-3" />
                          Reset alert
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(s)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete supplier "${s.name}"? Imported products will keep their data but lose the supplier link.`,
                            )
                          ) {
                            deleteMut.mutate(s.id);
                          }
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
          </DialogHeader>
          {editing && (
            <SupplierForm
              initial={editing}
              onSubmit={(body) =>
                updateMut.mutate({ id: editing.id, body })
              }
              onCancel={() => setEditing(null)}
              submitting={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!scheduling}
        onOpenChange={(o) => !o && setScheduling(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up automatic sync</DialogTitle>
          </DialogHeader>
          {scheduling && (
            <ScheduleForm
              initial={scheduling}
              onSubmit={(schedule) =>
                updateMut.mutate({ id: scheduling.id, body: { schedule } })
              }
              onCancel={() => setScheduling(null)}
              submitting={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
