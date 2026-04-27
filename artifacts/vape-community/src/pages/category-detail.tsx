import { useRoute, Link } from "wouter";
import { useListProducts, useListProductCategories } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { ChevronLeft } from "lucide-react";
import { useSeo, JsonLd, breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";

export default function CategoryDetail() {
  const [, params] = useRoute("/shop/c/:slug");
  const slug = params?.slug ?? "";

  const { data: categories } = useListProductCategories();
  const category = categories?.find((c) => c.slug === slug);

  const { data: products, isLoading } = useListProducts({
    categorySlug: slug,
    limit: 100,
  });

  const categoryName = category?.name ?? slug.replace(/-/g, " ");
  useSeo({
    title: categoryName,
    description: category?.description
      ? `${category.description} Shop ${categoryName.toLowerCase()} at CloudVape.`
      : `Shop ${categoryName.toLowerCase()} at CloudVape — authentic products, fast shipping.`,
    canonical: `/shop/c/${slug}`,
    keywords: ["vape shop", categoryName.toLowerCase(), "vape products"],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      <JsonLd
        id={`cat-bc-${slug}`}
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Categories", url: "/shop/categories" },
          { name: categoryName, url: `/shop/c/${slug}` },
        ])}
      />
      {products && products.length > 0 && (
        <JsonLd
          id={`cat-collection-${slug}`}
          data={collectionJsonLd({
            name: categoryName,
            description: category?.description ?? undefined,
            url: `/shop/c/${slug}`,
            items: products.slice(0, 30).map((p) => ({
              name: p.name,
              url: `/shop/p/${p.slug}`,
              image: p.imageUrl,
            })),
          })}
        />
      )}
      <Link href="/shop/categories" className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Categories
      </Link>

      <div className="border-b border-border/40 pb-6 flex items-center gap-4">
        {category && <div className="text-5xl">{category.iconEmoji}</div>}
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">{category?.name ?? slug}</h1>
          {category && <p className="text-muted-foreground font-mono text-sm mt-1">{category.description}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground font-mono">Loading products...</div>
      ) : !products?.length ? (
        <div className="text-center py-20 text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
          No products in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
