import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AdminShell } from "./admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Bot, User, Shield, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

type SupportMessage = { id: number; ticketId: number; authorType: string; body: string; createdAt: string };
type SupportTicket = {
  id: number; customerName: string; customerEmail: string; orderNumber: string | null;
  category: string; status: string; aiDraft: string | null; aiConfident: boolean | null;
  createdAt: string; updatedAt: string; messages?: SupportMessage[];
};

function authHeader(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-500",
  needs_human: "bg-orange-500/15 text-orange-500",
  awaiting_customer: "bg-yellow-500/15 text-yellow-600",
  resolved: "bg-green-500/15 text-green-600",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  needs_human: "Needs Review",
  awaiting_customer: "Awaiting Customer",
  resolved: "Resolved",
};

const CATEGORY_LABELS: Record<string, string> = {
  orders: "Orders & Shipping",
  returns: "Returns & Refunds",
  product: "Product Questions",
  account: "Account",
  other: "Other",
};

const AUTHOR_ICONS: Record<string, React.ReactNode> = {
  customer: <User className="h-3.5 w-3.5" />,
  ai: <Bot className="h-3.5 w-3.5 text-primary" />,
  human: <Shield className="h-3.5 w-3.5 text-green-500" />,
};

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isCustomer = msg.authorType === "customer";
  return (
    <div className={`flex gap-3 ${isCustomer ? "" : "flex-row-reverse"}`}>
      <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center border ${
        isCustomer ? "bg-muted border-border" : msg.authorType === "ai" ? "bg-primary/10 border-primary/30" : "bg-green-500/10 border-green-500/30"
      }`}>
        {AUTHOR_ICONS[msg.authorType] ?? <User className="h-3.5 w-3.5" />}
      </div>
      <div className={`max-w-[75%] ${isCustomer ? "" : "items-end"} flex flex-col gap-1`}>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {msg.authorType === "ai" ? "AI Reply" : msg.authorType === "human" ? "Support Team" : "Customer"} · {new Date(msg.createdAt).toLocaleString()}
        </span>
        <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isCustomer ? "bg-muted text-foreground rounded-tl-sm" : "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
        }`}>
          {msg.body}
        </div>
      </div>
    </div>
  );
}

