import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetProductBySlug, useListProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProductCard } from "@/components/product-card";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";
import { Star, Sparkles, Flame, Truck, Shield, RefreshCw, ChevronLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { useSeo, JsonLd, breadcrumbJsonLd, productJsonLd } from "@/lib/seo";

export default function ProductDetail() {
  const [, params] = useRoute("/shop/p/:slug");
  const slug = params?.slug ?? "";
  const [, setLocation] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const { toast } = useToast();

  const { data: product, isLoading } = useGetProductBySlug(slug);
  const { data: related } = useListProducts(
    { categoryId: product?.categoryId, limit: 8 },
    { query: { enabled: !!product?.categoryId } }
  );

  const seoTitle = product ? `${product.name} — ${product.brand}` : "Product";
  const seoDescription = product
    ? (product.shortDescription || product.description || "").slice(0, 200)
    : "VapeVault product";
  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonical: `/shop/p/${slug}`,
    image: product?.imageUrl ?? undefined,
    type: "product",
    keywords: product
      ? [product.brand, product.name, product.categoryName ?? "vape", ...(product.tags ?? [])].filter(Boolean) as string[]
      : undefined,
  });

  if (isLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-20 text-center font-mono text-muted-foreground">Loading product...</div>;
  }
  if (!product) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-black uppercase">Product not found</h1>
        <Link href="/"><Button>Back to shop</Button></Link>
      </div>
    );
  }

  const handleAdd = () => {
    addItem(product, quantity);
    toast({
      title: "Added to cart",
      description: `${quantity} × ${product.name}`,
    });
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    setLocation("/cart");
  };

  const discount = product.comparePriceCents
    ? Math.round((1 - product.priceCents / product.comparePriceCents) * 100)
    : 0;

  const otherProducts = related?.filter((p) => p.id !== product.id).slice(0, 4) ?? [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-12">
      <JsonLd id={`product-${product.id}`} data={productJsonLd(product)} />
      <JsonLd
        id={`product-bc-${product.id}`}
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          ...(product.categoryName && product.categorySlug
            ? [{ name: product.categoryName, url: `/shop/c/${product.categorySlug}` }]
            : []),
          { name: product.name, url: `/shop/p/${product.slug}` },
        ])}
      />
      <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Shop
        </Link>
        {product.categoryName && (
          <>
            <span className="opacity-40">/</span>
            <Link href={`/shop/c/${product.categorySlug}`} className="hover:text-foreground transition-colors">
              {product.categoryName}
            </Link>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="relative">
          <div className="relative aspect-square bg-gradient-to-br from-card to-background rounded-2xl overflow-hidden border border-border/40">
            <img
              src={product.imageUrl}
              alt={`${product.name} by ${product.brand}`}
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.isNew && (
                <Badge className="bg-secondary text-secondary-foreground border-0 font-mono uppercase tracking-wider gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" /> New
                </Badge>
              )}
              {product.isBestseller && (
                <Badge className="bg-primary text-primary-foreground border-0 font-mono uppercase tracking-wider gap-1 shadow-lg">
                  <Flame className="w-3 h-3" /> Bestseller
                </Badge>
              )}
              {discount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground border-0 font-mono uppercase tracking-wider shadow-lg">
                  Save {discount}%
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{product.brand}</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-2 text-sm font-mono">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= Math.round(Number(product.rating)) ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <span className="text-muted-foreground">{Number(product.rating).toFixed(1)}</span>
              <span className="text-muted-foreground opacity-60">({product.reviewCount} reviews)</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black tracking-tight">{formatPrice(product.priceCents)}</span>
            {product.comparePriceCents && (
              <span className="text-lg text-muted-foreground line-through font-mono">
                {formatPrice(product.comparePriceCents)}
              </span>
            )}
          </div>

          <p className="text-foreground/80 leading-relaxed">{product.shortDescription}</p>

          {(product.flavor || product.nicotineStrength || product.vgPgRatio || product.bottleSize) && (
            <Card className="bg-card/40 border-border/40 p-4 space-y-2 text-sm font-mono">
              {product.flavor && <div className="flex justify-between"><span className="text-muted-foreground uppercase text-xs tracking-wider">Flavor</span><span>{product.flavor}</span></div>}
              {product.nicotineStrength && <div className="flex justify-between"><span className="text-muted-foreground uppercase text-xs tracking-wider">Nicotine</span><span>{product.nicotineStrength}</span></div>}
              {product.vgPgRatio && <div className="flex justify-between"><span className="text-muted-foreground uppercase text-xs tracking-wider">VG/PG</span><span>{product.vgPgRatio}</span></div>}
              {product.bottleSize && <div className="flex justify-between"><span className="text-muted-foreground uppercase text-xs tracking-wider">Size</span><span>{product.bottleSize}</span></div>}
            </Card>
          )}

          <div className="flex items-center gap-3 text-sm font-mono">
            <span className={`h-2 w-2 rounded-full ${product.inStock ? "bg-primary animate-pulse" : "bg-destructive"}`} />
            <span className={product.inStock ? "text-primary" : "text-destructive"}>
              {product.inStock ? `In stock — ${product.stockCount} available` : "Out of stock"}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border border-border/50 rounded-full bg-card/50">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 font-mono text-sm w-10 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <Button
              size="lg"
              onClick={handleAdd}
              disabled={!product.inStock}
              className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(var(--primary),0.4)] hover:shadow-[0_0_30px_rgba(var(--primary),0.6)] gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Add to Cart
            </Button>
          </div>
          <Button
            size="lg"
            variant="outline"
            onClick={handleBuyNow}
            disabled={!product.inStock}
            className="rounded-full border-secondary/40 hover:bg-secondary/10 hover:border-secondary text-foreground font-mono uppercase tracking-wider"
          >
            Buy it now
          </Button>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/40 text-center text-xs font-mono">
            <div className="space-y-1">
              <Truck className="w-5 h-5 mx-auto text-primary/80" />
              <p className="text-muted-foreground">Free over $50</p>
            </div>
            <div className="space-y-1">
              <Shield className="w-5 h-5 mx-auto text-primary/80" />
              <p className="text-muted-foreground">Authentic only</p>
            </div>
            <div className="space-y-1">
              <RefreshCw className="w-5 h-5 mx-auto text-primary/80" />
              <p className="text-muted-foreground">30-day returns</p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4 border-t border-border/40 pt-8">
        <h2 className="text-xl font-black uppercase tracking-tight">Description</h2>
        <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{product.description}</p>
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {product.tags.map((t) => (
              <Badge key={t} variant="outline" className="font-mono text-[10px] uppercase">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {otherProducts.length > 0 && (
        <section className="space-y-6 border-t border-border/40 pt-8">
          <h2 className="text-xl font-black uppercase tracking-tight">You might also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {otherProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
