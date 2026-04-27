import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Boxes, History, Upload, Mail, Users, Send, Package, BookOpen, Headphones } from "lucide-react";

const tabs = [
  { href: "/admin/suppliers", label: "Suppliers", icon: Boxes },
  { href: "/admin/import", label: "Import Feed", icon: Upload },
  { href: "/admin/runs", label: "Import History", icon: History },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/email-log", label: "Email Log", icon: Mail },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/broadcast", label: "Broadcast", icon: Send },
  { href: "/admin/help-articles", label: "Help Center", icon: BookOpen },
  { href: "/admin/support", label: "Support Inbox", icon: Headphones },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in with an admin account to access this area.",
      });
      setLocation("/sign-in");
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
  }, [user, isLoaded, setLocation, toast]);

  if (!isLoaded || !user || !user.isAdmin) {
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
