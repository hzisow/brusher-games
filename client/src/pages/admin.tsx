import { useState } from "react";
import { useGame } from "@/lib/gameContext";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, UserPlus, Trash2, Lock, ShieldAlert, MessageSquare, Megaphone, PauseCircle, PlayCircle, FileText, AlertOctagon, Clock, Zap, Plus, Search, Download, BarChart3, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";

interface DisputeDetail {
  id: string;
  hunterId: string;
  victimId: string;
  status: string;
  disputeMessage: string | null;
  createdAt: string;
  victimName: string;
  victimEmail: string;
  hunterName: string;
  hunterEmail: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  action: string;
  actorName: string | null;
  targetName: string | null;
  details: string | null;
  createdAt: string;
}

interface RuleViolation {
  id: string;
  reporterName: string;
  accusedName: string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
}

interface GameStatus {
  isPaused: boolean;
  pauseMessage: string | null;
}

interface AdminStats {
  totalPlayers: number;
  totalKills: number;
  killsByDay: Record<string, number>;
  topKillers: { name: string; kills: number }[];
  statusBreakdown: { alive: number; eliminated: number; disputed: number; pending: number };
}

interface SpecialRule {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const { users, currentUser, adminAssignTargets, adminRevivePlayer, adminLogin, isAdminAuthenticated, adminResolveDispute } = useGame();
  const [password, setPassword] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [pauseMessage, setPauseMessage] = useState("");
  const [specialRuleTitle, setSpecialRuleTitle] = useState("");
  const [specialRuleDescription, setSpecialRuleDescription] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: disputes = [] } = useQuery<DisputeDetail[]>({
    queryKey: ['disputes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/disputes');
      if (!res.ok) throw new Error('Failed to fetch disputes');
      return res.json();
    },
    enabled: isAdminAuthenticated,
    refetchInterval: 5000,
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['adminAnnouncements'],
    queryFn: async () => {
      const res = await fetch('/api/announcements');
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    },
    enabled: isAdminAuthenticated,
  });

  const { data: gameStatus } = useQuery<GameStatus>({
    queryKey: ['adminGameStatus'],
    queryFn: async () => {
      const res = await fetch('/api/game-status');
      if (!res.ok) throw new Error('Failed to fetch game status');
      return res.json();
    },
    enabled: isAdminAuthenticated,
  });

  const { data: activityLogs = [] } = useQuery<ActivityLog[]>({
    queryKey: ['activityLogs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/activity-logs');
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    },
    enabled: isAdminAuthenticated,
  });

  const { data: violations = [] } = useQuery<RuleViolation[]>({
    queryKey: ['ruleViolations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/rule-violations');
      if (!res.ok) throw new Error('Failed to fetch violations');
      return res.json();
    },
    enabled: isAdminAuthenticated,
  });

  const { data: specialRules = [] } = useQuery<SpecialRule[]>({
    queryKey: ['adminSpecialRules'],
    queryFn: async () => {
      const res = await fetch('/api/admin/special-rules');
      if (!res.ok) throw new Error('Failed to fetch special rules');
      return res.json();
    },
    enabled: isAdminAuthenticated,
  });

  const { data: adminStats } = useQuery<AdminStats>({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: isAdminAuthenticated,
    refetchInterval: 10000,
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async ({ title, message }: { title: string; message: string }) => {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message }),
      });
      if (!res.ok) throw new Error('Failed to create announcement');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setAnnouncementTitle('');
      setAnnouncementMessage('');
    },
  });

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete announcement');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminAnnouncements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const pauseGameMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch('/api/admin/pause-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Failed to pause game');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGameStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
      setPauseMessage('');
    },
  });

  const resumeGameMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/resume-game', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resume game');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminGameStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gameStatus'] });
    },
  });

  const resolveViolationMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      const res = await fetch(`/api/admin/rule-violations/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) throw new Error('Failed to resolve violation');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ruleViolations'] });
    },
  });

  const createSpecialRuleMutation = useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      const res = await fetch('/api/admin/special-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error('Failed to create special rule');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSpecialRules'] });
      queryClient.invalidateQueries({ queryKey: ['specialRules'] });
      setSpecialRuleTitle('');
      setSpecialRuleDescription('');
    },
  });

  const toggleSpecialRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/special-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update special rule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSpecialRules'] });
      queryClient.invalidateQueries({ queryKey: ['specialRules'] });
    },
  });

  const deleteSpecialRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/special-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete special rule');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSpecialRules'] });
      queryClient.invalidateQueries({ queryKey: ['specialRules'] });
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ userIds, action }: { userIds: string[]; action: 'eliminate' | 'revive' }) => {
      const res = await fetch('/api/admin/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, action }),
      });
      if (!res.ok) throw new Error('Failed to perform bulk action');
      return res.json();
    },
    onSuccess: () => {
      setSelectedUsers(new Set());
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
    },
  });

  if (!currentUser) {
    return <div className="text-center py-20 text-muted-foreground">Please log in first</div>;
  }

  // Admin Login Screen
  if (!isAdminAuthenticated) {
    return (
      <div className="flex justify-center py-20">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Admin Access
            </CardTitle>
            <CardDescription>Enter the command password to proceed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); adminLogin(password); }} className="space-y-4">
              <Input 
                type="password" 
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">Unlock Dashboard</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aliveCount = users.filter(u => u.status === 'alive').length;
  const eliminatedCount = users.filter(u => u.status === 'eliminated').length;
  const disputedCount = users.filter(u => u.status === 'disputed').length;

  const pendingViolations = violations.filter(v => v.status === 'pending');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Game Control</h1>
          <p className="text-muted-foreground">Manage players, announcements, and resolve disputes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {gameStatus?.isPaused ? (
            <Button onClick={() => resumeGameMutation.mutate()} variant="default" className="gap-2 bg-green-600 hover:bg-green-700" size="sm">
              <PlayCircle className="h-4 w-4" /> <span className="hidden sm:inline">Resume</span> Game
            </Button>
          ) : (
            <Button onClick={() => pauseGameMutation.mutate(pauseMessage || 'Game paused by admin')} variant="outline" className="gap-2 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10" size="sm">
              <PauseCircle className="h-4 w-4" /> <span className="hidden sm:inline">Pause</span> Game
            </Button>
          )}
          <Button onClick={adminAssignTargets} variant="outline" className="gap-2 bg-background" size="sm">
            <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Shuffle</span> Targets
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{users.length}</div>
            <div className="text-xs text-muted-foreground">Total Players</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{aliveCount}</div>
            <div className="text-xs text-green-500/70">Alive</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{eliminatedCount}</div>
            <div className="text-xs text-red-500/70">Eliminated</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{disputedCount}</div>
            <div className="text-xs text-yellow-500/70">Disputes</div>
          </CardContent>
        </Card>
        <Card className={gameStatus?.isPaused ? "bg-orange-500/10 border-orange-500/20" : "bg-blue-500/10 border-blue-500/20"}>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${gameStatus?.isPaused ? 'text-orange-500' : 'text-blue-500'}`}>
              {gameStatus?.isPaused ? 'PAUSED' : 'ACTIVE'}
            </div>
            <div className={`text-xs ${gameStatus?.isPaused ? 'text-orange-500/70' : 'text-blue-500/70'}`}>Game Status</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="disputes" className="w-full">
        <TabsList className="w-full h-auto flex-wrap grid grid-cols-4 sm:grid-cols-7 gap-1">
          <TabsTrigger value="disputes" className="gap-1 text-xs sm:text-sm px-2">
            <ShieldAlert className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">Disputes</span> {disputes.length > 0 && `(${disputes.length})`}
          </TabsTrigger>
          <TabsTrigger value="players" className="gap-1 text-xs sm:text-sm px-2">
            Players
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1 text-xs sm:text-sm px-2">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1 text-xs sm:text-sm px-2">
            <Megaphone className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Announce</span>
          </TabsTrigger>
          <TabsTrigger value="specialrules" className="gap-1 text-xs sm:text-sm px-2">
            <Zap className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Rules</span>
          </TabsTrigger>
          <TabsTrigger value="violations" className="gap-1 text-xs sm:text-sm px-2">
            <AlertOctagon className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">Reports</span> {pendingViolations.length > 0 && `(${pendingViolations.length})`}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1 text-xs sm:text-sm px-2">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" /> <span className="hidden xs:inline">Activity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disputes" className="mt-6">
          {disputes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No active disputes
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {disputes.map(dispute => (
                <Card key={dispute.id} className="border-yellow-500/20 bg-yellow-500/10">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Victim (disputing)</p>
                        <p className="font-bold text-lg">{dispute.victimName}</p>
                        <p className="text-xs text-muted-foreground">{dispute.victimEmail}</p>
                      </div>
                      <div className="text-center text-muted-foreground text-sm self-center">
                        tagged by →
                      </div>
                      <div className="sm:text-right">
                        <p className="text-sm text-muted-foreground">Hunter (claiming tag)</p>
                        <p className="font-bold text-lg">{dispute.hunterName}</p>
                        <p className="text-xs text-muted-foreground">{dispute.hunterEmail}</p>
                      </div>
                    </div>
                    
                    {dispute.disputeMessage && (
                      <div className="bg-background border border-yellow-500/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-yellow-500 mb-1">Dispute Reason:</p>
                            <p className="text-sm text-foreground">{dispute.disputeMessage}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2 justify-end pt-2 border-t border-yellow-500/20">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20" 
                        onClick={() => adminResolveDispute(dispute.id, 'revive')}
                        data-testid={`button-revive-${dispute.id}`}
                      >
                        Revive Player (Invalid Tag)
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => adminResolveDispute(dispute.id, 'confirm')}
                        data-testid={`button-confirm-kill-${dispute.id}`}
                      >
                        Confirm Kill (Valid Tag)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="players" className="mt-6">
          <Card className="border-border shadow-sm bg-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle>Player Registry</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => window.location.href = '/api/admin/export/players'}>
                    <Download className="h-3 w-3" /> Export Players CSV
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => window.location.href = '/api/admin/export/kills'}>
                    <Download className="h-3 w-3" /> Export Kills CSV
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => window.location.href = '/api/admin/export/activity'}>
                    <Download className="h-3 w-3" /> Export Activity CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search players by name or email..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {selectedUsers.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => bulkActionMutation.mutate({ userIds: Array.from(selectedUsers), action: 'eliminate' })}
                      disabled={bulkActionMutation.isPending}
                    >
                      Eliminate Selected ({selectedUsers.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-green-500 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => bulkActionMutation.mutate({ userIds: Array.from(selectedUsers), action: 'revive' })}
                      disabled={bulkActionMutation.isPending}
                    >
                      Revive Selected ({selectedUsers.size})
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-muted/50 border-border">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={users.length > 0 && selectedUsers.size === users.filter(u => {
                            const search = playerSearch.toLowerCase();
                            return !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
                          }).length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const filtered = users.filter(u => {
                                const search = playerSearch.toLowerCase();
                                return !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
                              });
                              setSelectedUsers(new Set(filtered.map(u => u.id)));
                            } else {
                              setSelectedUsers(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[100px]">Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Target</TableHead>
                      <TableHead>Kills</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter(user => {
                        const search = playerSearch.toLowerCase();
                        if (!search) return true;
                        return user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
                      })
                      .map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50 border-border">
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedUsers);
                              if (checked) {
                                next.add(user.id);
                              } else {
                                next.delete(user.id);
                              }
                              setSelectedUsers(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs hidden sm:table-cell max-w-[150px] truncate">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.status === 'alive' ? 'default' :
                            user.status === 'pending_confirmation' ? 'secondary' :
                            'destructive'
                          } className={`text-xs ${user.status === 'disputed' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}`}>
                            {user.status === 'pending_confirmation' ? 'pending' : user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden md:table-cell">
                          {user.targetId ? users.find(u => u.id === user.targetId)?.name : '-'}
                        </TableCell>
                        <TableCell>{user.kills}</TableCell>
                        <TableCell className="text-right">
                          {user.status !== 'alive' && (
                            <Button size="sm" variant="outline" onClick={() => adminRevivePlayer(user.id)} className="h-7 text-xs gap-1 text-green-500 border-green-500/20 hover:bg-green-500/10">
                              <UserPlus className="h-3 w-3" /> <span className="hidden sm:inline">Revive</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-6 space-y-6">
          {adminStats ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-foreground">{adminStats.totalPlayers}</div>
                    <div className="text-xs text-muted-foreground">Total Players</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-foreground">{adminStats.totalKills}</div>
                    <div className="text-xs text-muted-foreground">Total Kills</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-foreground">
                      {adminStats.totalPlayers > 0 ? (adminStats.totalKills / adminStats.totalPlayers).toFixed(1) : '0'}
                    </div>
                    <div className="text-xs text-muted-foreground">Avg Kills per Player</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" /> Top Killers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {adminStats.topKillers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No kills recorded yet</p>
                  ) : (
                    adminStats.topKillers.map((killer, i) => {
                      const maxKills = adminStats.topKillers[0]?.kills || 1;
                      const pct = (killer.kills / maxKills) * 100;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{killer.name}</span>
                            <span className="text-muted-foreground">{killer.kills} kills</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5">
                            <div
                              className="bg-primary h-2.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-sm px-3 py-1">
                      Alive: {adminStats.statusBreakdown.alive}
                    </Badge>
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-sm px-3 py-1">
                      Eliminated: {adminStats.statusBreakdown.eliminated}
                    </Badge>
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-sm px-3 py-1">
                      Disputed: {adminStats.statusBreakdown.disputed}
                    </Badge>
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-sm px-3 py-1">
                      Pending: {adminStats.statusBreakdown.pending}
                    </Badge>
                  </div>
                  <div className="mt-4 w-full bg-muted rounded-full h-4 flex overflow-hidden">
                    {adminStats.totalPlayers > 0 && (
                      <>
                        <div
                          className="bg-green-500 h-4 transition-all"
                          style={{ width: `${(adminStats.statusBreakdown.alive / adminStats.totalPlayers) * 100}%` }}
                          title={`Alive: ${adminStats.statusBreakdown.alive}`}
                        />
                        <div
                          className="bg-red-500 h-4 transition-all"
                          style={{ width: `${(adminStats.statusBreakdown.eliminated / adminStats.totalPlayers) * 100}%` }}
                          title={`Eliminated: ${adminStats.statusBreakdown.eliminated}`}
                        />
                        <div
                          className="bg-yellow-500 h-4 transition-all"
                          style={{ width: `${(adminStats.statusBreakdown.disputed / adminStats.totalPlayers) * 100}%` }}
                          title={`Disputed: ${adminStats.statusBreakdown.disputed}`}
                        />
                        <div
                          className="bg-blue-500 h-4 transition-all"
                          style={{ width: `${(adminStats.statusBreakdown.pending / adminStats.totalPlayers) * 100}%` }}
                          title={`Pending: ${adminStats.statusBreakdown.pending}`}
                        />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-border">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Loading stats...
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="announcements" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" /> New Announcement
              </CardTitle>
              <CardDescription>Send a message to all players</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Announcement title"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
              />
              <Textarea
                placeholder="Announcement message..."
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                className="min-h-[80px]"
              />
              <Button 
                onClick={() => createAnnouncementMutation.mutate({ title: announcementTitle, message: announcementMessage })}
                disabled={!announcementTitle.trim() || !announcementMessage.trim() || createAnnouncementMutation.isPending}
                className="w-full"
              >
                <Megaphone className="h-4 w-4 mr-2" /> Send Announcement
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Previous Announcements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {announcements.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No announcements yet</p>
              ) : (
                announcements.map(a => (
                  <div key={a.id} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteAnnouncementMutation.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specialrules" className="mt-6 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" /> Add Special Rule
              </CardTitle>
              <CardDescription>Add dynamic rules that display to all players</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Rule title (e.g., 'Safe Zone Update')"
                value={specialRuleTitle}
                onChange={(e) => setSpecialRuleTitle(e.target.value)}
              />
              <Textarea
                placeholder="Rule description..."
                value={specialRuleDescription}
                onChange={(e) => setSpecialRuleDescription(e.target.value)}
                className="min-h-[80px]"
              />
              <Button 
                onClick={() => createSpecialRuleMutation.mutate({ title: specialRuleTitle, description: specialRuleDescription })}
                disabled={!specialRuleTitle.trim() || !specialRuleDescription.trim() || createSpecialRuleMutation.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Special Rule
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Current Special Rules</CardTitle>
              <CardDescription>Toggle rules on/off or delete them</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {specialRules.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No special rules yet</p>
              ) : (
                specialRules.map(rule => (
                  <div key={rule.id} className={`flex items-start justify-between p-3 border rounded-lg ${rule.isActive ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rule.title}</p>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(rule.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => toggleSpecialRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                      >
                        {rule.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteSpecialRuleMutation.mutate(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="mt-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertOctagon className="h-5 w-5" /> Rule Violation Reports
              </CardTitle>
              <CardDescription>Review player-submitted rule violation reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {violations.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No reports submitted</p>
              ) : (
                violations.map(v => (
                  <div key={v.id} className={`p-4 border rounded-lg ${v.status === 'pending' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-muted/30'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{v.reporterName} reported {v.accusedName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant={v.status === 'pending' ? 'secondary' : 'default'}>
                        {v.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mb-3 p-2 bg-background rounded border">{v.description}</p>
                    {v.status === 'resolved' && v.resolution && (
                      <p className="text-sm text-green-500 bg-green-500/10 p-2 rounded">Resolution: {v.resolution}</p>
                    )}
                    {v.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => resolveViolationMutation.mutate({ id: v.id, resolution: 'Reviewed - No action needed' })}
                        >
                          Dismiss
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => resolveViolationMutation.mutate({ id: v.id, resolution: 'Action taken against violator' })}
                        >
                          Take Action
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Activity Log
              </CardTitle>
              <CardDescription>Recent game and admin actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {activityLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No activity logged yet</p>
                ) : (
                  activityLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-2 border-b last:border-0">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{log.actorName || 'System'}</span>
                          {' - '}
                          <span className="text-muted-foreground">{log.action.replace(/_/g, ' ')}</span>
                          {log.targetName && <span> → {log.targetName}</span>}
                        </p>
                        {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
