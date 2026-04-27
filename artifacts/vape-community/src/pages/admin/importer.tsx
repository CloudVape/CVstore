import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  adminApi,
  type PreviewResponse,
  type RunResult,
  type Supplier,
} from "@/lib/admin-api";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  Eye,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";

const UNMAPPED = "__unmapped__";

function autoMap(
  headers: string[],
  importable: { key: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const used = new Set<string>();
  for (const f of importable) {
    const target = norm(f.key);
    const match = headers.find((h) => {
      if (used.has(h)) return false;
      const n = norm(h);
      return (
        n === target ||
        n === target.replace(/cents$/, "") ||
        n === target.replace(/cents$/, "price") ||
        (target === "externalsku" && (n === "sku" || n === "id" || n === "productid")) ||
        (target === "categoryslug" && n === "category") ||
        (target === "imageurl" && (n === "image" || n === "imageurl" || n === "img")) ||
        (target === "stockcount" && (n === "stock" || n === "qty" || n === "quantity" || n === "inventory")) ||
        (target === "pricecents" && n === "price") ||
        (target === "comparepricecents" && (n === "compareprice" || n === "msrp" || n === "rrp")) ||
        (target === "shortdescription" && (n === "shortdescription" || n === "subtitle" || n === "tagline")) ||
        (target === "nicotinestrength" && (n === "nicotine" || n === "nic")) ||
        (target === "vgpgratio" && (n === "vgpg" || n === "ratio"))
      );
    });
    if (match) {
      map[f.key] = match;
      used.add(match);
    }
  }
  return map;
}

export default function AdminImporterPage() {
  const { user, getToken } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initialSupplierId = useMemo(() => {
    const params = new URLSearchParams(search);
    const id = Number(params.get("supplierId"));
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [search]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin", "suppliers"],
    enabled: isAdmin,
    queryFn: async () => { const token = await getToken(); return adminApi.listSuppliers(token!); },
  });

  const [supplierId, setSupplierId] = useState<number | null>(initialSupplierId);
  useEffect(() => {
    if (initialSupplierId && initialSupplierId !== supplierId) {
      setSupplierId(initialSupplierId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSupplierId]);

  const supplier: Supplier | undefined = suppliers.find((s) => s.id === supplierId);

  const [tab, setTab] = useState<"upload" | "url">("upload");
  useEffect(() => {
    if (supplier) setTab(supplier.sourceType === "csv-url" ? "url" : "upload");
  }, [supplier]);

  const [feedFile, setFeedFile] = useState<File | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  useEffect(() => {
    if (supplier?.sourceUrl) setFeedUrl(supplier.sourceUrl);
  }, [supplier]);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saveMapping, setSaveMapping] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedFile(file);
  }

  function fileContentType(file: File): string {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (name.endsWith(".xls")) return "application/vnd.ms-excel";
    return file.type || "text/csv";
  }

  async function handlePreview() {
    const token = await getToken();
    if (!token) return;
    setPreviewing(true);
    setPreview(null);
    setLastResult(null);
    try {
      const result =
        tab === "upload"
          ? await adminApi.previewFile(token, feedFile!, fileContentType(feedFile!))
          : await adminApi.previewUrl(token, feedUrl);
      setPreview(result);
      const seed = supplier?.columnMapping && Object.keys(supplier.columnMapping).length > 0
        ? supplier.columnMapping
        : autoMap(result.headers, result.importableFields);
      setMapping(seed);
    } catch (err) {
      toast({
        title: "Preview failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleRun() {
    if (!supplierId || !preview) return;
    const token = await getToken();
    if (!token) return;

    const required = preview.importableFields.filter((f) => f.required);
    const missing = required.filter((f) => !mapping[f.key] || mapping[f.key] === UNMAPPED);
    if (missing.length > 0) {
      toast({
        title: "Required mapping missing",
        description: `Map: ${missing.map((m) => m.key).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const cleanMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(mapping)) {
      if (v && v !== UNMAPPED) cleanMapping[k] = v;
    }

    setRunning(true);
    try {
      const result =
        tab === "upload"
          ? await adminApi.runWithFile(token, {
              supplierId,
              file: feedFile!,
              contentType: fileContentType(feedFile!),
              mapping: cleanMapping,
              saveMapping,
            })
          : await adminApi.runWithUrl(token, {
              supplierId,
              mapping: cleanMapping,
              saveMapping,
            });
      setLastResult(result);
      qc.invalidateQueries({ queryKey: ["admin", "suppliers"] });
      qc.invalidateQueries({ queryKey: ["admin", "import-runs"] });
      qc.invalidateQueries(); // refresh storefront product/category lists
      toast({
        title: "Import complete",
        description: `${result.createdCount} new, ${result.updatedCount} updated, ${result.skippedCount} skipped, ${result.erroredCount} errors.`,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="text-lg font-mono font-bold uppercase tracking-wider">
            1. Choose supplier
          </h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No suppliers configured.{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setLocation("/admin/suppliers")}
              >
                Create one
              </button>{" "}
              first.
            </p>
          ) : (
            <Select
              value={supplierId ? String(supplierId) : ""}
              onValueChange={(v) => setSupplierId(Number(v))}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a supplier…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h2 className="text-lg font-mono font-bold uppercase tracking-wider">
            2. Provide feed
          </h2>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "url")}>
            <TabsList>
              <TabsTrigger value="upload">
                <CloudUpload className="h-4 w-4 mr-1" />
                Upload CSV
              </TabsTrigger>
              <TabsTrigger value="url">
                <LinkIcon className="h-4 w-4 mr-1" />
                From URL
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-3 pt-4">
              <Label htmlFor="csv-file">CSV or Excel file (max 10 MB)</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
              />
              {feedFile && (
                <p className="text-xs text-muted-foreground">
                  Loaded <span className="font-mono">{feedFile.name}</span> (
                  {(feedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </TabsContent>
            <TabsContent value="url" className="space-y-3 pt-4">
              <Label htmlFor="csv-url">Feed URL</Label>
              <Input
                id="csv-url"
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://supplier.example.com/feed.csv"
              />
              <p className="text-xs text-muted-foreground">
                The server will fetch this URL when previewing or running the import.
              </p>
            </TabsContent>
          </Tabs>
          <Button
            onClick={handlePreview}
            disabled={
              previewing ||
              (tab === "upload" ? !feedFile : !feedUrl)
            }
          >
            {previewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Previewing…
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </>
            )}
          </Button>
        </section>

        {preview && (
          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-mono font-bold uppercase tracking-wider">
                3. Map columns
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                {preview.totalRows} rows · {preview.headers.length} columns
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {preview.importableFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="flex items-center gap-1">
                    <span>{f.key}</span>
                    {f.required && (
                      <span className="text-[10px] uppercase font-mono text-primary">
                        required
                      </span>
                    )}
                  </Label>
                  <Select
                    value={mapping[f.key] ?? UNMAPPED}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [f.key]: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>— none —</SelectItem>
                      {preview.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">{f.description}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} className="p-2 text-left font-mono whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {preview.headers.map((h) => (
                        <td key={h} className="p-2 align-top max-w-[220px] truncate">
                          {row[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground font-mono">
                Showing {preview.sampleSize} of {preview.totalRows} rows
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saveMapping}
                  onChange={(e) => setSaveMapping(e.target.checked)}
                />
                Save this mapping to the supplier
              </label>
              <Button
                onClick={handleRun}
                disabled={!supplierId || running}
                size="lg"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-4 w-4 mr-1" />
                    Run import
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {lastResult && (
          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-lg font-mono font-bold uppercase tracking-wider flex items-center gap-2">
              {lastResult.erroredCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              Import results
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {[
                { label: "Total", value: lastResult.totalRows },
                { label: "Created", value: lastResult.createdCount },
                { label: "Updated", value: lastResult.updatedCount },
                { label: "Skipped", value: lastResult.skippedCount },
                { label: "Errors", value: lastResult.erroredCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded border border-border bg-background p-3"
                >
                  <div className="text-2xl font-bold font-mono">{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
            {lastResult.erroredCount > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    void getToken().then((token) => {
                      if (!token) return;
                      adminApi.downloadErrorsCsv(token, lastResult.runId)
                      .catch((err: unknown) =>
                        toast({
                          title: "Download failed",
                          description: err instanceof Error ? err.message : String(err),
                          variant: "destructive",
                        }),
                      );
                    });
                  }}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Download className="h-4 w-4" />
                  Download errors as CSV
                </button>
                <ul className="mt-2 text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
                  {lastResult.errors.slice(0, 25).map((e, i) => (
                    <li key={i} className="font-mono">
                      row {e.row} ({e.externalSku ?? "—"}): {e.message}
                    </li>
                  ))}
                  {lastResult.errors.length > 25 && (
                    <li className="italic">…and {lastResult.errors.length - 25} more</li>
                  )}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  );
}
