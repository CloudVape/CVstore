import { useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid, Hash, ArrowRight } from "lucide-react";

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12 border-b border-border/40 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter flex items-center justify-center gap-3 mb-4">
          <Grid className="h-10 w-10 text-secondary" />
          Categories
        </h1>
        <p className="text-muted-foreground font-mono max-w-2xl mx-auto">
          Explore discussions by topic. From hardware reviews to juice recommendations, find your niche.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground font-mono border border-dashed border-border/40 rounded-xl">
          <span className="animate-pulse">Loading categories...</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories?.map((category) => (
            <Link key={category.id} href={`/forum?categoryId=${category.id}`}>
              <Card className="h-full border-border/40 bg-card/30 hover:bg-card hover:border-secondary/50 transition-all cursor-pointer group shadow-sm hover:shadow-[0_0_20px_rgba(var(--secondary),0.1)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="font-bold text-xl tracking-tight group-hover:text-secondary transition-colors">
                      {category.name}
                    </span>
                    <Hash className="h-5 w-5 text-muted-foreground group-hover:text-secondary transition-colors opacity-50" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-6 line-clamp-3">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border/20">
                    <span className="text-xs font-mono uppercase bg-background/50 px-2.5 py-1 rounded text-muted-foreground">
                      {category.postCount} Posts
                    </span>
                    <span className="text-xs font-mono text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Browse <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          
          {categories?.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground font-mono">
              No categories found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}