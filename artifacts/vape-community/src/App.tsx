import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth as useClerkAuth } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSyncer } from "@/components/theme-syncer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import Home from "@/pages/home";
import Shop from "@/pages/shop";
import ProductDetail from "@/pages/product-detail";
import ShopCategories from "@/pages/shop-categories";
import CategoryDetail from "@/pages/category-detail";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import OrderConfirmation from "@/pages/order-confirmation";
import Forum from "@/pages/forum";
import PostDetail from "@/pages/post-detail";
import Categories from "@/pages/categories";
import Profile from "@/pages/profile";
import CreatePost from "@/pages/create-post";
import AdminSuppliers from "@/pages/admin/suppliers";
import AdminImporter from "@/pages/admin/importer";
import AdminRuns from "@/pages/admin/runs";
import AdminOrders from "@/pages/admin/orders";
import AdminEmailLog from "@/pages/admin/email-log";
import AdminSubscribers from "@/pages/admin/subscribers";
import AdminBroadcast from "@/pages/admin/broadcast";
import AdminHelpArticles from "@/pages/admin/help-articles";
import AdminSupport from "@/pages/admin/support";
import NewsletterConfirm from "@/pages/newsletter-confirm";
import NewsletterUnsubscribe from "@/pages/newsletter-unsubscribe";
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
import Help from "@/pages/help";
import HelpArticle from "@/pages/help-article";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  baseTheme: [shadcn],
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${typeof window !== "undefined" ? window.location.origin : ""}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(190 90% 36%)",
    colorForeground: "hsl(240 12% 10%)",
    colorMutedForeground: "hsl(240 6% 38%)",
    colorDanger: "hsl(0 78% 48%)",
    colorBackground: "hsl(220 25% 98%)",
    colorInput: "hsl(240 10% 88%)",
    colorInputForeground: "hsl(240 12% 10%)",
    colorNeutral: "hsl(240 10% 88%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(240_12%_10%)] font-black font-mono tracking-tight text-2xl",
    headerSubtitle: "text-[hsl(240_6%_38%)]",
    socialButtonsBlockButtonText: "text-[hsl(240_12%_10%)] font-medium",
    formFieldLabel: "text-[hsl(240_12%_10%)] text-xs font-mono uppercase tracking-wider",
    footerActionLink: "text-[hsl(190_90%_36%)] hover:text-[hsl(190_90%_28%)]",
    footerActionText: "text-[hsl(240_6%_38%)]",
    dividerText: "text-[hsl(240_6%_38%)] text-xs",
    identityPreviewEditButton: "text-[hsl(190_90%_36%)]",
    formFieldSuccessText: "text-[hsl(140_60%_38%)]",
    alertText: "text-[hsl(240_12%_10%)]",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-20",
    socialButtonsBlockButton: "border border-[hsl(240_10%_88%)] hover:bg-[hsl(220_25%_95%)]",
    formButtonPrimary: "bg-[hsl(190_90%_36%)] hover:bg-[hsl(190_90%_30%)] text-white font-mono uppercase tracking-wider rounded-full shadow-[0_0_20px_hsl(190_90%_36%/0.4)]",
    formFieldInput: "border-[hsl(240_10%_88%)] bg-white text-[hsl(240_12%_10%)]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[hsl(240_10%_88%)]",
    alert: "bg-[hsl(0_78%_48%/0.1)] border-[hsl(0_78%_48%/0.2)]",
    otpCodeFieldInput: "border-[hsl(240_10%_88%)]",
    formFieldRow: "gap-3",
    main: "gap-5",
  },
};

/**
 * Legacy account migration form — lets pre-Clerk users authenticate with their
 * original email + password. On success the backend verifies the SHA-256 hash,
 * creates/links a Clerk user, and returns a short-lived sign-in token that
 * we exchange for a full Clerk session client-side (ticket strategy).
 */
function LegacyLoginForm() {
  const { client, setActive } = useClerk();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/users/legacy-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Invalid credentials");
        return;
      }
      const { signInToken } = await res.json() as { signInToken: string };
      const result = await client.signIn.create({ strategy: "ticket", ticket: signInToken });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLocation("/");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-[440px] max-w-full bg-white rounded-2xl shadow-xl p-8">
      <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
        Had an account before?
      </p>
      <p className="text-xs text-muted-foreground mb-5">
        Enter your original email and password. We&apos;ll automatically link your existing profile, posts, and order history to your new sign-in.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
        <Input
          type="password"
          placeholder="your old password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-11"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider"
        >
          {loading ? "Verifying…" : "Claim my account"}
        </Button>
      </form>
    </div>
  );
}

function SignInPage() {
  const [showLegacy, setShowLegacy] = useState(false);
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 gap-4">
      {showLegacy ? (
        <>
          <LegacyLoginForm />
          <button
            onClick={() => setShowLegacy(false)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </button>
        </>
      ) : (
        <>
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            appearance={clerkAppearance}
          />
        </>
      )}
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function ClerkQueryCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== uid) {
        queryClient.clear();
      }
      prevUserIdRef.current = uid;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/shop/categories" component={ShopCategories} />
        <Route path="/shop/c/:slug" component={CategoryDetail} />
        <Route path="/shop/p/:slug" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/order/:orderNumber" component={OrderConfirmation} />
        <Route path="/forum" component={Forum} />
        <Route path="/forum/new" component={CreatePost} />
        <Route path="/forum/:id" component={PostDetail} />
        <Route path="/categories" component={Categories} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/login" component={() => { window.location.replace(`${basePath}/sign-in`); return null; }} />
        <Route path="/join" component={() => { window.location.replace(`${basePath}/sign-up`); return null; }} />
        <Route path="/admin" component={AdminSuppliers} />
        <Route path="/admin/suppliers" component={AdminSuppliers} />
        <Route path="/admin/import" component={AdminImporter} />
        <Route path="/admin/runs" component={AdminRuns} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/email-log" component={AdminEmailLog} />
        <Route path="/admin/subscribers" component={AdminSubscribers} />
        <Route path="/admin/broadcast" component={AdminBroadcast} />
        <Route path="/admin/help-articles" component={AdminHelpArticles} />
        <Route path="/admin/support" component={AdminSupport} />
        <Route path="/newsletter/confirm" component={NewsletterConfirm} />
        <Route path="/newsletter/unsubscribe" component={NewsletterUnsubscribe} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/help" component={Help} />
        <Route path="/help/:category/:slug" component={HelpArticle} />
        <Route path="/contact" component={Contact} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={`${basePath}/`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryCacheInvalidator />
        <AuthProvider>
          <ThemeSyncer />
          <CartProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  if (!clerkPubKey) {
    return <div className="p-8 text-center">Clerk publishable key not configured.</div>;
  }
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
