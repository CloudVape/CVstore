import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Boxes, History, Upload, Mail, Users, Send, Package } from "lucide-react";

const tabs = [
  { href: "/admin/suppliers", label: "Suppliers", icon: Boxes },
  { href: "/admin/import", label: "Import Feed", icon: Upload },
  { href: "/admin/runs", label: "Import History", icon: History },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/email-log", label: "Email Log", icon: Mail },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/broadcast", label: "Broadcast", icon: Send },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Non-admins are bounced away from /admin/* — anonymous visitors go to the
  // login page, signed-in non-admins go back to the storefront. We don't
  // render an in-place denial panel because the design calls for redirects.
  useEffect(() => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in with an admin account to access this area.",
      });
      setLocation("/login");
      return;
    }
    if (!user.isAdmin) {
      toast({
        title: "Admin access required",
        description: "Your account does not have admin privileges.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [user, setLocation, toast]);

  if (!user || !user.isAdmin) {
    // Render nothing while the redirect is in flight so the admin UI never
    // briefly flashes for unauthorized visitors.
    return null;
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-primary">
            Admin
          </p>
          <h1 className="text-2xl font-bold font-mono">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage suppliers, orders, email and newsletter.
          </p>
        </div>
      </div>
      <nav className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((t) => {
          const isActive =
            location === t.href || location.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
