import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/layout";

// Pages
import Home from "@/pages/home";
import Forum from "@/pages/forum";
import PostDetail from "@/pages/post-detail";
import Categories from "@/pages/categories";
import Profile from "@/pages/profile";
import Login from "@/pages/login";
import Join from "@/pages/join";
import CreatePost from "@/pages/create-post";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/forum" component={Forum} />
        <Route path="/forum/new" component={CreatePost} />
        <Route path="/forum/:id" component={PostDetail} />
        <Route path="/categories" component={Categories} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/login" component={Login} />
        <Route path="/join" component={Join} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;