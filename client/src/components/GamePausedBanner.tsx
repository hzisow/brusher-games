import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PauseCircle } from "lucide-react";

interface GameStatus {
  isPaused: boolean;
  pauseMessage: string | null;
}

export default function GamePausedBanner() {
  const { data: gameStatus } = useQuery<GameStatus>({
    queryKey: ["gameStatus"],
    queryFn: async () => {
      const res = await fetch("/api/game-status");
      if (!res.ok) throw new Error("Failed to fetch game status");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (!gameStatus?.isPaused) return null;

  return (
    <Alert className="border-yellow-500/20 bg-yellow-500/10 mb-6">
      <PauseCircle className="h-5 w-5 text-yellow-600" />
      <AlertTitle className="ml-2 font-bold text-yellow-600">GAME PAUSED</AlertTitle>
      <AlertDescription className="ml-2 text-foreground">
        {gameStatus.pauseMessage || "The game is currently paused. Please wait for further instructions."}
      </AlertDescription>
    </Alert>
  );
}
