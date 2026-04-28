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
import { Info } from "lucide-react";

export default function AdminSettings() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [alertEmail, setAlertEmail] = useState("");
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
      setInitialised(true);
    }
  }, [data, initialised]);

  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const token = await getToken();
      return adminApi.updateSettings(token!, { alertEmail: email });
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "Settings saved", description: "Alert email updated successfully." });
    },
    onError(err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(alertEmail);
  }

  return (
    <AdminShell>
      <h2 className="text-lg font-semibold font-mono mb-6">Settings</h2>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-mono">Alert Email</CardTitle>
          <CardDescription>
            Supplier sync failure notifications are sent to this address. Changes take effect
            immediately without restarting the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Currently sending to:{" "}
                    <span className="font-mono">{data.alertEmailEffective}</span>
                    {data.alertEmailIsDefault && (
                      <span className="text-muted-foreground/70">(default)</span>
                    )}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
