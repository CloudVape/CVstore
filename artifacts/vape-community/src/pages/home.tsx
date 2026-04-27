import { Link } from "wouter";
import {
  useGetFeaturedProducts,
  useGetBestsellerProducts,
  useGetNewProducts,
  useListProductCategories,
  useGetTrendingPosts,
  useGetCommunityStats,
} from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flame, Sparkles, ArrowRight, Truck, ShieldCheck, Headphones, Award, MessageSquare } from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function Home() {
  useSeo({
    title: "Premium Vape Shop & Community",
    description:
      "Shop authentic vape kits, pod systems, e-liquids, coils, and accessories at VapeVault. Free shipping over $50, same-day dispatch before 3pm EST.",
    canonical: "/",
    keywords: [
      "vape shop",
      "vape kits",
      "pod systems",
      "e-liquid",
      "vape juice",
      "coils",
      "disposables",
      "vape accessories",
      "vape community",
    ],
  });
  const { data: featured } = useGetFeaturedProducts();
  const { data: bestsellers } = useGetBestsellerProducts();
  const { data: newProducts } = useGetNewProducts();
  const { data: categories } = useListProductCategories();
  const { data: trendingPosts } = useGetTrendingPosts();
  const { data: stats } = useGetCommunityStats();

  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative w-full overflow-hidden border-b border-border/40 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--primary),0.15),transparent_50%)] z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(var(--secondary),0.12),transparent_50%)] z-0" />
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-mono backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
              Free shipping over $50
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter uppercase leading-[1.05]">
              Premium gear.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Curated by vapers.</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-md">
              Mods, pods, juices, coils — the gear we'd buy ourselves, vetted by our community of cloud chasers and flavor heads.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop/categories">
                <Button size="lg" className="h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(var(--primary),0.4)] hover:shadow-[0_0_30px_rgba(var(--primary),0.6)]">
                  Shop categories
                </Button>
              </Link>
              <Link href="/shop?filter=bestsellers">
                <Button size="lg" variant="outline" className="h-12 px-8 rounded-full border-border/50 bg-background/50 hover:bg-background/80 font-mono text-sm uppercase tracking-wider">
                  Bestsellers
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-3">
              {(featured ?? []).slice(0, 4).map((p, idx) => (
                <Link key={p.id} href={`/shop/p/${p.slug}`}>
                  <Card className={`relative aspect-square overflow-hidden border-border/40 bg-card/50 hover:border-primary/50 transition-all hover:shadow-[0_0_25px_rgba(var(--primary),0.2)] cursor-pointer ${idx % 3 === 0 ? "translate-y-4" : ""}`}>
                    <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/0 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                      <p className="text-xs font-semibold line-clamp-1">{p.name}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto max-w-6xl px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { Icon: Truck, label: "Free shipping $50+", sub: "Same-day dispatch" },
            { Icon: ShieldCheck, label: "100% authentic", sub: "Direct from brands" },
            { Icon: Award, label: "Community vetted", sub: "Real vaper reviews" },
            { Icon: Headphones, label: "Expert support", sub: "Vapers helping vapers" },
          ].map(({ Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 justify-center">
              <Icon className="w-5 h-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="text-xs font-mono uppercase tracking-wider text-foreground">{label}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto max-w-6xl px-4 py-12 space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h2 className="text-2xl font-black uppercase tracking-tight">Shop by Category</h2>
          <Link href="/shop/categories">
            <Button variant="ghost" size="sm" className="font-mono text-xs">All <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {categories?.map((c) => (
            <Link key={c.id} href={`/shop/c/${c.slug}`}>
              <Card className="group p-4 bg-card/50 hover:bg-card hover:border-primary/50 border-border/40 transition-all cursor-pointer aspect-square flex flex-col items-center justify-center text-center gap-2 hover:shadow-[0_0_20px_rgba(var(--primary),0.15)]">
                <div className="text-3xl group-hover:scale-110 transition-transform">{c.iconEmoji}</div>
                <p className="text-xs font-bold uppercase tracking-tight leading-tight">{c.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{c.productCount}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Bestsellers */}
      <section className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />
            Bestsellers
          </h2>
          <Link href="/shop?filter=bestsellers">
            <Button variant="ghost" size="sm" className="font-mono text-xs">View all <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {bestsellers?.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* New */}
      {newProducts && newProducts.length > 0 && (
        <section className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-secondary" />
              New Arrivals
            </h2>
            <Link href="/shop?filter=new">
              <Button variant="ghost" size="sm" className="font-mono text-xs">View all <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {newProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Community teaser */}
      <section className="container mx-auto max-w-6xl px-4 py-12 border-t border-border/40">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 p-8 bg-gradient-to-br from-primary/10 via-card/50 to-secondary/10 border-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.2),transparent_50%)]" />
            <div className="relative space-y-4">
              <MessageSquare className="w-8 h-8 text-primary" />
              <h3 className="text-2xl font-black uppercase tracking-tight">Join the Community</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {stats ? `${stats.totalUsers.toLocaleString()} vapers • ${stats.totalPosts.toLocaleString()} posts • ${stats.onlineNow} online now` : "A real community of cloud chasers"}
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Read reviews, share builds, get advice on gear. Our forum is where the best product picks come from.
              </p>
              <Link href="/forum">
                <Button className="rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground font-mono text-xs uppercase tracking-wider gap-2">
                  Visit forum <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </Card>
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Trending in the community</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {trendingPosts?.slice(0, 4).map((p) => (
                <PostCard key={p.id} post={p} compact />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
