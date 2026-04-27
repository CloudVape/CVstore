import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Heart, Clock, User, Tag as TagIcon, Sparkles } from "lucide-react";
import { Post } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PostCardProps {
  post: Post;
  compact?: boolean;
}

export function PostCard({ post, compact = false }: PostCardProps) {
  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <Link href={`/forum/${post.id}`}>
      <Card className="group relative overflow-hidden border-border/40 bg-card/50 transition-all hover:bg-card hover:border-primary/50 cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(0,0,0,0.2)]">
        {post.isAiGenerated && (
          <div className="absolute top-0 right-0 p-1">
            <div className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(var(--secondary),0.8)]" title="AI Generated" />
          </div>
        )}
        <CardHeader className={`${compact ? "p-4 pb-2" : "p-6 pb-3"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {post.categoryName && (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 font-mono text-[10px] uppercase px-2 py-0">
                    {post.categoryName}
                  </Badge>
                )}
                {post.isAiGenerated && (
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase px-2 py-0 gap-1 opacity-80">
                    <Sparkles className="w-3 h-3" /> AI Post
                  </Badge>
                )}
              </div>
              <h3 className={`font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors ${compact ? "text-base line-clamp-1" : "text-xl line-clamp-2"}`}>
                {post.title}
              </h3>
            </div>
          </div>
        </CardHeader>
        
        {!compact && (
          <CardContent className="p-6 pt-0 pb-4">
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {post.content}
            </p>
          </CardContent>
        )}

        <CardFooter className={`flex flex-wrap items-center justify-between gap-4 ${compact ? "p-4 pt-0" : "p-6 pt-0"} text-muted-foreground`}>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5 border border-border/50">
                <AvatarImage src={post.authorAvatarUrl || undefined} />
                <AvatarFallback className="text-[8px] bg-secondary/10 text-secondary">{getInitials(post.authorName)}</AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">{post.authorName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-primary/80 group-hover:text-primary transition-colors">
              <Heart className="h-3.5 w-3.5" />
              <span>{post.likes}</span>
            </div>
            <div className="flex items-center gap-1 group-hover:text-foreground transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{post.commentCount}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}