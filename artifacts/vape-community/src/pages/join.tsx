import { useLocation, Link } from "wouter";
import { useCreateUser, useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSeo } from "@/lib/seo";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Cloud } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  bio: z.string().max(160, "Bio max 160 chars").optional().or(z.literal("")),
});

export default function Join() {
  useSeo({ title: "Sign up", description: "Create your VapeVault account.", canonical: "/join", robots: "noindex, follow" });
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const createUser = useCreateUser();
  const loginUser = useLoginUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      bio: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Treat empty bio as undefined
    const submitData = {
      ...values,
      bio: values.bio || undefined,
    };

    createUser.mutate({ data: submitData }, {
      onSuccess: () => {
        // Auto login after creation
        loginUser.mutate({ data: { email: values.email, password: values.password } }, {
          onSuccess: (user) => {
            login(user);
            toast({ title: "Account created!", description: `Welcome to the community, ${user.username}` });
            setLocation("/");
          }
        });
      },
      onError: (error: any) => {
        toast({ 
          title: "Registration failed", 
          description: error.message || "Email or username might be taken", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[80vh] px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 group">
        <Cloud className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
        <span className="font-bold font-mono tracking-tight text-xl text-foreground">
          VAPE<span className="text-primary">VAULT</span>
        </span>
      </Link>
      
      <Card className="w-full max-w-md border-border/40 bg-card/50 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-8 border-b border-border/20 mb-6">
          <CardTitle className="text-3xl font-black uppercase tracking-tight">Join Us</CardTitle>
          <CardDescription className="font-mono text-sm">Create an account to start posting</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Username</FormLabel>
                    <FormControl>
                      <Input placeholder="cloudchaser99" {...field} className="bg-background/50 border-border/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} className="bg-background/50 border-border/50" />
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
                      <Input type="password" placeholder="••••••••" {...field} className="bg-background/50 border-border/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Bio <span className="opacity-50">(Optional)</span></FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What's your current setup?" 
                        {...field} 
                        className="resize-none bg-background/50 border-border/50 min-h-[80px]" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-12 mt-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(var(--primary),0.3)]" 
                disabled={createUser.isPending || loginUser.isPending}
              >
                {createUser.isPending ? "Creating Account..." : "Sign Up"}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/20 pt-6 pb-8">
          <p className="text-sm text-muted-foreground font-mono">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline hover:text-primary/80 font-semibold">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}