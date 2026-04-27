import { useState, useMemo } from "react";
import { useSearch, Link } from "wouter";
import { useListProducts, useListProductCategories } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { useSeo, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export default function Shop() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const filterParam = params.get("filter");

  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc" | "rating">("featured");

  const { data: categories } = useListProductCategories();
  const { data: products, isLoading } = useListProducts({
    categoryId: selectedCategoryId,
    search: query || undefined,
    limit: 100,
  });

  const visible = useMemo(() => {
    if (!products) return [];
    let arr = [...products];
    if (filterParam === "new") arr = arr.filter((p) => p.isNew);
    if (filterParam === "bestsellers") arr = arr.filter((p) => p.isBestseller);
    if (filterParam === "featured") arr = arr.filter((p) => p.isFeatured);
    switch (sortBy) {
      case "price-asc":
        arr.sort((a, b) => a.priceCents - b.priceCents);
        break;
      case "price-desc":
        arr.sort((a, b) => b.priceCents - a.priceCents);
        break;
      case "rating":
        arr.sort((a, b) => Number(b.rating) - Number(a.rating));
        break;
    }
    return arr;
  }, [products, sortBy, filterParam]);

  const heading =
    filterParam === "new"
      ? "New Arrivals"
      : filterParam === "bestsellers"
      ? "Bestsellers"
      : filterParam === "featured"
      ? "Featured"
      : "Shop All";

  const seoDescription =
    filterParam === "new"
      ? "Browse the newest vape kits, pod systems, and e-liquids freshly added to CloudVape."
      : filterParam === "bestsellers"
      ? "The most-loved vape kits, pod systems, and e-liquids from CloudVape — community bestsellers."
      : filterParam === "featured"
      ? "Hand-picked featured vape products curated by the CloudVape team."
      : "Shop the full range of vape kits, pod systems, e-liquids, coils, and accessories at CloudVape.";

  useSeo({
    title: heading,
    description: seoDescription,
    canonical: filterParam ? `/shop?filter=${filterParam}` : "/shop",
    keywords: ["vape shop", "vape kits", "pod systems", "e-liquid", "coils", heading.toLowerCase()],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <JsonLd
        id="shop-breadcrumbs"
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: heading, url: filterParam ? `/shop?filter=${filterParam}` : "/shop" },
        ])}
      />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">{heading}</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {visible.length} product{visible.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-full sm:w-64 bg-card/50 border-border/50"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-card/50 border border-border/50 rounded-md px-3 py-2 text-sm font-mono text-foreground"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-56 flex-shrink-0 space-y-4">
          <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
            <SlidersHorizontal className="w-4 h-4" /> Categories
          </div>
          <div className="flex lg:flex-col flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategoryId(undefined)}
              className={`text-left text-sm px-3 py-2 rounded-md font-mono transition-colors ${
                selectedCategoryId === undefined
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-card hover:text-foreground border border-transparent"
              }`}
            >
              All
            </button>
            {categories?.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategoryId(c.id === selectedCategoryId ? undefined : c.id)}
                className={`text-left text-sm px-3 py-2 rounded-md font-mono transition-colors flex items-center gap-2 ${
                  selectedCategoryId === c.id
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-card hover:text-foreground border border-transparent"
                }`}
              >
                <span>{c.iconEmoji}</span>
                <span>{c.name}</span>
                <span className="ml-auto text-[10px] opacity-60">{c.productCount}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border/40 pt-4 space-y-2">
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Quick Filters</div>
            <Link href="/shop?filter=bestsellers" className="block text-sm text-foreground/80 hover:text-primary transition-colors font-mono">→ Bestsellers</Link>
            <Link href="/shop?filter=new" className="block text-sm text-foreground/80 hover:text-primary transition-colors font-mono">→ New Arrivals</Link>
            <Link href="/shop?filter=featured" className="block text-sm text-foreground/80 hover:text-primary transition-colors font-mono">→ Featured</Link>
            {filterParam && (
              <Link href="/shop">
                <Button variant="ghost" size="sm" className="font-mono text-xs">Clear filter</Button>
              </Link>
            )}
          </div>
        </aside>

        <div className="flex-1">
          {isLoading ? (
            <div className="text-center py-20 text-muted-foreground font-mono">Loading products...</div>
          ) : visible.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
              No products match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
