import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminApi, type AdminOrder } from "@/lib/admin-api";
import { AdminShell } from "./admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";

const STATUS_OPTIONS = ["pending", "shipped", "delivered", "refunded", "cancelled"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-500",
    shipped: "bg-blue-500/15 text-blue-500",
    delivered: "bg-green-500/15 text-green-500",
    refunded: "bg-orange-500/15 text-orange-500",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

export default function AdminOrders() {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [updating, setUpdating] = useState<AdminOrder | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [tracking, setTracking] = useState("");

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => { const token = await getToken(); return adminApi.listOrders(token!); },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return adminApi.updateOrderStatus(token!, updating!.orderNumber, {
        status: newStatus,
        trackingNumber: tracking || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Order updated", description: `Order status changed to ${newStatus}. Email sent automatically.` });
      setUpdating(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-email-log"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  function openUpdate(order: AdminOrder) {
    setUpdating(order);
    setNewStatus(order.status);
    setTracking(order.trackingNumber ?? "");
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 font-mono text-xs">
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm font-mono">Loading...</p>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-mono text-sm">No orders yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Order</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Customer</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden md:table-cell">Total</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Date</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(orders as AdminOrder[]).map((order) => (
                  <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-primary font-bold">{order.orderNumber}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground hidden sm:table-cell">
                      <div>{order.customerName}</div>
                      <div className="text-[10px] text-muted-foreground">{order.email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground hidden md:table-cell">
                      ${(order.totalCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground hidden lg:table-cell">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs font-mono"
                        onClick={() => openUpdate(order)}
                      >
                        Update
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!updating} onOpenChange={(open) => !open && setUpdating(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono">{updating?.orderNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground font-mono">
                Changing to shipped, delivered, or refunded will automatically send the customer an email.
              </p>
            </div>
            {newStatus === "shipped" && (
              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Tracking Number <span className="opacity-50">(optional)</span></Label>
                <Input
                  placeholder="1Z999AA10123456784"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="font-mono text-sm bg-background/50"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdating(null)} className="font-mono text-xs">Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="rounded-full bg-primary hover:bg-primary/90 font-mono text-xs"
            >
              {updateMutation.isPending ? "Saving..." : "Save & Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
