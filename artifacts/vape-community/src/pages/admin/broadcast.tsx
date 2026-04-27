import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminApi, type NewsletterSubscriber } from "@/lib/admin-api";
import { AdminShell } from "./admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, Eye } from "lucide-react";

export default function AdminBroadcast() {
  const { user } = useAuth();
  const token = user?.sessionToken ?? null;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);

  const { data: subs = [] } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: () => adminApi.listSubscribers(token!),
    enabled: !!token,
  });

  const confirmedCount = (subs as NewsletterSubscriber[]).filter((s) => s.status === "confirmed").length;

  const sendMutation = useMutation({
    mutationFn: () =>
      adminApi.sendBroadcast(token!, {
        subject,
        bodyHtml: body.replace(/\n/g, "<br/>"),
        bodyText: body,
      }),
    onSuccess: (data) => {
      toast({ title: "Broadcast sent!", description: data.message });
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-email-log"] });
    },
    onError: (err: Error) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Missing content", description: "Subject and body are required.", variant: "destructive" });
      return;
    }
    if (confirmedCount === 0) {
      toast({ title: "No subscribers", description: "There are no confirmed subscribers to send to.", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  }

  return (
    <AdminShell>
      <div className="max-w-2xl space-y-6">
        <div className="rounded-lg border border-border bg-card/50 p-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Confirmed Subscribers</p>
            <p className="text-2xl font-black font-mono text-primary mt-0.5">{confirmedCount}</p>
          </div>
          <Send className="h-8 w-8 text-muted-foreground opacity-30" />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Subject line</Label>
            <Input
              placeholder="New drops just landed 🔥"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-background/50 border-border/50 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Body</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreview(!preview)}
                className="h-7 text-xs font-mono gap-1"
              >
                <Eye className="h-3 w-3" />
                {preview ? "Edit" : "Preview"}
              </Button>
            </div>
            {preview ? (
              <div
                className="min-h-[200px] rounded-lg border border-border bg-background/50 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, "<br/>") }}
              />
            ) : (
              <Textarea
                placeholder="Write your email body here. You can use basic HTML like <b>bold</b> and <a href='...'>links</a>."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[200px] bg-background/50 border-border/50 font-mono text-sm resize-y"
              />
            )}
            <p className="text-[11px] text-muted-foreground font-mono">
              Tip: basic HTML is supported — &lt;b&gt;, &lt;a&gt;, &lt;ul&gt;, etc.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || !subject.trim() || !body.trim()}
              className="rounded-full bg-primary hover:bg-primary/90 font-mono text-xs uppercase tracking-wider gap-2 shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending
                ? `Sending to ${confirmedCount}...`
                : `Send to ${confirmedCount} subscriber${confirmedCount !== 1 ? "s" : ""}`}
            </Button>
          </div>

          {confirmedCount === 0 && (
            <p className="text-xs text-amber-500 font-mono">
              No confirmed subscribers yet. Share the subscribe form (in the site footer) to grow your list.
            </p>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
