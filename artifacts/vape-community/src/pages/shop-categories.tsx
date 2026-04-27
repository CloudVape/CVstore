import { Link } from "wouter";
import { useListProductCategories } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

export default function ShopCategories() {
  const { data: categories } = useListProductCategories();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Shop by Category</h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">Find exactly what you're looking for</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories?.map((c) => (
          <Link key={c.id} href={`/shop/c/${c.slug}`}>
            <Card className="group p-6 bg-card/50 hover:bg-card hover:border-primary/50 transition-all cursor-pointer border-border/40 h-full flex flex-col gap-3 hover:shadow-[0_0_25px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{c.iconEmoji}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg uppercase tracking-tight group-hover:text-primary transition-colors">{c.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground">{c.productCount} products</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{c.description}</p>
              <p className="text-xs font-mono uppercase tracking-wider text-primary group-hover:translate-x-1 transition-transform">Shop now →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
