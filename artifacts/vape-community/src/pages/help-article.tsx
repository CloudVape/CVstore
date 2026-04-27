import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

type HelpArticle = {
  id: number; slug: string; title: string; body: string;
  categoryId: number; categorySlug: string; categoryName: string;
  updatedAt: string;
};

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/gs, (m) => `<ul class="space-y-1 my-3">${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^/, '<p class="mb-3">')
    .replace(/$/, "</p>");
}

export default function HelpArticle({ params }: { params: { category: string; slug: string } }) {
  const { data: article, isLoading, error } = useQuery<HelpArticle>({
    queryKey: ["help-article", params.slug],
    queryFn: () =>
      fetch(`${BASE}/help/articles/${params.slug}`).then(async (r) => {
        if (!r.ok) throw new Error("Article not found");
        return r.json();
      }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-muted-foreground mb-4">Article not found.</p>
        <Link href="/help">
          <Button variant="outline" className="font-mono text-xs">Back to Help Center</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-6">
        <Link href="/help" className="hover:text-primary transition-colors flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          Help Center
        </Link>
        <span>/</span>
        <span className="text-foreground/70">{article.categoryName}</span>
        <span>/</span>
        <span className="text-foreground truncate">{article.title}</span>
      </nav>

      <Link href="/help">
        <Button variant="ghost" size="sm" className="gap-1.5 font-mono text-xs mb-6 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
      </Link>

      <div className="mb-2">
        <span className="text-xs font-mono text-primary uppercase tracking-wider">{article.categoryName}</span>
      </div>
      <h1 className="text-2xl font-bold font-mono mb-2">{article.title}</h1>
      <p className="text-xs text-muted-foreground font-mono mb-8">
        Updated {new Date(article.updatedAt).toLocaleDateString()}
      </p>

      <div
        className="prose prose-sm max-w-none text-foreground/90 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
      />

      <div className="mt-12 pt-8 border-t border-border/40">
        <p className="text-sm text-muted-foreground mb-4">Was this article helpful?</p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/contact">
            <Button variant="outline" size="sm" className="font-mono text-xs">
              Still need help? Contact Us
            </Button>
          </Link>
          <Link href="/help">
            <Button variant="ghost" size="sm" className="font-mono text-xs">
              Browse all articles
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
