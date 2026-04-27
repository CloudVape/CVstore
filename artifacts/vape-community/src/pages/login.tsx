import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSeo } from "@/lib/seo";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Cloud } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  useSeo({ title: "Log in", description: "Log in to your CloudVape account.", canonical: "/login", robots: "noindex, follow" });
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLoginUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (user) => {
        login(user);
        toast({ title: "Welcome back", description: `Logged in as ${user.username}` });
        setLocation("/");
      },
      onError: (error: any) => {
        toast({ 
          title: "Login failed", 
          description: error.message || "Invalid credentials", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Link href="/" className="mb-8 flex items-center gap-2 group">
        <Cloud className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
        <span className="font-bold font-mono tracking-tight text-xl text-foreground">
          VAPE<span className="text-primary">VAULT</span>
        </span>
      </Link>
      
      <Card className="w-full max-w-md border-border/40 bg-card/50 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-8 border-b border-border/20 mb-6">
          <CardTitle className="text-3xl font-black uppercase tracking-tight">Log In</CardTitle>
          <CardDescription className="font-mono text-sm">Enter your credentials to access the forum</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} className="bg-background/50 border-border/50 h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-background/50 border-border/50 h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-12 mt-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider shadow-[0_0_15px_hsl(var(--primary)/0.3)]" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Authenticating..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/20 pt-6 pb-8">
          <p className="text-sm text-muted-foreground font-mono">
            Don't have an account?{" "}
            <Link href="/join" className="text-primary hover:underline hover:text-primary/80 font-semibold">
              Join the community
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}