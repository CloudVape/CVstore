import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart";
import { useCreateOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useSeo } from "@/lib/seo";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";
import { Lock, ChevronLeft } from "lucide-react";

export default function Checkout() {
  useSeo({ title: "Checkout", description: "Complete your CloudVape order.", canonical: "/checkout", robots: "noindex, nofollow" });
  const { items, subtotalCents, clear } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createOrder = useCreateOrder();

  const [form, setForm] = useState({
    email: "",
    customerName: "",
    shippingAddress: "",
    shippingCity: "",
    shippingState: "",
    shippingZip: "",
    shippingCountry: "US",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
  });

  const shippingCents = subtotalCents >= 5000 ? 0 : 599;
  const taxCents = Math.round(subtotalCents * 0.0875);
  const totalCents = subtotalCents + shippingCents + taxCents;

  if (items.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-black uppercase tracking-tight">Your cart is empty</h1>
        <Link href="/"><Button>Back to shop</Button></Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const order = await createOrder.mutateAsync({
        data: {
          email: form.email,
          customerName: form.customerName,
          shippingAddress: form.shippingAddress,
          shippingCity: form.shippingCity,
          shippingState: form.shippingState,
          shippingZip: form.shippingZip,
          shippingCountry: form.shippingCountry,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        },
      });
      clear();
      setLocation(`/order/${order.orderNumber}`);
    } catch (err) {
      toast({
        title: "Order failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const set = <K extends keyof typeof form>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      <Link href="/cart" className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to cart
      </Link>

      <div className="border-b border-border/40 pb-6 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Checkout</h1>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Lock className="w-3.5 h-3.5" /> Secure checkout
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-card/50 border-border/40 space-y-4">
            <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-3">Contact</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider">Email</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className="bg-background/50 mt-1" placeholder="you@example.com" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/50 border-border/40 space-y-4">
            <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-3">Shipping</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider">Full name</Label>
                <Input id="name" required value={form.customerName} onChange={(e) => set("customerName", e.target.value)} className="bg-background/50 mt-1" />
              </div>
              <div>
                <Label htmlFor="address" className="text-xs font-mono uppercase tracking-wider">Address</Label>
                <Input id="address" required value={form.shippingAddress} onChange={(e) => set("shippingAddress", e.target.value)} className="bg-background/50 mt-1" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label htmlFor="city" className="text-xs font-mono uppercase tracking-wider">City</Label>
                  <Input id="city" required value={form.shippingCity} onChange={(e) => set("shippingCity", e.target.value)} className="bg-background/50 mt-1" />
                </div>
                <div>
                  <Label htmlFor="state" className="text-xs font-mono uppercase tracking-wider">State</Label>
                  <Input id="state" required value={form.shippingState} onChange={(e) => set("shippingState", e.target.value)} className="bg-background/50 mt-1" />
                </div>
                <div>
                  <Label htmlFor="zip" className="text-xs font-mono uppercase tracking-wider">ZIP</Label>
                  <Input id="zip" required value={form.shippingZip} onChange={(e) => set("shippingZip", e.target.value)} className="bg-background/50 mt-1" />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/50 border-border/40 space-y-4">
            <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-3 flex items-center justify-between">
              <span>Payment</span>
              <span className="text-[10px] text-secondary normal-case tracking-normal">Demo only — no real charges</span>
            </h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="card" className="text-xs font-mono uppercase tracking-wider">Card number</Label>
                <Input id="card" required value={form.cardNumber} onChange={(e) => set("cardNumber", e.target.value)} className="bg-background/50 mt-1" placeholder="4242 4242 4242 4242" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="exp" className="text-xs font-mono uppercase tracking-wider">Expiry</Label>
                  <Input id="exp" required value={form.cardExpiry} onChange={(e) => set("cardExpiry", e.target.value)} className="bg-background/50 mt-1" placeholder="MM/YY" />
                </div>
                <div>
                  <Label htmlFor="cvc" className="text-xs font-mono uppercase tracking-wider">CVC</Label>
                  <Input id="cvc" required value={form.cardCvc} onChange={(e) => set("cardCvc", e.target.value)} className="bg-background/50 mt-1" placeholder="123" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="p-6 bg-card/50 border-border/40 sticky top-24 space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight border-b border-border/40 pb-3">Order</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {items.map((i) => (
                <div key={i.productId} className="flex gap-3 text-sm">
                  <div className="relative shrink-0">
                    <img src={i.imageUrl} alt={i.name} className="w-12 h-12 object-cover rounded border border-border/40" />
                    <span className="absolute -top-1 -right-1 bg-foreground/80 text-background text-[10px] font-mono rounded-full w-4 h-4 flex items-center justify-center">{i.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1">{i.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{i.brand}</p>
                  </div>
                  <span className="font-mono text-xs">{formatPrice(i.priceCents * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-sm font-mono pt-3 border-t border-border/40">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(subtotalCents)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shippingCents === 0 ? <span className="text-primary">Free</span> : formatPrice(shippingCents)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatPrice(taxCents)}</span></div>
              <div className="flex justify-between text-base font-bold pt-3 border-t border-border/40">
                <span>Total</span>
                <span className="text-primary">{formatPrice(totalCents)}</span>
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={createOrder.isPending}
              className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)]"
            >
              {createOrder.isPending ? "Placing order..." : `Pay ${formatPrice(totalCents)}`}
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}
