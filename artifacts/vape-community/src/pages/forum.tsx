import { useState } from "react";
import { useListPosts, useListCategories, useListUsers } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Filter, Search, PlusCircle, MessageSquare, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSeo } from "@/lib/seo";

export default function Forum() {
  useSeo({
    title: "Community Forum",
    description:
      "Join the CloudVape community forum — reviews, recommendations, hardware tips, juice talk, and discussions from fellow vapers.",
    canonical: "/forum",
    keywords: ["vape forum", "vape community", "vape discussion", "vape reviews", "e-liquid recommendations"],
  });
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const categoryIdParam = searchParams.get("categoryId");
  const categoryId = categoryIdParam ? parseInt(categoryIdParam) : undefined;
  
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: posts, isLoading: postsLoading } = useListPosts({ categoryId });
  const { data: categories } = useListCategories();
  const { data: users } = useListUsers();
  const { user } = useAuth();

  const filteredPosts = posts?.filter(p => 
    searchTerm ? (p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.content.toLowerCase().includes(searchTerm.toLowerCase())) : true
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            The Forum
          </h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm max-w-xl">
            {categoryId 
              ? `Viewing posts in ${categories?.find(c => c.id === categoryId)?.name || 'category'}`
              : "All discussions, reviews, and community content."}
          </p>
        </div>
        
        {user ? (
          <Link href="/forum/new">
            <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
              <PlusCircle className="mr-2 h-4 w-4" /> New Post
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button variant="outline" className="rounded-full font-mono text-xs uppercase tracking-wider">
              Log in to post
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between bg-card/30 p-4 rounded-xl border border-border/40">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search discussions..." 
                className="pl-9 bg-background/50 border-border/50 font-mono text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-muted-foreground uppercase mr-2">Filter:</span>
              <Button variant="outline" size="sm" className="h-9 font-mono text-xs uppercase bg-background/50">
                <Filter className="mr-2 h-3.5 w-3.5" /> Latest
              </Button>
            </div>
          </div>

          {/* Posts List */}
          <div className="space-y-4">
            {postsLoading ? (
              <div className="py-20 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
                <span className="animate-pulse">Loading posts...</span>
              </div>
            ) : filteredPosts && filteredPosts.length > 0 ? (
              filteredPosts.map(post => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
              <div className="py-20 text-center border border-dashed border-border/40 rounded-xl bg-card/20">
                <p className="text-muted-foreground font-mono mb-4">No posts found.</p>
                {searchTerm && (
                  <Button variant="link" onClick={() => setSearchTerm("")} className="font-mono text-primary">
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Filters */}
        <div className="w-full lg:w-64 space-y-6 shrink-0">
          <div className="bg-card/30 rounded-xl border border-border/40 p-5 sticky top-24">
            <h3 className="font-mono font-bold uppercase tracking-wider mb-4 pb-2 border-b border-border/40 text-sm">Topics</h3>
            <ul className="space-y-1 mb-8">
              <li>
                <Link href="/forum" className={`flex justify-between items-center px-3 py-2 rounded-lg transition-colors font-mono text-sm ${!categoryId ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}>
                  <span>All Discussions</span>
                </Link>
              </li>
              {categories?.map(category => (
                <li key={category.id}>
                  <Link href={`/forum?categoryId=${category.id}`} className={`flex justify-between items-center px-3 py-2 rounded-lg transition-colors font-mono text-sm ${categoryId === category.id ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-card hover:text-foreground'}`}>
                    <span className="truncate">{category.name}</span>
                    <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded opacity-70">{category.postCount}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <h3 className="font-mono font-bold uppercase tracking-wider mb-4 pb-2 border-b border-border/40 text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Top Members
            </h3>
            <div className="space-y-3">
              {users?.slice(0, 5).map(u => (
                <Link key={u.id} href={`/profile/${u.id}`} className="flex items-center gap-3 group">
                  <Avatar className="h-8 w-8 border border-border/50 group-hover:border-primary transition-colors">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px] bg-secondary/10 text-secondary">{u.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{u.username}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{u.postCount} posts</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}