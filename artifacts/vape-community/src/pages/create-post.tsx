import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreatePost, useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  content: z.string().min(10, "Content must be at least 10 characters"),
  categoryId: z.string().min(1, "Please select a category"),
  tags: z.string().optional(),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const createPost = useCreatePost();
  const { data: categories } = useListCategories();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      categoryId: "",
      tags: "",
      sourceUrl: "",
    },
  });

  if (!user) {
    return (
      <div className="container mx-auto py-20 text-center font-mono">
        <h2 className="text-2xl font-bold mb-4">You must be logged in to post.</h2>
        <Link href="/login">
          <Button>Log in</Button>
        </Link>
      </div>
    );
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const tagsArray = values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    
    const submitData = {
      title: values.title,
      content: values.content,
      categoryId: parseInt(values.categoryId),
      authorId: user.id,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      sourceUrl: values.sourceUrl || undefined,
    };

    createPost.mutate({ data: submitData }, {
      onSuccess: (post) => {
        toast({ title: "Post created successfully" });
        setLocation(`/forum/${post.id}`);
      },
      onError: (error: any) => {
        toast({ 
          title: "Failed to create post", 
          description: error.message || "An error occurred", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <Link href="/forum" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary mb-8 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forum
      </Link>

      <div className="bg-card/40 border border-border/40 rounded-2xl p-6 md:p-10 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-8 border-b border-border/40 pb-6">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <MessageSquarePlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Create a New Post</h1>
            <p className="text-muted-foreground font-mono text-sm">Share your thoughts, reviews, or questions.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Title</FormLabel>
                  <FormControl>
                    <Input placeholder="What's on your mind?" {...field} className="bg-background/50 text-lg py-6 font-semibold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/50 h-12">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map(category => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Write your post here..." 
                      {...field} 
                      className="min-h-[250px] resize-y bg-background/50 text-base p-4" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Tags <span className="opacity-50">(comma separated)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="mods, juice, review" {...field} className="bg-background/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sourceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Source Link <span className="opacity-50">(Optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} className="bg-background/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-6 border-t border-border/40 flex justify-end">
              <Button 
                type="submit" 
                disabled={createPost.isPending}
                className="h-12 px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider shadow-[0_0_15px_rgba(var(--primary),0.3)]"
              >
                {createPost.isPending ? "Publishing..." : "Publish Post"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}