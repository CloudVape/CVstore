import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { Link } from "wouter";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

export default function Settings() {
  useSeo({ title: "Settings", description: "Manage your CloudVape notification preferences.", robots: "noindex, nofollow" });
  const { user, isLoaded, getToken } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="h-48 rounded-xl bg-card/40 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-mono text-muted-foreground">
          You need to be signed in to view settings.{" "}
          <Link href="/sign-in" className="text-primary underline">Sign in</Link>
        </p>
      </div>
    );
  }

  async function toggleNotifications(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/users/me/notifications`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    } catch {
      setError("Couldn't save your preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-black uppercase tracking-tight mb-8">Settings</h1>

      <Card className="border-border/40 bg-card/40 backdrop-blur">
        <CardHeader>
          <CardTitle className="font-mono text-base uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label htmlFor="notif-toggle" className="text-base font-semibold cursor-pointer">
                Forum reply &amp; mention emails
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Get an email when someone replies to your post or @mentions you. Turn this off to stop receiving those alerts.
              </p>
            </div>
            <Switch
              id="notif-toggle"
              checked={user.notificationsEnabled ?? true}
              disabled={saving}
              onCheckedChange={toggleNotifications}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive font-mono">{error}</p>
          )}

          {!user.notificationsEnabled && (
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
              <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Notifications are off. You won't receive reply or mention emails.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
