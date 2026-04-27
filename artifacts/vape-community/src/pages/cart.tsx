import { Link } from "wouter";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { Minus, Plus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function Cart() {
  useSeo({ title: "Cart", description: "Your CloudVape shopping cart.", canonical: "/cart", robots: "noindex, nofollow" });
  const { items, subtotalCents, updateQuantity, removeItem } = useCart();

  const shippingCents = subtotalCents >= 5000 ? 0 : subtotalCents > 0 ? 399 : 0;
  const totalCents = subtotalCents + shippingCents;
  const amountToFreeShipping = Math.max(0, 5000 - subtotalCents);

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center space-y-6">
        <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground/50" />
        <h1 className="text-3xl font-black uppercase tracking-tight">Your cart is empty</h1>
        <p className="text-muted-foreground font-mono text-sm">Time to fill it with clouds.</p>
        <Link href="/">
          <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            Browse the shop
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Your Cart</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">{items.length} item{items.length === 1 ? "" : "s"}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <Card key={item.productId} className="p-4 bg-card/50 border-border/40 flex gap-4">
              <Link href={`/shop/p/${item.slug}`} className="shrink-0">
                <img src={item.imageUrl} alt={item.name} className="w-24 h-24 object-cover rounded-lg border border-border/40" />
              </Link>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{item.brand}</p>
                    <Link href={`/shop/p/${item.slug}`}>
                      <h3 className="font-semibold text-sm hover:text-primary transition-colors line-clamp-2">{item.name}</h3>
                    </Link>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                    aria-label="Remove from cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-auto gap-3">
                  <div className="flex items-center border border-border/50 rounded-full bg-background/50">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 font-mono text-sm w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-bold tracking-tight">{formatPrice(item.priceCents * item.quantity)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="p-6 bg-card/50 border-border/40 sticky top-24 space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight border-b border-border/40 pb-3">Order Summary</h2>

            {amountToFreeShipping > 0 && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs font-mono text-primary flex items-start gap-2">
                <Truck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Add <strong>{formatPrice(amountToFreeShipping)}</strong> more for free shipping</span>
              </div>
            )}

            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shippingCents === 0 ? <span className="text-primary">Free</span> : formatPrice(shippingCents)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-3 border-t border-border/40">
                <span>Total</span>
                <span className="text-primary">{formatPrice(totalCents)}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground text-right">Includes 20% VAT</p>
            </div>

            <Link href="/checkout" className="block">
              <Button
                size="lg"
                className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)]"
              >
                Checkout
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="ghost" size="sm" className="w-full font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Continue shopping
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
