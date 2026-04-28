// Lightweight client for `/api/admin/*` endpoints. These routes are not in the
// OpenAPI spec, so we don't go through orval — we call fetch directly and
// attach an `Authorization: Bearer <clerkJwt>` header. The JWT is a short-lived
// Clerk session token obtained via `getToken()` from the Clerk auth context;
// the server verifies it with `getAuth(req)` and checks the `isAdmin` flag
// on the resolved DB user.

export type FeedFormat = "csv" | "json" | "xml" | "shopify";

export type Supplier = {
  id: number;
  name: string;
  sourceType: "csv-upload" | "csv-url";
  feedFormat: FeedFormat;
  sourceUrl: string | null;
  columnMapping: Record<string, string>;
  schedule: {
    enabled: boolean;
    frequency: "hourly" | "daily" | "weekly" | "manual";
    hourOfDay?: number | null;
    notes?: string | null;
  } | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportRunSummary = {
  id: number;
  supplierId: number;
  supplierName: string | null;
  source: string;
  sourceUrl: string | null;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  triggeredByUserId: number | null;
  triggeredByUsername: string | null;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  erroredCount: number;
  errorMessage: string | null;
  errors: { row: number; externalSku: string | null; message: string }[];
};

export type PreviewResponse = {
  headers: string[];
  sample: Record<string, string>[];
  sampleSize: number;
  totalRows: number;
  importableFields: { key: string; required: boolean; description: string }[];
};

export type RunResult = {
  runId: number;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  erroredCount: number;
  errors: { row: number; externalSku: string | null; message: string }[];
};

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

function authHeaders(token: string | null | undefined): HeadersInit {
  if (!token) throw new Error("Admin session token required");
  return { Authorization: `Bearer ${token}` };
}

async function asJson<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = "";
    try {
      const data = (await resp.json()) as { error?: string };
      detail = data?.error ?? "";
    } catch {
      detail = await resp.text().catch(() => "");
    }
    throw new Error(detail || `HTTP ${resp.status}`);
  }
  return (await resp.json()) as T;
}

