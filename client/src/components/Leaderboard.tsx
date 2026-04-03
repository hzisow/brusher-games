import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Crown, Skull, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeaderboardEntry {
  id: string;
  name: string;
  kills: number;
  status: string;
}

export default function Leaderboard() {
  const { data: leaderboard = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Frontend filter as backup: only show users with proper names (not auto-generated)
  const filteredLeaderboard = leaderboard.filter(player => {
    const trimmedName = player.name.trim();
    const hasSpace = trimmedName.includes(' ');
    const notEmail = !trimmedName.includes('@');
    return hasSpace && notEmail;
  });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-muted-foreground font-mono">{index + 1}</span>;
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {filteredLeaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No players yet</p>
          ) : (
            filteredLeaderboard.slice(0, 5).map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center gap-2 sm:gap-3 p-2 rounded-lg ${
                  index === 0
                    ? "bg-yellow-500/10 border border-yellow-500/20"
                    : index < 3
                    ? "bg-muted/50"
                    : ""
                }`}
                data-testid={`leaderboard-entry-${player.id}`}
              >
                <div className="flex items-center justify-center w-5 sm:w-6 flex-shrink-0">
                  {getRankIcon(index)}
                </div>
                <div className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0">
                  <span className="font-medium text-foreground text-sm sm:text-base truncate">{player.name}</span>
                  {player.status === "eliminated" && (
                    <Skull className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <Badge variant="secondary" className="font-mono text-xs flex-shrink-0">
                  {player.kills}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
