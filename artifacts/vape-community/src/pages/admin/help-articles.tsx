import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AdminShell } from "./admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

type HelpCategory = { id: number; slug: string; name: string; description: string | null; sortOrder: number };
type HelpArticle = { id: number; categoryId: number; slug: string; title: string; body: string; published: boolean; sortOrder: number; updatedAt: string };

function authHeader(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function AdminHelpArticles() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dialog, setDialog] = useState<null | "article" | "category">(null);
  const [editing, setEditing] = useState<HelpArticle | null>(null);
  const [articleForm, setArticleForm] = useState({ categoryId: "", title: "", slug: "", body: "", published: true, sortOrder: 0 });
  const [catForm, setCatForm] = useState({ name: "", slug: "", description: "", sortOrder: 0 });

  const { data: categories = [] } = useQuery<HelpCategory[]>({
    queryKey: ["admin-help-categories", token],
    queryFn: () => fetch(`${BASE}/admin/help/categories`, { headers: authHeader(token) }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: articles = [], isLoading } = useQuery<HelpArticle[]>({
    queryKey: ["admin-help-articles", token],
    queryFn: () => fetch(`${BASE}/admin/help/articles`, { headers: authHeader(token) }).then((r) => r.json()),
    enabled: !!token,
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/admin/help/seed`, { method: "POST", headers: authHeader(token) }).then((r) => r.json()),
    onSuccess: (data) => {
      toast({ title: "Seeded", description: data.message ?? `${data.categoriesCreated} categories, ${data.articlesCreated} articles created.` });
      qc.invalidateQueries({ queryKey: ["admin-help-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-help-articles"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof articleForm) => {
      const url = editing ? `${BASE}/admin/help/articles/${editing.id}` : `${BASE}/admin/help/articles`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: authHeader(token), body: JSON.stringify({ ...values, categoryId: parseInt(values.categoryId, 10) }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
    },
    onSuccess: () => {
      toast({ title: editing ? "Article updated" : "Article created" });
      qc.invalidateQueries({ queryKey: ["admin-help-articles"] });
      setDialog(null); setEditing(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/admin/help/articles/${id}`, { method: "DELETE", headers: authHeader(token) }),
    onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["admin-help-articles"] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      fetch(`${BASE}/admin/help/articles/${id}`, { method: "PUT", headers: authHeader(token), body: JSON.stringify({ published }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-help-articles"] }),
  });

  const saveCatMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/admin/help/categories`, { method: "POST", headers: authHeader(token), body: JSON.stringify({ ...catForm, sortOrder: Number(catForm.sortOrder) }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
    },
    onSuccess: () => {
      toast({ title: "Category created" });
      qc.invalidateQueries({ queryKey: ["admin-help-categories"] });
      setDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setArticleForm({ categoryId: String(categories[0]?.id ?? ""), title: "", slug: "", body: "", published: true, sortOrder: 0 });
    setDialog("article");
  }

  function openEdit(a: HelpArticle) {
    setEditing(a);
    setArticleForm({ categoryId: String(a.categoryId), title: a.title, slug: a.slug, body: a.body, published: a.published, sortOrder: a.sortOrder });
    setDialog("article");
  }

  function genSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold font-mono">Help Center Articles</h2>
          <p className="text-sm text-muted-foreground">Manage public help center content</p>
        </div>
        <div className="flex gap-2">
          {articles.length === 0 && (
            <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? "Seeding…" : "Seed with sample articles"}
            </Button>
          )}
          <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={() => { setCatForm({ name: "", slug: "", description: "", sortOrder: 0 }); setDialog("category"); }}>
            <Plus className="h-3.5 w-3.5" />
            New Category
          </Button>
          <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            New Article
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No articles yet.</p>
          <Button variant="outline" className="font-mono text-xs" onClick={() => seedMutation.mutate()}>
            Seed with sample articles
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border bg-card/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{a.title}</span>
                  {!a.published && <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">Draft</span>}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{catMap[a.categoryId] ?? "Unknown"} · /help/{a.slug}</div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={a.published ? "Unpublish" : "Publish"}
                  onClick={() => toggleMutation.mutate({ id: a.id, published: !a.published })}>
                  {a.published ? <Eye className="h-3.5 w-3.5 text-green-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                  onClick={() => { if (confirm("Delete this article?")) deleteMutation.mutate(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog === "article"} onOpenChange={(o) => { if (!o) { setDialog(null); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">{editing ? "Edit Article" : "New Article"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Category</Label>
              <Select value={articleForm.categoryId} onValueChange={(v) => setArticleForm((p) => ({ ...p, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Title</Label>
              <Input value={articleForm.title} onChange={(e) => {
                const t = e.target.value;
                setArticleForm((p) => ({ ...p, title: t, slug: editing ? p.slug : genSlug(t) }));
              }} placeholder="Article title" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Slug</Label>
              <Input value={articleForm.slug} onChange={(e) => setArticleForm((p) => ({ ...p, slug: e.target.value }))} placeholder="url-slug" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Body (Markdown supported)</Label>
              <Textarea value={articleForm.body} onChange={(e) => setArticleForm((p) => ({ ...p, body: e.target.value }))} rows={12} placeholder="Article content…" className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={articleForm.published} onChange={(e) => setArticleForm((p) => ({ ...p, published: e.target.checked }))} className="rounded" />
                <span className="font-mono text-xs uppercase tracking-wider">Published</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(null); setEditing(null); }}>Cancel</Button>
            <Button className="bg-primary" onClick={() => saveMutation.mutate(articleForm)} disabled={saveMutation.isPending || !articleForm.title || !articleForm.slug || !articleForm.body || !articleForm.categoryId}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "category"} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Name</Label>
              <Input value={catForm.name} onChange={(e) => { const n = e.target.value; setCatForm((p) => ({ ...p, name: n, slug: genSlug(n) })); }} placeholder="Category name" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Slug</Label>
              <Input value={catForm.slug} onChange={(e) => setCatForm((p) => ({ ...p, slug: e.target.value }))} placeholder="category-slug" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider">Description</Label>
              <Input value={catForm.description} onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button className="bg-primary" onClick={() => saveCatMutation.mutate()} disabled={saveCatMutation.isPending || !catForm.name || !catForm.slug}>
              {saveCatMutation.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
