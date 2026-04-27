import { Link } from "wouter";
import { Star, ShoppingCart, Sparkles, Flame } from "lucide-react";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast({
      title: "Added to cart",
      description: `${product.name} — ${formatPrice(product.priceCents)}`,
    });
  };

  const discount = product.comparePriceCents
    ? Math.round((1 - product.priceCents / product.comparePriceCents) * 100)
    : 0;

  return (
    <Link href={`/shop/p/${product.slug}`}>
      <Card className="group relative overflow-hidden border-border/40 bg-card/50 hover:bg-card hover:border-primary/50 transition-all cursor-pointer h-full flex flex-col shadow-sm hover:shadow-[0_0_25px_rgba(0,0,0,0.4)]">
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/30 to-background border-b border-border/40">
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.isNew && (
              <Badge className="bg-secondary text-secondary-foreground border-0 font-mono text-[9px] uppercase tracking-wider gap-1 shadow-[0_0_10px_rgba(var(--secondary),0.4)]">
                <Sparkles className="w-2.5 h-2.5" /> New
              </Badge>
            )}
            {product.isBestseller && (
              <Badge className="bg-primary text-primary-foreground border-0 font-mono text-[9px] uppercase tracking-wider gap-1 shadow-[0_0_10px_rgba(var(--primary),0.4)]">
                <Flame className="w-2.5 h-2.5" /> Bestseller
              </Badge>
            )}
          </div>
          {discount > 0 && (
            <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider shadow-lg">
              -{discount}%
            </div>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col flex-1 gap-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{product.brand}</p>
          <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <Star className="w-3 h-3 fill-primary text-primary" />
            <span>{Number(product.rating).toFixed(1)}</span>
            <span className="opacity-50">({product.reviewCount})</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-end justify-between gap-2 pt-2">
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight text-foreground">{formatPrice(product.priceCents)}</span>
              {product.comparePriceCents && (
                <span className="text-xs text-muted-foreground line-through font-mono">
                  {formatPrice(product.comparePriceCents)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!product.inStock}
              className="rounded-full h-9 w-9 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)] hover:shadow-[0_0_20px_rgba(var(--primary),0.5)]"
              aria-label="Add to cart"
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  );
}
