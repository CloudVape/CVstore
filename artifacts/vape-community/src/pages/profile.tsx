import { useParams, Link } from "wouter";
import { useGetUser, useListPosts } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostCard } from "@/components/post-card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MessageSquare, User as UserIcon } from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function Profile() {
  const { id } = useParams();
  const userId = parseInt(id || "0");
  useSeo({ title: "Profile", description: "VapeVault member profile.", robots: "noindex, follow" });
  
  const { data: user, isLoading: userLoading } = useGetUser(userId, { query: { enabled: !!userId } });
  const { data: posts, isLoading: postsLoading } = useListPosts(undefined, { query: { enabled: !!userId } });

  // Filter posts client-side since API doesn't support authorId filtering
  const userPosts = posts?.filter(p => p.authorId === userId) || [];

  if (userLoading) {
    return <div className="container mx-auto py-20 text-center font-mono text-muted-foreground">Loading profile...</div>;
  }

  if (!user) {
    return <div className="container mx-auto py-20 text-center font-mono text-destructive">User not found</div>;
  }

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <Card className="border-border/40 bg-card/40 backdrop-blur overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-background to-secondary/20 border-b border-border/40 relative" />
        <CardContent className="pt-0 relative px-6 md:px-10 pb-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-12 mb-6">
            <Avatar className="h-32 w-32 border-4 border-card bg-background shadow-xl">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="text-4xl bg-muted text-muted-foreground font-bold">{getInitials(user.username)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2 mb-2">
              <h1 className="text-3xl font-black tracking-tight">{user.username}</h1>
              <div className="flex flex-wrap gap-4 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded border border-border/30">
                  <Calendar className="h-3.5 w-3.5" /> Joined {formatDistanceToNow(new Date(user.joinedAt), { addSuffix: true })}
                </span>
                <span className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded border border-border/30">
                  <MessageSquare className="h-3.5 w-3.5" /> {user.postCount} Posts
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-border/20">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Bio
            </h3>
            <p className="text-foreground/80 leading-relaxed max-w-2xl">
              {user.bio || "This user hasn't added a bio yet. They prefer to let their clouds do the talking."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2 border-b border-border/40 pb-4">
          Recent Activity
        </h2>
        
        {postsLoading ? (
          <div className="py-12 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
            Loading activity...
          </div>
        ) : userPosts.length > 0 ? (
          <div className="space-y-4">
            {userPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl bg-card/20">
            No posts yet.
          </div>
        )}
      </div>
    </div>
  );
}