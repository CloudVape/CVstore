import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Cloud, LogOut, User, ShoppingCart, Store, MessageSquare, Grid, Shield } from "lucide-react";
import { ReactNode } from "react";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { ThemeToggle } from "@/components/theme-toggle";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Shop", icon: Store },
    { href: "/shop/categories", label: "Categories", icon: Grid },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <JsonLd id="org" data={organizationJsonLd()} />
      <JsonLd id="website" data={websiteJsonLd()} />
      <div className="w-full bg-primary/10 border-b border-primary/20 text-center py-1.5 text-[11px] font-mono uppercase tracking-wider text-primary">
        Free shipping on orders over $50 — Same-day dispatch before 3pm EST
      </div>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center px-3 sm:px-4 gap-2 sm:gap-0">
          <Link href="/" className="mr-2 sm:mr-6 flex items-center gap-2 transition-opacity hover:opacity-80 shrink-0">
            <Cloud className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-mono tracking-tight text-lg">
              VAPE<span className="text-primary">VAULT</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-4 md:gap-6 text-sm font-medium min-w-0 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive = item.href === "/"
                ? location === "/" || location.startsWith("/shop")
                : location === item.href || location.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors hover:text-foreground/90 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full px-3 sm:px-1 py-2 sm:py-0 min-h-10 sm:min-h-0 ${
                    isActive ? "text-foreground bg-foreground/5 sm:bg-transparent" : "text-foreground/60"
                  }`}
                >
                  <item.icon className="h-4 w-4 hidden sm:block" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-1 items-center justify-end space-x-1 sm:space-x-3 min-w-0">
            <ThemeToggle />
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="relative gap-2 px-2 sm:px-3" aria-label="Cart">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-mono font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-[0_0_10px_rgba(var(--primary),0.5)]">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>
            {user ? (
              <>
                {user.isAdmin && (
                  <Link href="/admin/suppliers">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 font-mono text-xs uppercase tracking-wider px-2 sm:px-3"
                      aria-label="Admin"
                      title="Admin"
                    >
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="hidden sm:inline">Admin</span>
                    </Button>
                  </Link>
                )}
                <Link href={`/profile/${user.id}`}>
                  <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 px-3">
                    <User className="h-4 w-4" />
                    <span className="font-mono text-xs">{user.username}</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={logout} className="gap-2 font-mono text-xs uppercase tracking-wider px-2 sm:px-3" aria-label="Logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-mono text-xs uppercase tracking-wider hidden sm:flex">Log in</Button>
                </Link>
                <Link href="/join">
                  <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(var(--primary),0.3)] px-3 sm:px-4">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="border-t border-border/40 py-10 bg-card/50 mt-auto">
        <div className="container mx-auto max-w-6xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link href="/" className="flex items-center gap-2 text-foreground">
              <Cloud className="h-5 w-5 text-primary" />
              <span className="font-bold font-mono tracking-tight">
                VAPE<span className="text-primary">VAULT</span>
              </span>
            </Link>
            <p className="text-muted-foreground text-xs leading-relaxed">
              The shop and community for cloud chasers and flavor enthusiasts. 21+ only.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Shop</p>
            <Link href="/" className="block text-foreground/80 hover:text-primary transition-colors">All Products</Link>
            <Link href="/shop/categories" className="block text-foreground/80 hover:text-primary transition-colors">Categories</Link>
            <Link href="/shop?filter=new" className="block text-foreground/80 hover:text-primary transition-colors">New Arrivals</Link>
            <Link href="/shop?filter=bestsellers" className="block text-foreground/80 hover:text-primary transition-colors">Bestsellers</Link>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Community</p>
            <Link href="/forum" className="block text-foreground/80 hover:text-primary transition-colors">Forum</Link>
            <Link href="/categories" className="block text-foreground/80 hover:text-primary transition-colors">Topics</Link>
            <Link href="/join" className="block text-foreground/80 hover:text-primary transition-colors">Join</Link>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Help</p>
            <span className="block text-foreground/80">Shipping & Returns</span>
            <span className="block text-foreground/80">FAQ</span>
            <span className="block text-foreground/80">Contact</span>
          </div>
        </div>
        <div className="container mx-auto max-w-6xl px-4 mt-8 pt-6 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-muted-foreground font-mono">
          <span>VAPEVAULT &copy; {new Date().getFullYear()} — Keep it cloudy.</span>
          <span>Must be 21+ to purchase. Vaping products contain nicotine.</span>
        </div>
      </footer>
    </div>
  );
}
