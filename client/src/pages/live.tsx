import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Users, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import gannLogo from "@assets/Gann_Academy__MA__Red_Heifers_2_Logo_1765161174122.png";

interface KillFeedEntry {
  id: string;
  hunterName: string;
  victimName: string;
  timestamp: string | null;
}

export default function Live() {
  const { data: playerCount } = useQuery<{ total: number; alive: number }>({
    queryKey: ["player-count"],
    queryFn: async () => {
      const res = await fetch("/api/player-count");
      if (!res.ok) throw new Error("Failed to fetch player count");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: killFeed = [] } = useQuery<KillFeedEntry[]>({
    queryKey: ["killFeed"],
    queryFn: async () => {
      const res = await fetch("/api/kill-feed");
      if (!res.ok) throw new Error("Failed to fetch kill feed");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const alive = playerCount?.alive ?? 0;
  const total = playerCount?.total ?? 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        {/* Logo and title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center mb-8 sm:mb-12"
        >
          <img
            src={gannLogo}
            alt="Gann Academy"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-lg mb-4"
          />
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-widest uppercase text-white/90">
            The Brusher Games
          </h1>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-red-500 to-transparent mt-3" />
        </motion.div>

        {/* Main counter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-red-400" />
            <motion.span
              key={alive}
              initial={{ scale: 1.3, color: "#f87171" }}
              animate={{ scale: [1, 1.05, 1], color: "#ffffff" }}
              transition={{
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                color: { duration: 0.8 },
              }}
              className="text-7xl sm:text-9xl font-display font-bold tabular-nums drop-shadow-[0_0_30px_rgba(248,113,113,0.3)]"
            >
              {alive}
            </motion.span>
          </div>
          <p className="text-xl sm:text-2xl font-display font-semibold tracking-wide uppercase text-white/90">
            Brushers Remain
          </p>
          <p className="text-sm sm:text-base text-slate-400 mt-2">
            out of {total} total
          </p>
        </motion.div>

        {/* Kill feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full mb-8 sm:mb-12"
        >
          <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm shadow-2xl">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Skull className="h-5 w-5 text-red-400" />
                <h2 className="text-lg font-display font-semibold text-white">
                  Recent Eliminations
                </h2>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {killFeed.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">
                      No eliminations yet
                    </p>
                  ) : (
                    killFeed.slice(0, 5).map((kill) => (
                      <motion.div
                        key={kill.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg bg-red-950/30 border border-red-900/30"
                      >
                        <Badge
                          variant="outline"
                          className="border-red-800/50 bg-red-950/50 text-red-300 text-xs"
                        >
                          <Skull className="h-3 w-3 mr-1" />
                          ELIMINATED
                        </Badge>
                        <span className="font-medium text-white text-sm truncate max-w-[30%]">
                          {kill.hunterName}
                        </span>
                        <ArrowRight className="h-3 w-3 text-slate-500 flex-shrink-0" />
                        <span className="text-red-400 font-medium text-sm truncate max-w-[30%] line-through">
                          {kill.victimName}
                        </span>
                        {kill.timestamp && (
                          <span className="w-full sm:w-auto sm:ml-auto text-xs text-slate-500">
                            {formatDistanceToNow(new Date(kill.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Join button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Button
            asChild
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-base px-8 py-3 shadow-lg shadow-red-900/30"
          >
            <a href="/login">
              Join the Game <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
