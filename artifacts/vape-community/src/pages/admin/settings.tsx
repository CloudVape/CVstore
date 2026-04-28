import { useState, useEffect } from "react";
import { AdminShell } from "./admin-shell";
import { useAuth } from "@/lib/auth";
import { adminApi } from "@/lib/admin-api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Mail } from "lucide-react";

function EffectiveHint({ value, isDefault }: { value: string; isDefault: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0" />
      Currently using:{" "}
      <span className="font-mono">{value}</span>
      {isDefault && <span className="text-muted-foreground/70">(default)</span>}
    </p>
  );
}

export default function AdminSettings() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [alertEmail, setAlertEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [initialised, setInitialised] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getSettings(token!);
    },
  });

  useEffect(() => {
    if (!initialised && data !== undefined) {
      setAlertEmail(data.alertEmail ?? "");
      setSiteUrl(data.siteUrl ?? "");
      setInitialised(true);
    }
  }, [data, initialised]);

  const emailMutation = useMutation({
    mutationFn: async (email: string) => {
      const token = await getToken();
      return adminApi.updateSettings(token!, { alertEmail: email });
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "Saved", description: "Alert email updated." });
    },
    onError(err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const siteUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const token = await getToken();
      return adminApi.updateSettings(token!, { siteUrl: url });
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "Saved", description: "Site URL updated." });
    },
    onError(err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const settingsSkeleton = (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-24" />
    </div>
  );

  return (
    <AdminShell>
      <h2 className="text-lg font-semibold font-mono mb-6">Settings</h2>
      <div className="flex flex-col gap-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono">Alert Email</CardTitle>
            <CardDescription>
              Supplier sync failure notifications are sent to this address. Changes take
              effect immediately without restarting the server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              settingsSkeleton
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  emailMutation.mutate(alertEmail);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="alert-email">Alert email address</Label>
                  <Input
                    id="alert-email"
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                  {data && (
                    <EffectiveHint
                      value={data.alertEmailEffective}
                      isDefault={data.alertEmailIsDefault}
                    />
                  )}
                </div>
                <Button type="submit" disabled={emailMutation.isPending}>
                  {emailMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono">Site URL</CardTitle>
            <CardDescription>
              The public URL of this store, used in outgoing emails for links back to the
              site (order pages, supplier alert history, newsletter confirmation, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              settingsSkeleton
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  siteUrlMutation.mutate(siteUrl);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="site-url">Site URL</Label>
                  <Input
                    id="site-url"
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://cloudvape.store"
                    required
                  />
                  {data && (
                    <EffectiveHint
                      value={data.siteUrlEffective}
                      isDefault={data.siteUrlIsDefault}
                    />
                  )}
                </div>
                <Button type="submit" disabled={siteUrlMutation.isPending}>
                  {siteUrlMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-mono flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Addresses
            </CardTitle>
            <CardDescription>
              The five addresses used by the platform and their roles. All are set as
              environment variables so Resend uses them explicitly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                {
                  addr: "support@cloudvape.store",
                  role: "Transactional",
                  desc: "Order confirmations, shipping updates, support replies, supplier alerts.",
                },
                {
                  addr: "hello@cloudvape.store",
                  role: "Marketing",
                  desc: "Newsletter broadcasts and promotional emails.",
                },
                {
                  addr: "noreply@cloudvape.store",
                  role: "No-reply",
                  desc: "Newsletter subscription confirmations and other automated emails that should not be replied to.",
                },
                {
                  addr: "admin@cloudvape.store",
                  role: "Admin alerts",
                  desc: "Fallback address for internal admin notifications (e.g. supplier sync failures).",
                },
                {
                  addr: "support@cloudvape.store",
                  role: "Reply-To",
                  desc: "Shown as the reply-to address on marketing emails so replies reach the support inbox.",
                },
              ].map(({ addr, role, desc }) => (
                <div key={role} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                      {addr}
                    </code>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">
                      {role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-1">{desc}</p>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
