import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useCreateComment } from "@workspace/api-client-react";
import { Comment } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListCommentsQueryKey } from "@workspace/api-client-react";

interface CommentListProps {
  postId: number;
  comments: Comment[];
}

export function CommentList({ postId, comments }: CommentListProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const createComment = useCreateComment();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Must be logged in", description: "Please log in to comment.", variant: "destructive" });
      return;
    }
    if (!content.trim()) return;

    createComment.mutate({
      data: { authorId: user.id, content }
    }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
        toast({ title: "Comment posted" });
      },
      onError: () => {
        toast({ title: "Failed to post comment", variant: "destructive" });
      }
    });
  };

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-mono font-bold uppercase tracking-tight text-primary border-b border-border/40 pb-2 inline-flex">
        Comments ({comments.length})
      </h3>

      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add to the discussion..."
            className="min-h-[100px] resize-none bg-card/50 border-border/40 focus-visible:ring-primary font-sans"
          />
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={createComment.isPending || !content.trim()}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs uppercase tracking-wider"
            >
              {createComment.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card/30 p-6 text-center text-sm text-muted-foreground font-mono">
          Please log in to join the discussion.
        </div>
      )}

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4 group">
            <Avatar className="h-10 w-10 border border-border/50 shrink-0">
              <AvatarImage src={comment.authorAvatarUrl || undefined} />
              <AvatarFallback className="bg-secondary/10 text-secondary text-xs">{getInitials(comment.authorName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{comment.authorName}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="text-sm text-foreground/90 leading-relaxed bg-card/40 p-3 rounded-lg border border-border/20 group-hover:border-primary/20 transition-colors">
                {comment.content}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono pt-1">
                <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Heart className="h-3.5 w-3.5" />
                  <span>{comment.likes}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm font-mono border border-dashed border-border/40 rounded-lg">
            No clouds here yet. Be the first to comment!
          </div>
        )}
      </div>
    </div>
  );
}