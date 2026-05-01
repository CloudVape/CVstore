import { useParams, Link } from "wouter";
import { useState } from "react";
import { useGetUser, useListPosts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostCard } from "@/components/post-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MessageSquare, User as UserIcon, Pencil, X, Check } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

export default function Profile() {
  const { id } = useParams();
  const userId = parseInt(id || "0");
  useSeo({ title: "Profile", description: "CloudVape member profile.", robots: "noindex, follow" });

  const { user: authUser, getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnProfile = !!authUser && authUser.id === userId;

  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  const { data: user, isLoading: userLoading } = useGetUser(userId, { query: { enabled: !!userId } });
  const { data: posts, isLoading: postsLoading } = useListPosts(undefined, { query: { enabled: !!userId } });

  function startEditBio() {
    setBioValue(user?.bio ?? "");
    setEditingBio(true);
  }

  function cancelEditBio() {
    setEditingBio(false);
  }

  async function saveBio() {
    setSavingBio(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/users/me/bio`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bio: bioValue.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to save");
      }
      await queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}`] });
      setEditingBio(false);
      toast({ title: "Bio updated" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save bio", variant: "destructive" });
    } finally {
      setSavingBio(false);
    }
  }

  // Filter posts client-side since API doesn't support authorId filtering
  const userPosts = posts?.filter(p => p.authorId === userId) || [];

  if (userLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Card className="border-border/40 bg-card/40 backdrop-blur overflow-hidden mb-8">
          <div className="h-32 bg-gradient-to-r from-primary/20 via-background to-secondary/20 border-b border-border/40" />
          <CardContent className="pt-0 relative px-6 md:px-10 pb-10">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-12 mb-6">
              <Skeleton className="h-32 w-32 rounded-full border-4 border-card shrink-0" />
              <div className="flex-1 space-y-3 mb-2">
                <Skeleton className="h-8 w-48" />
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-32 rounded" />
                  <Skeleton className="h-6 w-24 rounded" />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-border/20 space-y-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-3/4 max-w-xl" />
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Skeleton className="h-7 w-48 mb-4" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
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
              {isOwnProfile && !editingBio && (
                <button
                  onClick={startEditBio}
                  className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit bio"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </h3>

            {editingBio ? (
              <div className="max-w-2xl space-y-3">
                <Textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  placeholder="Tell the community a little about yourself…"
                  maxLength={500}
                  rows={4}
                  className="resize-none font-sans text-sm bg-background/60"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void saveBio()} disabled={savingBio} className="gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    {savingBio ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEditBio} disabled={savingBio} className="gap-1.5">
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <span className="text-xs text-muted-foreground font-mono ml-auto">{bioValue.length}/500</span>
                </div>
              </div>
            ) : (
              <p className="text-foreground/80 leading-relaxed max-w-2xl">
                {user.bio || (
                  isOwnProfile
                    ? <span className="text-muted-foreground italic">No bio yet — <button onClick={startEditBio} className="underline hover:text-foreground transition-colors">add one</button></span>
                    : "This user hasn't added a bio yet. They prefer to let their clouds do the talking."
                )}
              </p>
            )}
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