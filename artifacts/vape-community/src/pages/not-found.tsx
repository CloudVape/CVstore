import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function NotFound() {
  useSeo({ title: "Page Not Found", description: "The page you were looking for could not be found.", robots: "noindex, follow" });
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 border-border/40 bg-card/50">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            The page you were looking for could not be found.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
