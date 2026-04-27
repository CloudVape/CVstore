import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Cloud, LogOut, User, Menu, MessageSquare, Home, Grid } from "lucide-react";
import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/forum", label: "Forum", icon: MessageSquare },
    { href: "/categories", label: "Categories", icon: Grid },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/" className="mr-6 flex items-center space-x-2 transition-opacity hover:opacity-80">
            <Cloud className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-mono tracking-tight text-lg">
              VAPE<span className="text-primary">COMMUNITY</span>
            </span>
          </Link>
          
          <nav className="flex items-center space-x-1 sm:space-x-4 md:space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors hover:text-foreground/80 flex items-center gap-2 ${
                  location === item.href ? "text-foreground" : "text-foreground/60"
                }`}
              >
                <item.icon className="h-4 w-4 hidden sm:block" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link href={`/profile/${user.id}`}>
                  <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-mono text-xs">{user.username}</span>
                  </Button>
                </Link>
                <Button variant="destructive" size="sm" onClick={handleLogout} className="gap-2 rounded-full font-mono uppercase text-xs tracking-wider">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-mono text-xs uppercase tracking-wider">Log in</Button>
                </Link>
                <Link href="/join">
                  <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(var(--primary),0.3)]">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="border-t border-border/40 py-8 bg-card mt-auto">
        <div className="container mx-auto max-w-6xl px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cloud className="h-5 w-5" />
            <span className="font-mono text-sm">VAPECOMMUNITY &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground font-mono">
            <span>Keep it cloudy.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}