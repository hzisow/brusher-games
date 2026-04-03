import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skull, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KillFeedEntry {
  id: string;
  hunterName: string;
  victimName: string;
  timestamp: string | null;
}

export default function KillFeed() {
  const { data: killFeed = [] } = useQuery<KillFeedEntry[]>({
    queryKey: ["killFeed"],
    queryFn: async () => {
      const res = await fetch("/api/kill-feed");
      if (!res.ok) throw new Error("Failed to fetch kill feed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Skull className="h-5 w-5 text-destructive" />
          Recent Eliminations
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {killFeed.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No eliminations yet</p>
          ) : (
            killFeed.slice(0, 10).map((kill) => (
              <div
                key={kill.id}
                className="flex flex-wrap items-center gap-1 sm:gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10"
                data-testid={`kill-feed-entry-${kill.id}`}
              >
                <span className="font-medium text-primary text-sm truncate max-w-[40%]">{kill.hunterName}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="text-destructive font-medium text-sm truncate max-w-[40%]">{kill.victimName}</span>
                {kill.timestamp && (
                  <span className="w-full sm:w-auto sm:ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(kill.timestamp), { addSuffix: true })}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
