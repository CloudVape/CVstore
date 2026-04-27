import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, MessageSquare } from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

const CATEGORIES = [
  { value: "orders", label: "Orders & Shipping" },
  { value: "returns", label: "Returns & Refunds" },
  { value: "product", label: "Product Questions" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

export default function Contact() {
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    orderNumber: "",
    category: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const body: Record<string, string> = {
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        category: form.category,
        message: form.message,
      };
      if (form.orderNumber.trim()) body.orderNumber = form.orderNumber.trim();

      const r = await fetch(`${BASE}/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Submission failed");
      setTicketId(data.ticketId);
      setStatus("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  const isValid =
    form.customerName.trim() &&
    form.customerEmail.trim() &&
    form.category &&
    form.message.trim().length >= 10;

  if (status === "success" && ticketId) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold font-mono mb-2">We've got your message!</h1>
        <div className="inline-block bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 mb-4">
          <span className="font-mono text-primary text-sm">Ticket #{ticketId}</span>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          We've sent a confirmation to <strong>{form.customerEmail}</strong>. Our team will reply by email —
          keep the ticket number in the subject when you reply so everything threads together.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/help">
            <Button variant="outline" className="font-mono text-xs">Browse Help Center</Button>
          </Link>
          <Link href="/">
            <Button className="rounded-full bg-primary font-mono text-xs uppercase tracking-wider">Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
          <MessageSquare className="h-3.5 w-3.5" />
          Contact Us
        </div>
        <h1 className="text-3xl font-bold font-mono mb-2">Get in touch</h1>
        <p className="text-muted-foreground text-sm">
          Fill in the form below and we'll reply by email. You can also{" "}
          <Link href="/help" className="text-primary hover:underline">search our help center</Link> for quick answers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="font-mono text-xs uppercase tracking-wider">Name *</Label>
            <Input
              id="name"
              value={form.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wider">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.customerEmail}
              onChange={(e) => set("customerEmail", e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="category" className="font-mono text-xs uppercase tracking-wider">Topic *</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a topic…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order" className="font-mono text-xs uppercase tracking-wider">Order Number (optional)</Label>
            <Input
              id="order"
              value={form.orderNumber}
              onChange={(e) => set("orderNumber", e.target.value)}
              placeholder="e.g. VC-ABCDEF-1234"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message" className="font-mono text-xs uppercase tracking-wider">Message *</Label>
          <Textarea
            id="message"
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Describe your issue or question in detail…"
            rows={6}
            required
          />
          <p className="text-xs text-muted-foreground text-right font-mono">{form.message.length} / 5000</p>
        </div>

        {(status === "error") && (
          <p className="text-sm text-red-400 font-mono">{error}</p>
        )}

        <Button
          type="submit"
          disabled={!isValid || status === "submitting"}
          className="w-full rounded-full bg-primary hover:bg-primary/90 font-mono uppercase tracking-wider"
        >
          {status === "submitting" ? "Sending…" : "Send Message"}
        </Button>
      </form>
    </div>
  );
}
