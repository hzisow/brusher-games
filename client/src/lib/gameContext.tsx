import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type PlayerStatus = 'alive' | 'eliminated' | 'pending_confirmation' | 'disputed';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'player';
  status: PlayerStatus;
  targetId: string | null;
  kills: number;
}

interface GameContextType {
  currentUser: User | null;
  users: User[];
  isAdminAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  adminLogin: (password: string) => Promise<boolean>;
  reportTag: () => void;
  confirmDeath: () => void;
  disputeDeath: (message?: string) => void;
  adminRevivePlayer: (playerId: string) => void;
  adminAssignTargets: () => void;
  adminResolveDispute: (tagId: string, decision: 'revive' | 'confirm') => void;
  updateName: (name: string) => Promise<boolean>;
  isLoading: boolean;
  needsNameSetup: boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates with auto-reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const maxReconnectDelay = 30000; // Max 30 seconds between retries
    
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = () => {
        reconnectAttempts = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'game_state_update') {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['me'] });
        }
      };

      ws.onclose = () => {
        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [queryClient]);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setCurrentUser(data.user);
          setIsAdminAuthenticated(data.isAdmin);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch all users - reduced polling for 400+ users
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!currentUser,
    refetchInterval: 30000, // Poll every 30 seconds as backup (WebSocket handles real-time)
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  const signup = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
        setIsLoading(false);
        return false;
      }

      const user = await res.json();
      setCurrentUser(user);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsLoading(false);
      return true;
    } catch (error) {
      toast({ title: "Signup Failed", description: "Network error", variant: "destructive" });
      setIsLoading(false);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast({ title: "Login Failed", description: error.message, variant: "destructive" });
        setIsLoading(false);
        return false;
      }

      const user = await res.json();
      setCurrentUser(user);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsLoading(false);
      return true;
    } catch (error) {
      toast({ title: "Login Failed", description: "Network error", variant: "destructive" });
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setIsAdminAuthenticated(false);
    queryClient.clear();
  };

  const adminLogin = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        toast({ title: "Access Denied", description: "Incorrect password.", variant: "destructive" });
        return false;
      }

      setIsAdminAuthenticated(true);
      toast({ title: "Admin Access Granted", description: "Welcome to the command center." });
      return true;
    } catch (error) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
      return false;
    }
  };

  const reportTag = async () => {
    try {
      const res = await fetch('/api/tags/report', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to report tag');
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Tag Reported", description: "Your target has been notified." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to report tag", variant: "destructive" });
    }
  };

  const confirmDeath = async () => {
    try {
      const res = await fetch('/api/tags/confirm', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to confirm');
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast({ title: "Eliminated", description: "You have confirmed your elimination." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to confirm", variant: "destructive" });
    }
  };

  const disputeDeath = async (message?: string) => {
    try {
      const res = await fetch('/api/tags/dispute', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Failed to dispute');
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast({ title: "Dispute Filed", description: "An admin will review this case." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to dispute", variant: "destructive" });
    }
  };

  const adminRevivePlayer = async (playerId: string) => {
    try {
      const res = await fetch(`/api/admin/revive/${playerId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to revive');
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Player Revived", description: "Welcome back to the game." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to revive player", variant: "destructive" });
    }
  };

  const adminAssignTargets = async () => {
    try {
      const res = await fetch('/api/admin/shuffle-targets', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to shuffle');
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Targets Assigned", description: "All active players have new targets." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to shuffle targets", variant: "destructive" });
    }
  };

  const adminResolveDispute = async (tagId: string, decision: 'revive' | 'confirm') => {
    try {
      const res = await fetch(`/api/admin/resolve-dispute/${tagId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error('Failed to resolve');
      
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast({ 
        title: "Dispute Resolved", 
        description: decision === 'revive' ? "Player has been revived." : "Tag has been confirmed." 
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to resolve dispute", variant: "destructive" });
    }
  };

  const updateName = async (name: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        toast({ title: "Error", description: "Failed to update name", variant: "destructive" });
        return false;
      }

      const updatedUser = await res.json();
      setCurrentUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Welcome!", description: "Your name has been saved." });
      return true;
    } catch (error) {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
      return false;
    }
  };

  // Check if user needs to set up their name (name looks auto-generated from email)
  const needsNameSetup = currentUser ? 
    currentUser.name === currentUser.email.split('@')[0] || 
    /^[a-z0-9]+$/i.test(currentUser.name) && currentUser.name.length < 4 :
    false;

  // Keep currentUser in sync with users array
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const updatedUser = users.find((u: User) => u.id === currentUser.id);
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(updatedUser);
      }
    }
  }, [users, currentUser]);

  return (
    <GameContext.Provider value={{
      currentUser,
      users,
      isAdminAuthenticated,
      login,
      signup,
      logout,
      adminLogin,
      reportTag,
      confirmDeath,
      disputeDeath,
      adminRevivePlayer,
      adminAssignTargets,
      adminResolveDispute,
      updateName,
      isLoading,
      needsNameSetup
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