export default function AdminSupport() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [draftEdit, setDraftEdit] = useState("");
  const [replyMode, setReplyMode] = useState<"none" | "manual" | "draft">("none");

  const { data: tickets = [], isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ["admin-support-tickets", statusFilter, token],
    queryFn: () => {
      const qs = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
      return fetch(`${BASE}/admin/support/tickets${qs}`, { headers: authHeader(token) }).then((r) => r.json());
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  const { data: detail } = useQuery<SupportTicket>({
    queryKey: ["admin-support-ticket", selectedId, token],
    queryFn: () => fetch(`${BASE}/admin/support/tickets/${selectedId}`, { headers: authHeader(token) }).then((r) => r.json()),
    enabled: !!selectedId && !!token,
  });

  async function apiPost(path: string, body?: unknown): Promise<Response> {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: authHeader(token),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => r.statusText);
      throw new Error(msg || `Request failed (${r.status})`);
    }
    return r;
  }

  async function apiPatch(path: string, body: unknown): Promise<Response> {
    const r = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: authHeader(token),
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => r.statusText);
      throw new Error(msg || `Request failed (${r.status})`);
    }
    return r;
  }

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      apiPost(`/admin/support/tickets/${selectedId}/reply`, { body }),
    onSuccess: () => {
      toast({ title: "Reply sent" });
      setReplyBody(""); setReplyMode("none");
      qc.invalidateQueries({ queryKey: ["admin-support-ticket", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to send reply", variant: "destructive" }),
  });

  const sendDraftMutation = useMutation({
    mutationFn: (body: string) =>
      apiPost(`/admin/support/tickets/${selectedId}/send-draft`, { body }),
    onSuccess: () => {
      toast({ title: "AI draft sent" });
      setReplyMode("none");
      qc.invalidateQueries({ queryKey: ["admin-support-ticket", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to send draft", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiPatch(`/admin/support/tickets/${selectedId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-ticket", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to update status", variant: "destructive" }),
  });

  const retryAiMutation = useMutation({
    mutationFn: () =>
      apiPost(`/admin/support/tickets/${selectedId}/retry-ai`),
    onSuccess: () => {
      toast({ title: "AI retry queued", description: "The AI will attempt to draft a reply." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin-support-ticket", selectedId] }), 5000);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message || "Failed to queue AI retry", variant: "destructive" }),
  });

  function openTicket(id: number) {
    setSelectedId(id);
    setReplyBody(""); setDraftEdit(""); setReplyMode("none");
  }

  return (
    <AdminShell>
      <div className="mb-6 p-4 rounded-lg border border-orange-500/30 bg-orange-500/5 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-orange-600 mb-1">Action required before the inbox goes live</p>
          <p className="text-sm text-muted-foreground">
            Emails to <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">support@cloudvape.store</code> won't
            create tickets until you configure two things:
          </p>
          <ol className="mt-2 space-y-1 text-sm text-muted-foreground list-decimal ml-4">
            <li>
              <strong>MX record:</strong> In your DNS provider, add the MX record that Resend provides for inbound routing,
              pointing at the support address domain.
            </li>
            <li>
              <strong>Webhook URL:</strong> In Resend's inbound routing settings, set the webhook to{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                https://cloudvape.store/api/support/inbound-email
              </code>{" "}
              and set the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">X-Webhook-Secret</code> header
              to match the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">SUPPORT_WEBHOOK_SECRET</code>{" "}
              environment variable.
            </li>
            <li>
              <strong>Confirm your support address:</strong> Verify the exact address (e.g. support@cloudvape.store) matches
              what's configured in Resend before going live.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Contact form tickets work immediately — only the inbound email route requires DNS setup.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold font-mono">Support Inbox</h2>
          <p className="text-sm text-muted-foreground">Manage customer support tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 text-xs font-mono">
              <SelectValue placeholder="All tickets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="needs_human">Needs Review</SelectItem>
              <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No tickets {statusFilter ? `with status "${statusFilter}"` : "yet"}.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t.id)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                selectedId === t.id ? "border-primary/50 bg-primary/5" : "border-border/40 hover:border-border bg-card/40"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-muted-foreground">#{t.id}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${STATUS_COLORS[t.status] ?? "bg-muted"}`}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                  {t.aiDraft && t.status === "needs_human" && (
                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">AI Draft Ready</span>
                  )}
                </div>
                <div className="font-medium text-sm truncate">{t.customerName}</div>
                <div className="text-xs text-muted-foreground font-mono">{t.customerEmail} · {CATEGORY_LABELS[t.category] ?? t.category}</div>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{new Date(t.updatedAt).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selectedId && !!detail} onOpenChange={(o) => { if (!o) { setSelectedId(null); setReplyMode("none"); } }}>
        {detail && (
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-mono flex items-center gap-2">
                Ticket #{detail.id}
                <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider ${STATUS_COLORS[detail.status] ?? "bg-muted"}`}>
                  {STATUS_LABELS[detail.status] ?? detail.status}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-4">
              <div><span className="text-muted-foreground">From:</span> {detail.customerName} &lt;{detail.customerEmail}&gt;</div>
              <div><span className="text-muted-foreground">Topic:</span> {CATEGORY_LABELS[detail.category] ?? detail.category}</div>
              {detail.orderNumber && <div><span className="text-muted-foreground">Order:</span> {detail.orderNumber}</div>}
              <div><span className="text-muted-foreground">Created:</span> {new Date(detail.createdAt).toLocaleString()}</div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0 max-h-96">
              {(detail.messages ?? []).map((m) => <MessageBubble key={m.id} msg={m} />)}
            </div>

            {detail.aiDraft && detail.status === "needs_human" && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-xs font-mono text-primary uppercase tracking-wider">AI Draft (needs review)</span>
                </div>
                {replyMode === "draft" ? (
                  <div className="space-y-2">
                    <Textarea value={draftEdit} onChange={(e) => setDraftEdit(e.target.value)} rows={5} className="text-sm font-mono" />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-primary text-xs font-mono" onClick={() => sendDraftMutation.mutate(draftEdit)} disabled={sendDraftMutation.isPending}>
                        {sendDraftMutation.isPending ? "Sending…" : "Send to Customer"}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs font-mono" onClick={() => setReplyMode("none")}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-3">{detail.aiDraft}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-primary text-xs font-mono gap-1.5" onClick={() => { setDraftEdit(detail.aiDraft!); setReplyMode("draft"); }}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit & Send
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs font-mono" onClick={() => sendDraftMutation.mutate(detail.aiDraft!)} disabled={sendDraftMutation.isPending}>
                        Send As-Is
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
              {replyMode === "manual" ? (
                <div className="space-y-2">
                  <Textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your reply…"
                    rows={4}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-primary text-xs font-mono" onClick={() => replyMutation.mutate(replyBody)} disabled={replyMutation.isPending || !replyBody.trim()}>
                      {replyMutation.isPending ? "Sending…" : "Send Reply"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs font-mono" onClick={() => setReplyMode("none")}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-primary text-xs font-mono gap-1.5" onClick={() => setReplyMode("manual")}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Reply
                  </Button>
                  {detail.status !== "resolved" && (
                    <Button size="sm" variant="outline" className="text-xs font-mono gap-1.5 text-green-600 border-green-600/30"
                      onClick={() => statusMutation.mutate("resolved")} disabled={statusMutation.isPending}>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark Resolved
                    </Button>
                  )}
                  {detail.status === "resolved" && (
                    <Button size="sm" variant="outline" className="text-xs font-mono" onClick={() => statusMutation.mutate("open")}>Reopen</Button>
                  )}
                  <Button size="sm" variant="outline" className="text-xs font-mono gap-1.5" onClick={() => retryAiMutation.mutate()} disabled={retryAiMutation.isPending}>
                    <Bot className="h-3.5 w-3.5" />
                    {retryAiMutation.isPending ? "Queuing…" : "Retry AI"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </AdminShell>
  );
}

function Pencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.293-6.293a1 1 0 011.414 0l1.586 1.586a1 1 0 010 1.414L12 14H9v-3z" />
    </svg>
  );
}
