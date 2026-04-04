import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGame } from "@/lib/gameContext";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Target, Skull, AlertTriangle, CheckCircle2, Clock, Crosshair, Sparkles, ShieldAlert, Timer, Zap, Swords, History } from "lucide-react";
import type { SpecialRule } from "@shared/schema";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import FeedbackForm from "@/components/FeedbackForm";
import Leaderboard from "@/components/Leaderboard";
import KillFeed from "@/components/KillFeed";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import GamePausedBanner from "@/components/GamePausedBanner";

function CountdownTimer({ expiresAt }: { expiresAt: Date }) {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = new Date(expiresAt).getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}m ${seconds}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  
  return (
    <div className="flex items-center gap-2 bg-destructive/20 px-3 py-1 rounded-full">
      <Timer className="h-4 w-4 text-destructive" />
      <span className="font-mono font-bold text-destructive">{timeLeft}</span>
    </div>
  );
}

export default function Dashboard() {
  const { currentUser, users, reportTag, confirmDeath, disputeDeath } = useGame();
  const queryClient = useQueryClient();
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState("");
  const [evidenceData, setEvidenceData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch pending tag info for countdown timer
  const { data: pendingTag } = useQuery({
    queryKey: ['pendingTag'],
    queryFn: async () => {
      const res = await fetch('/api/tags/pending');
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentUser && currentUser.status === 'pending_confirmation',
    refetchInterval: 10000,
  });

  // Fetch special rules
  const { data: specialRules = [] } = useQuery<SpecialRule[]>({
    queryKey: ['specialRules'],
    queryFn: async () => {
      const res = await fetch('/api/special-rules');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10000,
  });

  // Fetch kill history
  const { data: killHistory = [] } = useQuery<Array<{ id: string; victimName: string; timestamp: string }>>({
    queryKey: ['killHistory'],
    queryFn: async () => {
      const res = await fetch('/api/kill-history');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentUser,
  });

  // Fetch dispute timeline
  const { data: disputeTimeline = [] } = useQuery<Array<{ id: string; hunterName: string; victimName: string; status: string; timestamp: string; role: 'hunter' | 'victim' }>>({
    queryKey: ['disputeTimeline'],
    queryFn: async () => {
      const res = await fetch('/api/dispute-timeline');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!currentUser,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setEvidenceData(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEvidenceData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitDispute = async () => {
    try {
      await fetch('/api/tags/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: disputeMessage,
          evidenceData: evidenceData || undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['disputeTimeline'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTag'] });
    } catch (err) {
      console.error('Failed to submit dispute:', err);
    }
    setShowDisputeForm(false);
    setDisputeMessage("");
    setEvidenceData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!currentUser) return null;

  // Find my target
  const target = users.find(u => u.id === currentUser.targetId);
  
  const isAlive = currentUser.status === 'alive';
  const isPending = currentUser.status === 'pending_confirmation';
  const isEliminated = currentUser.status === 'eliminated';
  const isDisputed = currentUser.status === 'disputed';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Game Status Banners */}
      <GamePausedBanner />
      <AnnouncementBanner />

      {/* Victim Alert: My Hunter Claims They Tagged Me */}
      {isPending && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
         >
           <Alert className="border-destructive/20 bg-destructive/5">
             <AlertTriangle className="h-5 w-5 text-destructive" />
             <AlertTitle className="ml-2 font-bold text-lg text-destructive flex items-center gap-3 flex-wrap">
               TAG REPORTED!
               {pendingTag?.expiresAt && <CountdownTimer expiresAt={pendingTag.expiresAt} />}
             </AlertTitle>
             <AlertDescription className="ml-2 mt-2">
               {!showDisputeForm ? (
                 <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                   <span className="text-foreground">
                     <strong>{pendingTag?.hunterName || 'Your hunter'}</strong> claims they have tagged you. 
                     <br className="sm:hidden" />
                     <span className="text-destructive font-medium"> You have 1 hour to respond or you're out!</span>
                   </span>
                   <div className="flex gap-2">
                     <Button 
                       variant="outline" 
                       className="border-destructive text-destructive hover:bg-destructive/10" 
                       size="sm" 
                       onClick={() => setShowDisputeForm(true)}
                       data-testid="button-show-dispute"
                     >
                        Dispute Tag
                     </Button>
                     <Button variant="destructive" size="sm" onClick={confirmDeath} data-testid="button-confirm-death">
                        Confirm I Was Tagged
                     </Button>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-4 mt-2">
                   <p className="text-foreground font-medium">Explain why you're disputing this tag:</p>
                   <Textarea
                     placeholder="Describe what happened and why you believe the tag was invalid (e.g., you were in a safe zone, they used an invalid method, etc.)"
                     value={disputeMessage}
                     onChange={(e) => setDisputeMessage(e.target.value)}
                     className="min-h-[100px] bg-background"
                     data-testid="input-dispute-message"
                   />
                   <div className="space-y-2">
                     <p className="text-sm text-muted-foreground">Optionally attach photo evidence</p>
                     <Input
                       ref={fileInputRef}
                       type="file"
                       accept="image/*"
                       onChange={handleFileSelect}
                       className="bg-background"
                       data-testid="input-dispute-evidence"
                     />
                     {evidenceData && (
                       <p className="text-xs text-green-600">Image attached</p>
                     )}
                   </div>
                   <div className="flex gap-2 justify-end">
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => { setShowDisputeForm(false); setDisputeMessage(""); setEvidenceData(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                       data-testid="button-cancel-dispute"
                     >
                        Cancel
                     </Button>
                     <Button
                       variant="destructive"
                       size="sm"
                       onClick={handleSubmitDispute}
                       disabled={!disputeMessage.trim()}
                       data-testid="button-submit-dispute"
                     >
                        Submit Dispute
                     </Button>
                   </div>
                 </div>
               )}
             </AlertDescription>
           </Alert>
         </motion.div>
      )}

      {/* Disputed Status */}
      {isDisputed && (
        <Alert className="border-yellow-500/20 bg-yellow-500/5">
          <ShieldAlert className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="ml-2 font-bold text-lg text-yellow-600">UNDER REVIEW</AlertTitle>
          <AlertDescription className="ml-2 text-foreground">
            You have disputed this tag. Please wait for an admin to resolve the situation.
          </AlertDescription>
        </Alert>
      )}

      {/* Status Hero */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Target Card - shows first on mobile */}
        <Card className={`border-red-300 bg-red-50 shadow-sm relative overflow-hidden flex flex-col order-first md:order-last ${!isAlive && 'opacity-50 grayscale'}`}>
           {isAlive && target ? (
             <>
               <CardHeader className="pb-2">
                 <div className="flex justify-between items-start">
                   <CardTitle className="text-sm font-medium text-red-700 uppercase tracking-widest flex items-center gap-2">
                     <Crosshair className="h-4 w-4" /> Your Target
                   </CardTitle>
                   <Badge variant="secondary" className="bg-red-200 text-red-800 hover:bg-red-300">
                     ACTIVE
                   </Badge>
                 </div>
               </CardHeader>
               <CardContent className="flex-1 flex flex-col items-center justify-center text-center py-6">
                 <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4 border-4 border-red-200 shadow-inner">
                   <span className="text-3xl font-display font-bold text-red-700">
                     {target.name.charAt(0)}
                   </span>
                 </div>
                 <h2 className="text-3xl font-bold font-display tracking-tight text-red-900 mb-1">
                   {target.name}
                 </h2>
                 <p className="text-red-600 font-mono text-sm bg-red-100 px-2 py-1 rounded">
                   ID: {target.id.split('-')[0].toUpperCase()}
                 </p>
               </CardContent>
             </>
           ) : (
             <CardContent className="flex-1 flex flex-col items-center justify-center text-center py-10">
               {isEliminated ? (
                 <>
                   <Skull className="h-16 w-16 text-red-300 mb-4" />
                   <h2 className="text-2xl font-bold text-red-800">Out of the Game</h2>
                   <p className="text-sm text-red-600 mt-2">Better luck next year.</p>
                 </>
               ) : (isPending || isDisputed) ? (
                 <>
                   <Clock className="h-16 w-16 text-yellow-500/50 mb-4 animate-pulse" />
                   <h2 className="text-2xl font-bold text-yellow-600">Status Pending</h2>
                   <p className="text-sm text-muted-foreground mt-2">Resolve your status to continue.</p>
                 </>
               ) : (
                 <>
                   <CheckCircle2 className="h-16 w-16 text-red-300 mb-4" />
                   <h2 className="text-2xl font-bold text-red-700">No Target Assigned</h2>
                   <p className="text-sm text-red-500 mt-2">Wait for assignment.</p>
                 </>
               )}
             </CardContent>
           )}
        </Card>

        {/* Player Status Card - shows second on mobile */}
        <Card className="border-border bg-card shadow-sm overflow-hidden relative order-last md:order-first">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Target className="h-32 w-32" />
          </div>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Player Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`h-4 w-4 rounded-full ${isAlive ? 'bg-green-500 ring-4 ring-green-100' : (isPending || isDisputed) ? 'bg-yellow-500 animate-pulse ring-4 ring-yellow-100' : 'bg-red-500 ring-4 ring-red-100'}`} />
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
                {isAlive ? 'ACTIVE BRUSHER' : (isPending || isDisputed) ? 'COMPROMISED' : 'ELIMINATED'}
              </h1>
            </div>
            <div className="mt-6 flex gap-8 text-sm">
              <div>
                <p className="text-muted-foreground">Points</p>
                <p className="text-2xl font-mono font-bold text-foreground">{currentUser.kills}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rank</p>
                <p className="text-2xl font-mono font-bold text-foreground">#{users.filter(u => u.kills > currentUser.kills).length + 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Area for Hunter */}
      {isAlive && target && target.status === 'alive' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Report Tag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              If you have successfully tagged your target, report it here. They will need to confirm it.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="w-full sm:w-auto text-lg py-6 shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  I TAGGED {target.name.toUpperCase()}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you tagged {target.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will notify {target.name} that you have tagged them. They will have 1 hour to confirm or dispute. Make sure you actually completed a valid tag before reporting.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={reportTag}>Confirm Tag</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

       {/* Pending Confirmation View for Hunter */}
      {isAlive && target && target.status === 'pending_confirmation' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
               <Clock className="h-12 w-12 text-yellow-600 mb-2 animate-pulse" />
               <h3 className="text-xl font-bold text-yellow-700">Waiting for Confirmation</h3>
               <p className="text-yellow-600/80">
                 You reported tagging {target.name}. Waiting for them to confirm or dispute.
               </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disputed View for Hunter */}
      {isAlive && target && target.status === 'disputed' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
             <div className="flex flex-col items-center text-center">
               <ShieldAlert className="h-12 w-12 text-orange-600 mb-2" />
               <h3 className="text-xl font-bold text-orange-700">Tag Disputed</h3>
               <p className="text-orange-600/80">
                 {target.name} has disputed your tag. An admin will review this.
               </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game Rules Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Game Rules</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>Eliminate your target by <strong>brushing them with your toothbrush</strong> while their toothbrush is not visible or not on their person.</li>
            <li>Alert your target after eliminating them - they have <strong>1 hour to dispute</strong> or they're out.</li>
            <li>If your target confirms the elimination, you get their target.</li>
            <li>If disputed, both parties have 1 hour to send evidence (video, witnesses) to the Commissioner.</li>
            <li>You must <strong>SEND</strong> your video evidence to <strong className="text-primary">gannbrushergames@gannacademy.org</strong> - the Commissioner won't watch it on your phone.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Special Rules Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-primary uppercase tracking-widest flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Special Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {specialRules.length === 0 ? (
            <p className="text-muted-foreground italic">None yet! Stay tuned.</p>
          ) : (
            <ul className="space-y-3">
              {specialRules.map((rule) => (
                <li key={rule.id} className="border-l-2 border-primary/50 pl-3">
                  <span className="font-semibold text-foreground">{rule.title}</span>
                  <p className="text-muted-foreground mt-0.5">{rule.description}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Your Eliminations (Kill History Timeline) */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Swords className="h-4 w-4" />
            Your Eliminations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {killHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No eliminations yet</p>
          ) : (
            <div className="space-y-3">
              {killHistory.map((kill) => (
                <div key={kill.id} className="flex items-center gap-3 border-l-2 border-primary/40 pl-3">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{kill.victimName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(kill.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tag History (Dispute Timeline) */}
      {disputeTimeline.length > 0 && (
        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tag History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {disputeTimeline.map((event) => {
                const statusColors: Record<string, string> = {
                  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
                  confirmed: "bg-green-100 text-green-800 border-green-300",
                  disputed: "bg-orange-100 text-orange-800 border-orange-300",
                  denied: "bg-red-100 text-red-800 border-red-300",
                  expired: "bg-gray-100 text-gray-800 border-gray-300",
                };
                return (
                  <div key={event.id} className="flex items-center justify-between gap-3 border-l-2 border-muted-foreground/30 pl-3 py-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {event.role === 'hunter' ? (
                          <>You tagged <strong>{event.victimName}</strong></>
                        ) : (
                          <><strong>{event.hunterName}</strong> tagged you</>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[event.status] || ''}`}>
                      {event.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard & Kill Feed */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        <Leaderboard />
        <KillFeed />
      </div>

      {/* Feedback Form */}
      <div className="mt-12 pt-8 border-t border-border/50">
        <FeedbackForm />
      </div>
    </div>
  );
}
