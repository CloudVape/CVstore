import { Link } from "wouter";
import { useListProductCategories } from "@workspace/api-client-react";
import { useSeo, JsonLd, breadcrumbJsonLd } from "@/lib/seo";

const CATEGORY_IMAGES: Record<string, { src: string; fit: "cover" | "contain" }> = {
  mods:        { src: "/images/categories/mods.jpg",        fit: "cover" },
  pods:        { src: "/images/categories/pods.jpg",        fit: "cover" },
  tanks:       { src: "/images/categories/tanks.png",       fit: "contain" },
  "e-liquids": { src: "/images/categories/e-liquids.jpg",   fit: "cover" },
  coils:       { src: "/images/categories/coils.jpg",       fit: "contain" },
  disposables: { src: "/images/categories/disposables.jpg", fit: "cover" },
  accessories: { src: "/images/categories/accessories.jpg", fit: "cover" },
};

export default function ShopCategories() {
  const { data: categories } = useListProductCategories();

  useSeo({
    title: "Shop by Category",
    description:
      "Browse VapeVault categories: vape kits, pod systems, e-liquids, coils, disposables, and accessories. Find exactly what you're looking for.",
    canonical: "/shop/categories",
    keywords: ["vape categories", "vape kits", "pods", "e-liquid categories", "coils", "disposables"],
  });

  return (
    <div className="relative w-full overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--secondary)/0.18),transparent_55%)] z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.14),transparent_55%)] z-0" />

      <div className="relative z-10 container mx-auto max-w-6xl px-4 py-12 space-y-8">
        <JsonLd
          id="categories-breadcrumbs"
          data={breadcrumbJsonLd([
            { name: "Home", url: "/" },
            { name: "Shop", url: "/shop" },
            { name: "Categories", url: "/shop/categories" },
          ])}
        />
        <div className="border-b border-border/40 pb-6">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Shop by Category</h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">Find exactly what you're looking for</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories?.map((c) => {
            const img = CATEGORY_IMAGES[c.slug];
            return (
              <Link key={c.id} href={`/shop/c/${c.slug}`}>
                <div className="group relative overflow-hidden rounded-xl cursor-pointer h-56 bg-slate-950 border border-border/40 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_hsl(var(--primary)/0.25)]">
                  {img && (
                    <img
                      src={img.src}
                      alt={c.name}
                      className={`absolute inset-0 w-full h-full transition-transform duration-700 ease-out group-hover:scale-105 ${
                        img.fit === "contain"
                          ? "object-contain p-8 opacity-80"
                          : "object-cover opacity-70 group-hover:opacity-80"
                      }`}
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  <div className="absolute top-3 left-3">
                    <span className="text-xl bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/10">
                      {c.iconEmoji}
                    </span>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                    <div>
                      <h3 className="font-black text-base uppercase tracking-tight text-white leading-tight">
                        {c.name}
                      </h3>
                      <p className="text-xs font-mono text-white/50 mt-0.5">{c.productCount} products</p>
                    </div>
                    <span className="text-xs font-mono uppercase tracking-wider text-primary group-hover:translate-x-1 transition-transform duration-300 shrink-0 ml-3">
                      Shop now →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
