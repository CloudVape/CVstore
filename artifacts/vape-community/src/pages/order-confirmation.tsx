import { useRoute, Link } from "wouter";
import { useGetOrderByNumber } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { CheckCircle2, Package, Mail } from "lucide-react";

export default function OrderConfirmation() {
  const [, params] = useRoute("/order/:orderNumber");
  const orderNumber = params?.orderNumber ?? "";
  const { data: order, isLoading } = useGetOrderByNumber(orderNumber);

  if (isLoading) {
    return <div className="container mx-auto max-w-2xl px-4 py-20 text-center font-mono text-muted-foreground">Loading order...</div>;
  }
  if (!order) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-black uppercase">Order not found</h1>
        <Link href="/"><Button>Back to shop</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 border border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.3)]">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Order confirmed</h1>
        <p className="text-muted-foreground font-mono text-sm">
          Thanks {order.customerName}! Your order is being prepared.
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          Order # <span className="text-primary">{order.orderNumber}</span>
        </p>
      </div>

      <Card className="p-6 bg-card/50 border-border/40 space-y-4">
        <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-3 flex items-center gap-2">
          <Package className="w-4 h-4" /> Items
        </h2>
        <div className="space-y-3">
          {order.items.map((i, idx) => (
            <div key={idx} className="flex gap-3 items-center">
              <img src={i.imageUrl} alt={i.name} className="w-14 h-14 object-cover rounded border border-border/40" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{i.brand}</p>
                <p className="text-sm font-semibold line-clamp-1">{i.name}</p>
                <p className="text-xs font-mono text-muted-foreground">Qty {i.quantity}</p>
              </div>
              <p className="font-mono text-sm">{formatPrice(i.priceCents * i.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm font-mono pt-4 border-t border-border/40">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(order.subtotalCents)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shippingCents === 0 ? <span className="text-primary">Free</span> : formatPrice(order.shippingCents)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatPrice(order.taxCents)}</span></div>
          <div className="flex justify-between text-base font-bold pt-3 border-t border-border/40">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.totalCents)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-card/50 border-border/40 space-y-3">
        <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-3 flex items-center gap-2">
          <Mail className="w-4 h-4" /> Shipping to
        </h2>
        <div className="text-sm font-mono">
          <p>{order.customerName}</p>
          <p className="text-muted-foreground">{order.shippingAddress}</p>
          <p className="text-muted-foreground">{order.shippingCity}, {order.shippingState} {order.shippingZip}</p>
          <p className="text-muted-foreground">{order.shippingCountry}</p>
        </div>
        <p className="text-xs font-mono text-muted-foreground border-t border-border/40 pt-3">
          A confirmation email has been sent to <span className="text-foreground">{order.email}</span>
        </p>
      </Card>

      <div className="text-center pt-4">
        <Link href="/">
          <Button size="lg" variant="outline" className="rounded-full font-mono uppercase tracking-wider">
            Continue shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
