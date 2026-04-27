import { useParams } from "wouter";
import { useGetPost, useListComments, useLikePost, useDeletePost, getGetPostQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Clock, Heart, MessageSquare, User, Tag as TagIcon, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommentList } from "@/components/comment-list";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useSeo, JsonLd, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export default function PostDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const postId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: post, isLoading: postLoading } = useGetPost(postId, { query: { enabled: !!postId } });
  const { data: comments, isLoading: commentsLoading } = useListComments(postId, { query: { enabled: !!postId } });
  const likePost = useLikePost();
  const deletePost = useDeletePost();

  useSeo({
    title: post?.title,
    description: post?.content?.slice(0, 200) ?? "Forum discussion on VapeVault.",
    canonical: post ? `/forum/${post.id}` : undefined,
    type: "article",
    keywords: post ? [post.categoryName, ...(post.tags ?? [])].filter(Boolean) as string[] : undefined,
  });

  const handleLike = () => {
    if (!user) {
      toast({ title: "Must be logged in", description: "Please log in to like posts.", variant: "destructive" });
      return;
    }
    likePost.mutate(postId, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetPostQueryKey(postId), data);
      }
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this post?")) {
      deletePost.mutate(postId, {
        onSuccess: () => {
          toast({ title: "Post deleted" });
          setLocation("/forum");
        }
      });
    }
  };

  if (postLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-20 text-center font-mono text-muted-foreground">
        Loading post...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-20 text-center font-mono text-destructive">
        Post not found.
      </div>
    );
  }

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <JsonLd
        id={`post-bc-${post.id}`}
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Forum", url: "/forum" },
          { name: post.title, url: `/forum/${post.id}` },
        ])}
      />
      <JsonLd
        id={`post-article-${post.id}`}
        data={articleJsonLd({
          title: post.title,
          description: post.content?.slice(0, 200),
          authorName: post.authorName,
          datePublished: post.createdAt,
          dateModified: post.updatedAt,
          url: `/forum/${post.id}`,
        })}
      />
      <Link href="/forum" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary mb-8 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forum
      </Link>

      <article className="bg-card/30 rounded-2xl border border-border/40 overflow-hidden mb-10 shadow-lg">
        <div className="p-6 md:p-10 border-b border-border/40">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {post.categoryName && (
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 font-mono text-xs uppercase px-3 py-1">
                {post.categoryName}
              </Badge>
            )}
            <span className="text-muted-foreground text-sm font-mono flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground mb-8 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-6 border-t border-border/20 pt-6">
            <Link href={`/profile/${post.authorId}`} className="flex items-center gap-3 group">
              <Avatar className="h-12 w-12 border-2 border-border group-hover:border-primary transition-colors">
                <AvatarImage src={post.authorAvatarUrl || undefined} />
                <AvatarFallback className="bg-secondary/10 text-secondary text-sm font-bold">{getInitials(post.authorName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-base group-hover:text-primary transition-colors">{post.authorName}</p>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Author</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {user?.id === post.authorId && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDelete}
                  disabled={deletePost.isPending}
                  className="rounded-full font-mono text-xs gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLike}
                disabled={likePost.isPending}
                className="rounded-full font-mono text-xs border-border/50 bg-background/50 hover:text-primary hover:border-primary/50 gap-2"
              >
                <Heart className={`h-4 w-4 ${likePost.isPending ? 'animate-pulse' : ''}`} /> 
                {post.likes} Likes
              </Button>
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono bg-background/50 px-4 py-2 rounded-full border border-border/50">
                <MessageSquare className="h-4 w-4" /> 
                {post.commentCount} Comments
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10 bg-background/30 prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-card/50 prose-pre:border prose-pre:border-border/40">
          <div className="whitespace-pre-wrap text-foreground/90 font-sans text-base md:text-lg">
            {post.content}
          </div>
          
          {(post.tags.length > 0 || post.sourceUrl) && (
            <div className="mt-10 pt-8 border-t border-border/20 flex flex-wrap gap-4">
              {post.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <TagIcon className="h-4 w-4 text-muted-foreground" />
                  {post.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] font-mono uppercase border-border/40 bg-card/50 text-muted-foreground hover:text-foreground">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              {post.sourceUrl && (
                <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-mono text-primary hover:text-primary/80 transition-colors bg-primary/5 px-3 py-1.5 rounded-full">
                  <ExternalLink className="h-3.5 w-3.5" /> Source Link
                </a>
              )}
            </div>
          )}
        </div>
      </article>

      <section className="mb-20">
        {commentsLoading ? (
          <div className="py-10 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
            Loading comments...
          </div>
        ) : (
          <CommentList postId={postId} comments={comments || []} />
        )}
      </section>
    </div>
  );
}