export type EmailLogEntry = {
  id: number;
  recipient: string;
  template: string;
  subject: string;
  status: string;
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterSubscriber = {
  id: number;
  email: string;
  status: string;
  token: string;
  subscribedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
};

export type AdminOrder = {
  id: number;
  orderNumber: string;
  email: string;
  customerName: string;
  status: string;
  totalCents: number;
  trackingNumber: string | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  refundedAt: string | null;
};

export const adminApi = {
  async listSuppliers(token: string): Promise<Supplier[]> {
    const r = await fetch(`${BASE}/admin/suppliers`, {
      headers: authHeaders(token),
    });
    return asJson<Supplier[]>(r);
  },
  async getSupplier(token: string, id: number): Promise<Supplier> {
    const r = await fetch(`${BASE}/admin/suppliers/${id}`, {
      headers: authHeaders(token),
    });
    return asJson<Supplier>(r);
  },
  async createSupplier(
    token: string,
    body: Partial<Supplier> & { name: string; sourceType: Supplier["sourceType"] },
  ): Promise<Supplier> {
    const r = await fetch(`${BASE}/admin/suppliers`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return asJson<Supplier>(r);
  },
  async updateSupplier(
    token: string,
    id: number,
    body: Partial<Supplier>,
  ): Promise<Supplier> {
    const r = await fetch(`${BASE}/admin/suppliers/${id}`, {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return asJson<Supplier>(r);
  },
  async deleteSupplier(token: string, id: number): Promise<void> {
    const r = await fetch(`${BASE}/admin/suppliers/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (!r.ok && r.status !== 204) {
      throw new Error(`HTTP ${r.status}`);
    }
  },

  async previewUrl(token: string, url: string, format?: FeedFormat): Promise<PreviewResponse> {
    const params = new URLSearchParams({ url });
    if (format) params.set("format", format);
    const r = await fetch(
      `${BASE}/admin/imports/preview?${params.toString()}`,
      { method: "POST", headers: authHeaders(token) },
    );
    return asJson<PreviewResponse>(r);
  },

  async previewFile(
    token: string,
    file: File | Blob,
    contentType: string,
    format?: FeedFormat,
  ): Promise<PreviewResponse> {
    const params = new URLSearchParams();
    if (format) params.set("format", format);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const r = await fetch(`${BASE}/admin/imports/preview${qs}`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": contentType },
      body: file,
    });
    return asJson<PreviewResponse>(r);
  },
  async runWithFile(
    token: string,
    args: {
      supplierId: number;
      file: File | Blob;
      contentType: string;
      mapping: Record<string, string>;
      saveMapping?: boolean;
      format?: FeedFormat;
    },
  ): Promise<RunResult> {
    const params = new URLSearchParams({
      supplierId: String(args.supplierId),
      mapping: JSON.stringify(args.mapping),
    });
    if (args.saveMapping) params.set("saveMapping", "true");
    if (args.format) params.set("format", args.format);
    const r = await fetch(`${BASE}/admin/imports/run?${params.toString()}`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": args.contentType },
      body: args.file,
    });
    return asJson<RunResult>(r);
  },
  async runWithUrl(
    token: string,
    args: {
      supplierId: number;
      mapping?: Record<string, string>;
      saveMapping?: boolean;
    },
  ): Promise<RunResult> {
    const r = await fetch(`${BASE}/admin/imports/run`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ source: "url", ...args }),
    });
    return asJson<RunResult>(r);
  },

  async listRuns(token: string, supplierId?: number): Promise<ImportRunSummary[]> {
    const qs = supplierId ? `?supplierId=${supplierId}` : "";
    const r = await fetch(`${BASE}/admin/import-runs${qs}`, {
      headers: authHeaders(token),
    });
    return asJson<ImportRunSummary[]>(r);
  },
  async getRun(token: string, id: number): Promise<ImportRunSummary> {
    const r = await fetch(`${BASE}/admin/import-runs/${id}`, {
      headers: authHeaders(token),
    });
    return asJson<ImportRunSummary>(r);
  },
  /**
   * Fetches the per-run errors CSV with the admin bearer token attached and
   * triggers a browser download. We can't use a plain `<a href>` because that
   * would not send the `Authorization` header.
   */
  async downloadErrorsCsv(token: string, runId: number): Promise<void> {
    const r = await fetch(`${BASE}/admin/import-runs/${runId}/errors.csv`, {
      headers: authHeaders(token),
    });
    if (!r.ok) {
      throw new Error(`Download failed: HTTP ${r.status}`);
    }
    const blob = await r.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `import-run-${runId}-errors.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // Allow the browser a tick to start the download before we revoke it.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  },

  async listEmailLog(
    token: string,
    filters?: { template?: string; status?: string },
  ): Promise<EmailLogEntry[]> {
    const params = new URLSearchParams();
    if (filters?.template) params.set("template", filters.template);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString() ? `?${params}` : "";
    const r = await fetch(`${BASE}/admin/email-log${qs}`, {
      headers: authHeaders(token),
    });
    return asJson<EmailLogEntry[]>(r);
  },

  async listSubscribers(token: string): Promise<NewsletterSubscriber[]> {
    const r = await fetch(`${BASE}/admin/newsletter/subscribers`, {
      headers: authHeaders(token),
    });
    return asJson<NewsletterSubscriber[]>(r);
  },

  async sendBroadcast(
    token: string,
    body: { subject: string; bodyHtml: string; bodyText: string },
  ): Promise<{ sent: number; message: string }> {
    const r = await fetch(`${BASE}/admin/newsletter/broadcast`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return asJson<{ sent: number; message: string }>(r);
  },

  async listOrders(token: string): Promise<AdminOrder[]> {
    const r = await fetch(`${BASE}/admin/orders`, {
      headers: authHeaders(token),
    });
    return asJson<AdminOrder[]>(r);
  },

  async updateOrderStatus(
    token: string,
    orderNumber: string,
    body: { status: string; trackingNumber?: string },
  ): Promise<AdminOrder> {
    const r = await fetch(`${BASE}/admin/orders/${orderNumber}/status`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return asJson<AdminOrder>(r);
  },

  async getSettings(token: string): Promise<{
    alertEmail?: string;
    alertEmailEffective: string;
    alertEmailIsDefault: boolean;
  }> {
    const r = await fetch(`${BASE}/admin/settings`, {
      headers: authHeaders(token),
    });
    const data = await asJson<Record<string, string>>(r);
    return {
      alertEmail: data["alert_email"],
      alertEmailEffective: data["alert_email_effective"] ?? "",
      alertEmailIsDefault: data["alert_email_is_default"] === "true",
    };
  },

  async updateSettings(
    token: string,
    body: { alertEmail: string },
  ): Promise<{ alertEmail: string }> {
    const r = await fetch(`${BASE}/admin/settings`, {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return asJson<{ alertEmail: string }>(r);
  },
};
