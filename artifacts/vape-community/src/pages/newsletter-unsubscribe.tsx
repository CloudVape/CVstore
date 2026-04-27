import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Cloud, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

export default function NewsletterUnsubscribe() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing token.");
      return;
    }
    fetch(`${BASE}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (r.ok) {
          setStatus("success");
          setMessage(data.message ?? "You have been unsubscribed.");
        } else {
          setStatus("error");
          setMessage(data.error ?? "Something went wrong.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, []);

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Cloud className="h-8 w-8 text-primary" />
        <span className="font-bold font-mono tracking-tight text-xl">VAPE<span className="text-primary">VAULT</span></span>
      </Link>

      {status === "loading" && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="font-mono text-sm">Processing...</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h1 className="text-2xl font-black font-mono uppercase">Unsubscribed</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-sm">{message}</p>
          <p className="text-[12px] text-muted-foreground font-mono">You won't receive any more marketing emails from VapeVault.</p>
          <Link href="/">
            <Button variant="outline" className="rounded-full font-mono text-xs uppercase tracking-wider mt-2">
              Back to Shop
            </Button>
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-black font-mono uppercase">Error</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-sm">{message}</p>
          <Link href="/">
            <Button variant="outline" className="rounded-full font-mono text-xs uppercase tracking-wider mt-2">
              Go Home
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
