import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, HelpCircle, ArrowRight } from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

type HelpCategory = { id: number; slug: string; name: string; description: string | null; sortOrder: number };
type HelpArticle = {
  id: number; slug: string; title: string; body: string;
  categoryId: number; categorySlug: string; categoryName: string;
};

function useCategories() {
  return useQuery<HelpCategory[]>({
    queryKey: ["help-categories"],
    queryFn: () => fetch(`${BASE}/help/categories`).then((r) => r.json()),
  });
}

function useArticleSearch(q: string) {
  return useQuery<HelpArticle[]>({
    queryKey: ["help-search", q],
    queryFn: () => fetch(`${BASE}/help/articles?q=${encodeURIComponent(q)}`).then((r) => r.json()),
    enabled: q.length >= 2,
  });
}

function useCategoryArticles(categorySlug: string) {
  return useQuery<HelpArticle[]>({
    queryKey: ["help-articles", categorySlug],
    queryFn: () => fetch(`${BASE}/help/articles?category=${categorySlug}`).then((r) => r.json()),
    enabled: !!categorySlug,
  });
}

function CategoryCard({ cat }: { cat: HelpCategory }) {
  const { data: articles = [] } = useCategoryArticles(cat.slug);
  return (
    <div className="border border-border/40 rounded-xl bg-card/60 p-5 hover:border-primary/40 transition-colors">
      <h3 className="font-mono font-bold text-base mb-1">{cat.name}</h3>
      {cat.description && <p className="text-muted-foreground text-sm mb-3">{cat.description}</p>}
      <ul className="space-y-1">
        {articles.slice(0, 5).map((a) => (
          <li key={a.id}>
            <Link href={`/help/${a.categorySlug}/${a.slug}`} className="flex items-center gap-1.5 text-sm text-foreground/80 hover:text-primary transition-colors group">
              <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              {a.title}
            </Link>
          </li>
        ))}
        {articles.length > 5 && (
          <li className="text-xs text-muted-foreground font-mono pt-1">+{articles.length - 5} more articles</li>
        )}
      </ul>
    </div>
  );
}

export default function Help() {
  const [query, setQuery] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const { data: categories = [], isLoading } = useCategories();
  const { data: searchResults = [], isFetching: searching } = useArticleSearch(searchQ);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQ(query.trim());
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
          <HelpCircle className="h-3.5 w-3.5" />
          Help Center
        </div>
        <h1 className="text-3xl font-bold font-mono mb-3">How can we help you?</h1>
        <p className="text-muted-foreground mb-8">Browse our help articles or search for answers below.</p>
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="flex-1 font-mono text-sm"
          />
          <Button type="submit" disabled={query.length < 2} className="rounded-full bg-primary px-6">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {searchQ && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono font-bold text-lg">Search results for "{searchQ}"</h2>
            <Button variant="ghost" size="sm" className="text-xs font-mono" onClick={() => { setSearchQ(""); setQuery(""); }}>
              Clear
            </Button>
          </div>
          {searching ? (
            <div className="text-muted-foreground text-sm">Searching…</div>
          ) : searchResults.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              No results found. Try different keywords or{" "}
              <Link href="/contact" className="text-primary hover:underline">contact us</Link>.
            </div>
          ) : (
            <ul className="space-y-2">
              {searchResults.map((a) => (
                <li key={a.id}>
                  <Link href={`/help/${a.categorySlug}/${a.slug}`} className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:border-primary/40 bg-card/60 transition-colors group">
                    <div>
                      <div className="font-medium group-hover:text-primary transition-colors">{a.title}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.categoryName}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!searchQ && (
        <>
          {isLoading ? (
            <div className="text-muted-foreground text-sm text-center py-10">Loading…</div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {categories.map((cat) => <CategoryCard key={cat.id} cat={cat} />)}
            </div>
          )}

          <div className="mt-12 text-center border-t border-border/40 pt-10">
            <p className="text-muted-foreground mb-4">Can't find what you're looking for?</p>
            <Link href="/contact">
              <Button className="rounded-full bg-primary hover:bg-primary/90 font-mono uppercase tracking-wider text-sm px-6">
                Contact Support
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
