import { useState, FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Cloud, CheckCircle2, XCircle, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

type PageStatus = "form" | "submitting" | "success" | "error" | "missing-token";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [pageStatus, setPageStatus] = useState<PageStatus>(token ? "form" : "missing-token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [fieldError, setFieldError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError("");

    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setFieldError("Passwords do not match.");
      return;
    }

    setPageStatus("submitting");
    try {
      const r = await fetch(`${BASE}/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await r.json() as { message?: string; error?: string };
      if (r.ok) {
        setPageStatus("success");
        setMessage(data.message ?? "Password reset. Please log in.");
      } else {
        setPageStatus("error");
        setMessage(data.error ?? "Something went wrong.");
      }
    } catch {
      setPageStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Cloud className="h-8 w-8 text-primary" />
        <span className="font-bold font-mono tracking-tight text-xl">
          VAPE<span className="text-primary">VAULT</span>
        </span>
      </Link>

      {pageStatus === "missing-token" && (
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-black font-mono uppercase">Invalid Link</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-sm">
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <Link href="/login">
            <Button variant="outline" className="rounded-full font-mono text-xs uppercase tracking-wider mt-2">
              Back to Login
            </Button>
          </Link>
        </div>
      )}

      {(pageStatus === "form" || pageStatus === "submitting") && (
        <div className="w-full max-w-sm text-left">
          <div className="flex flex-col items-center mb-6">
            <KeyRound className="h-10 w-10 text-primary mb-3" />
            <h1 className="text-2xl font-black font-mono uppercase text-center">Reset Password</h1>
            <p className="text-muted-foreground font-mono text-sm text-center mt-1">Choose a new password for your account.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">New Password</Label>
              <Input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-background/50 border-border/50 font-mono"
                disabled={pageStatus === "submitting"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
              <Input
                type="password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="bg-background/50 border-border/50 font-mono"
                disabled={pageStatus === "submitting"}
              />
            </div>
            {fieldError && (
              <p className="text-red-500 text-xs font-mono">{fieldError}</p>
            )}
            <Button
              type="submit"
              disabled={pageStatus === "submitting"}
              className="w-full rounded-full bg-primary hover:bg-primary/90 font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
            >
              {pageStatus === "submitting" ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
              ) : "Set New Password"}
            </Button>
          </form>
        </div>
      )}

      {pageStatus === "success" && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <h1 className="text-2xl font-black font-mono uppercase">Password Reset!</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-sm">{message}</p>
          <Link href="/login">
            <Button className="rounded-full bg-primary hover:bg-primary/90 font-mono text-xs uppercase tracking-wider mt-2 shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
              Log In
            </Button>
          </Link>
        </div>
      )}

      {pageStatus === "error" && (
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-black font-mono uppercase">Reset Failed</h1>
          <p className="text-muted-foreground font-mono text-sm max-w-sm">{message}</p>
          <Link href="/login">
            <Button variant="outline" className="rounded-full font-mono text-xs uppercase tracking-wider mt-2">
              Back to Login
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
