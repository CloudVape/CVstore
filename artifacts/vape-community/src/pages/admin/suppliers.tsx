import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { adminApi, type Supplier } from "@/lib/admin-api";
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
import { Plus, Pencil, Trash2, ExternalLink, Upload, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <strong className="font-mono uppercase tracking-wider">Coming soon.</strong>{" "}
        Background sync is not active yet — your schedule preference will be saved on
        the supplier so it's ready when scheduling launches. For now, run imports
        manually from the Import Feed tab.
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

function SupplierForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Supplier;
  onSubmit: (
    body: Pick<Supplier, "name" | "sourceType" | "sourceUrl">,
  ) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sourceType, setSourceType] = useState<Supplier["sourceType"]>(
    initial?.sourceType ?? "csv-upload",
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
        <Label>Feed source</Label>
        <Select
          value={sourceType}
          onValueChange={(v) => setSourceType(v as Supplier["sourceType"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv-upload">CSV file upload</SelectItem>
            <SelectItem value="csv-url">CSV from URL</SelectItem>
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
            placeholder="https://supplier.example.com/feed.csv"
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
    mutationFn: async (body: Pick<Supplier, "name" | "sourceType" | "sourceUrl">) => {
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
                    <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-muted">
                      {s.sourceType === "csv-url" ? "URL" : "Upload"}
                    </span>
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
                    {s.schedule?.enabled ? (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        <Clock className="h-3 w-3" /> auto: {s.schedule.frequency}
                        {(s.schedule.frequency === "daily" ||
                          s.schedule.frequency === "weekly") &&
                        s.schedule.hourOfDay != null
                          ? ` @ ${String(s.schedule.hourOfDay).padStart(2, "0")}:00`
                          : ""}
                        <span className="ml-1 text-muted-foreground normal-case">
                          (pending)
                        </span>
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
                        Set up automatic sync
                      </Button>
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
