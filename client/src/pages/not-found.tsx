import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <Card className="w-full max-w-md mx-4 bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
            <h1 className="text-2xl font-display font-bold text-foreground">404 // SIGNAL LOST</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground font-mono">
            Target coordinates not found. The requested sector does not exist or has been redacted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
