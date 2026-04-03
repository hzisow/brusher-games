import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertTagEventSchema, insertFeedbackSchema } from "@shared/schema";
import { WebSocketServer } from "ws";
import * as msal from "@azure/msal-node";
import bcrypt from "bcrypt";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "goheifersbrushergames";

// Rate limiting: track recent actions per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ACTIONS_PER_WINDOW = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= MAX_ACTIONS_PER_WINDOW) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitMap.entries());
  for (const [userId, data] of entries) {
    if (now > data.resetTime) {
      rateLimitMap.delete(userId);
    }
  }
}, 60000);

// Microsoft OAuth Configuration - lazy initialization
let msalClient: msal.ConfidentialClientApplication | null = null;

function getMsalClient(): msal.ConfidentialClientApplication | null {
  if (msalClient) return msalClient;
  
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return null;
  }
  
  const msalConfig: msal.Configuration = {
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common",
      clientSecret,
    },
  };
  
  msalClient = new msal.ConfidentialClientApplication(msalConfig);
  return msalClient;
}

function getRedirectUri(req: Request) {
  // Handle x-forwarded-proto which can be a comma-separated list
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' 
    ? forwardedProto.split(',')[0].trim() 
    : req.protocol;
  
  // Handle x-forwarded-host which can also be a list
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string'
    ? forwardedHost.split(',')[0].trim()
    : req.get('host');
  
  // Always use https in production
  const finalProtocol = process.env.NODE_ENV === 'production' ? 'https' : protocol;
  
  return `${finalProtocol}://${host}/api/auth/microsoft/callback`;
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// WebSocket broadcast helper
let wss: WebSocketServer;

function broadcastGameState() {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'game_state_update' }));
      }
    });
  }
}

// Auto-elimination: process expired pending tags (1 hour timeout)
async function processExpiredTags() {
  try {
    const expiredTags = await storage.getExpiredPendingTags();
    let processedCount = 0;
    
    for (const tagEvent of expiredTags) {
      const victim = await storage.getUser(tagEvent.victimId);
      const hunter = await storage.getUser(tagEvent.hunterId);
      
      if (!victim || !hunter) continue;
      
      // Only auto-eliminate if victim is still pending confirmation
      // Skip if they already disputed, confirmed, or were revived
      if (victim.status !== 'pending_confirmation') {
        // Clean up the stale pending tag event
        await storage.updateTagEvent(tagEvent.id, {
          status: 'expired',
          resolvedAt: new Date(),
        });
        continue;
      }
      
      // Auto-confirm the tag (victim didn't respond in time)
      await storage.updateTagEvent(tagEvent.id, {
        status: 'confirmed',
        resolvedAt: new Date(),
      });
      
      await storage.updateUser(victim.id, {
        status: 'eliminated',
        targetId: null,
      });
      
      await storage.updateUser(hunter.id, {
        targetId: victim.targetId,
        kills: hunter.kills + 1,
      });
      
      await storage.createActivityLog({
        action: 'auto_eliminated',
        actorName: 'System',
        targetId: victim.id,
        targetName: victim.name,
        details: 'Eliminated automatically (no response within 1 hour)',
      });
      
      processedCount++;
    }
    
    if (processedCount > 0) {
      broadcastGameState();
    }
  } catch (error) {
    console.error('Error processing expired tags:', error);
  }
}

// Check for expired tags every minute
setInterval(processExpiredTags, 60000);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup WebSocket for real-time updates
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  // Microsoft OAuth Routes
  app.get("/api/auth/microsoft", async (req, res) => {
    try {
      const client = getMsalClient();
      if (!client) {
        return res.redirect("/login?error=microsoft_not_configured");
      }
      
      const redirectUri = getRedirectUri(req);
      
      const authCodeUrlParameters: msal.AuthorizationUrlRequest = {
        scopes: ["user.read", "openid", "profile", "email"],
        redirectUri,
      };

      const authUrl = await client.getAuthCodeUrl(authCodeUrlParameters);
      res.redirect(authUrl);
    } catch (error) {
      console.error("Microsoft auth error:", error);
      res.redirect("/login?error=auth_failed");
    }
  });

  app.get("/api/auth/microsoft/callback", async (req, res) => {
    try {
      const client = getMsalClient();
      if (!client) {
        return res.redirect("/login?error=microsoft_not_configured");
      }
      
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        return res.redirect("/login?error=no_code");
      }

      const redirectUri = getRedirectUri(req);
      
      const tokenRequest: msal.AuthorizationCodeRequest = {
        code,
        scopes: ["user.read", "openid", "profile", "email"],
        redirectUri,
      };

      const response = await client.acquireTokenByCode(tokenRequest);
      
      if (!response || !response.account) {
        return res.redirect("/login?error=no_account");
      }

      const email = response.account.username?.toLowerCase();
      const name = response.account.name || email?.split('@')[0] || 'Unknown';

      // Validate Gann Academy email
      if (!email || !email.endsWith('@gannacademy.org')) {
        return res.redirect("/login?error=invalid_email");
      }

      // Find or create user
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        user = await storage.createUser({
          name,
          email,
          role: 'player',
        });
      }

      req.session.userId = user.id;
      req.session.isAdmin = false;
      
      // Save session before redirect to ensure it persists
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.redirect("/login?error=session_failed");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Microsoft callback error:", error);
      res.redirect("/login?error=callback_failed");
    }
  });

  // Signup endpoint - create new account with password
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !email.endsWith('@gannacademy.org')) {
        return res.status(400).json({ message: "Invalid email. Must be @gannacademy.org" });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Account already exists. Please sign in instead." });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user with auto-generated name (they'll set it up later)
      const name = email.split('@')[0].replace(/[._]/g, ' ');
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: 'player',
      });

      req.session.userId = user.id;
      req.session.isAdmin = false;
      
      // Save session to ensure it persists
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session save failed" });
        }
        return res.json(user);
      });
    } catch (error) {
      console.error('Signup error:', error);
      return res.status(500).json({ message: "Signup failed" });
    }
  });

  // Login endpoint - authenticate with password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !email.endsWith('@gannacademy.org')) {
        return res.status(400).json({ message: "Invalid email. Must be @gannacademy.org" });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password is required (min. 6 characters)" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "No account found. Please sign up first." });
      }

      // If user has no password (created via Microsoft OAuth), reject
      if (!user.password) {
        return res.status(401).json({ message: "This account was created with Microsoft. Please use Microsoft sign-in." });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      req.session.userId = user.id;
      req.session.isAdmin = false;
      
      // Save session to ensure it persists
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session save failed" });
        }
        return res.json(user);
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/admin", async (req, res) => {
    try {
      const { password } = req.body;
      
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: "Invalid password" });
      }

      req.session.isAdmin = true;
      
      // Save session to ensure it persists
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session save failed" });
        }
        return res.json({ success: true });
      });
    } catch (error) {
      return res.status(500).json({ message: "Admin login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json({ user, isAdmin: req.session.isAdmin || false });
  });

  app.post("/api/auth/update-name", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name || name.trim().length < 2) {
        return res.status(400).json({ message: "Name is required" });
      }

      const user = await storage.updateUser(req.session.userId!, {
        name: name.trim(),
      });

      return res.json(user);
    } catch (error) {
      console.error('Update name error:', error);
      return res.status(500).json({ message: "Failed to update name" });
    }
  });

  // Game State Routes
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.json(users);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Tag Actions
  app.get("/api/tags/pending", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const tagEvent = await storage.getPendingTagForVictim(userId);
      
      if (!tagEvent) {
        return res.json(null);
      }
      
      const hunter = await storage.getUser(tagEvent.hunterId);
      const expiresAt = new Date(tagEvent.createdAt.getTime() + 60 * 60 * 1000);
      
      return res.json({
        id: tagEvent.id,
        hunterName: hunter?.name || 'Unknown',
        createdAt: tagEvent.createdAt,
        expiresAt,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch pending tag" });
    }
  });

  app.post("/api/tags/report", requireAuth, async (req, res) => {
    try {
      const hunterId = req.session.userId!;
      
      // Rate limiting
      if (!checkRateLimit(hunterId)) {
        return res.status(429).json({ message: "Too many requests. Please wait a moment." });
      }
      
      const hunter = await storage.getUser(hunterId);
      
      if (!hunter || !hunter.targetId) {
        return res.status(400).json({ message: "No target assigned" });
      }
      
      // Prevent self-tagging (safety check)
      if (hunter.targetId === hunterId) {
        return res.status(400).json({ message: "Cannot tag yourself" });
      }
      
      // Check if hunter is still alive
      if (hunter.status !== 'alive') {
        return res.status(400).json({ message: "You cannot report tags while eliminated" });
      }
      
      // Check for existing pending tag from this hunter (prevent double-reporting)
      const existingPending = await storage.getPendingTagByHunter(hunterId);
      if (existingPending) {
        return res.status(400).json({ message: "You already have a pending tag. Wait for confirmation." });
      }
      
      // Check if target is available to be tagged
      const target = await storage.getUser(hunter.targetId);
      if (!target || target.status !== 'alive') {
        return res.status(400).json({ message: "Target is not available to tag" });
      }

      const tagEvent = await storage.createTagEvent({
        hunterId,
        victimId: hunter.targetId,
        status: 'pending',
      });

      await storage.updateUser(hunter.targetId, {
        status: 'pending_confirmation',
      });

      broadcastGameState();
      return res.json(tagEvent);
    } catch (error) {
      console.error('Report tag error:', error);
      return res.status(500).json({ message: "Failed to report tag" });
    }
  });

  app.post("/api/tags/confirm", requireAuth, async (req, res) => {
    try {
      const victimId = req.session.userId!;
      const victim = await storage.getUser(victimId);
      
      if (!victim || victim.status !== 'pending_confirmation') {
        return res.status(400).json({ message: "No pending tag to confirm" });
      }

      const tagEvent = await storage.getPendingTagForVictim(victimId);
      if (!tagEvent) {
        return res.status(404).json({ message: "Tag event not found" });
      }

      const hunter = await storage.getUser(tagEvent.hunterId);
      if (!hunter) {
        return res.status(404).json({ message: "Hunter not found" });
      }

      await storage.updateTagEvent(tagEvent.id, {
        status: 'confirmed',
        resolvedAt: new Date(),
      });

      await storage.updateUser(victimId, {
        status: 'eliminated',
        targetId: null,
      });

      await storage.updateUser(hunter.id, {
        targetId: victim.targetId,
        kills: hunter.kills + 1,
      });

      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      console.error('Confirm tag error:', error);
      return res.status(500).json({ message: "Failed to confirm tag" });
    }
  });

  app.post("/api/tags/dispute", requireAuth, async (req, res) => {
    try {
      const victimId = req.session.userId!;
      const { message, evidenceData } = req.body;

      const tagEvent = await storage.getPendingTagForVictim(victimId);
      if (tagEvent) {
        await storage.updateTagEvent(tagEvent.id, {
          status: 'disputed',
          disputeMessage: message || null,
          evidenceData: evidenceData || null,
        });
      }

      await storage.updateUser(victimId, {
        status: 'disputed',
      });

      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to dispute tag" });
    }
  });

  // Admin Routes
  app.post("/api/admin/revive/:userId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      await storage.updateUser(userId, {
        status: 'alive',
      });

      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to revive player" });
    }
  });

  app.post("/api/admin/shuffle-targets", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const alivePlayers = users.filter(u => u.status === 'alive' && u.role === 'player');
      
      if (alivePlayers.length < 2) {
        return res.status(400).json({ message: "Need at least 2 alive players to assign targets" });
      }
      
      // Fisher-Yates shuffle for better randomization
      const shuffled = [...alivePlayers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const assignments = new Map<string, string>();
      
      for (let i = 0; i < shuffled.length; i++) {
        const hunter = shuffled[i];
        const target = shuffled[(i + 1) % shuffled.length];
        
        // Safety check: never assign self as target
        if (hunter.id === target.id) {
          return res.status(500).json({ message: "Target assignment error - please try again" });
        }
        
        assignments.set(hunter.id, target.id);
      }

      await storage.assignTargets(assignments);

      // Log the action
      await storage.createActivityLog({
        action: 'targets_shuffled',
        actorName: 'Admin',
        details: `Shuffled targets for ${assignments.size} players`,
      });

      broadcastGameState();
      return res.json({ success: true, assigned: assignments.size });
    } catch (error) {
      console.error('Shuffle targets error:', error);
      return res.status(500).json({ message: "Failed to shuffle targets" });
    }
  });

  // Feedback Routes
  app.post("/api/feedback", async (req, res) => {
    try {
      const { email, message } = req.body;
      
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }

      const feedback = await storage.createFeedback({
        email: email || null,
        message: message.trim(),
      });

      return res.json({ success: true, id: feedback.id });
    } catch (error) {
      console.error('Feedback error:', error);
      return res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  app.get("/api/admin/feedback", requireAuth, requireAdmin, async (req, res) => {
    try {
      const feedback = await storage.getAllFeedback();
      return res.json(feedback);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.get("/api/admin/disputes", requireAuth, requireAdmin, async (req, res) => {
    try {
      const disputes = await storage.getDisputedTags();
      const allUsers = await storage.getAllUsers();
      
      const enrichedDisputes = disputes.map(dispute => {
        const victim = allUsers.find(u => u.id === dispute.victimId);
        const hunter = allUsers.find(u => u.id === dispute.hunterId);
        return {
          ...dispute,
          victimName: victim?.name || 'Unknown',
          victimEmail: victim?.email || 'Unknown',
          hunterName: hunter?.name || 'Unknown',
          hunterEmail: hunter?.email || 'Unknown',
        };
      });
      
      return res.json(enrichedDisputes);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch disputes" });
    }
  });

  app.post("/api/admin/resolve-dispute/:tagId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { tagId } = req.params;
      const { decision } = req.body;
      
      const tagEvent = await storage.getTagEvent(tagId);
      if (!tagEvent) {
        return res.status(404).json({ message: "Dispute not found" });
      }
      
      if (decision === 'revive') {
        await storage.updateUser(tagEvent.victimId, { status: 'alive' });
        await storage.updateTagEvent(tagId, { status: 'denied', resolvedAt: new Date() });
      } else if (decision === 'confirm') {
        const hunter = await storage.getUser(tagEvent.hunterId);
        const victim = await storage.getUser(tagEvent.victimId);
        
        if (hunter && victim) {
          await storage.updateUser(tagEvent.victimId, { status: 'eliminated', targetId: null });
          await storage.updateUser(hunter.id, { targetId: victim.targetId, kills: hunter.kills + 1 });
          await storage.updateTagEvent(tagId, { status: 'confirmed', resolvedAt: new Date() });
        }
      }
      
      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to resolve dispute" });
    }
  });

  // Leaderboard - now returns all players (no limit)
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const leaderboard = allUsers
        .filter(u => u.role === 'player')
        .filter(u => {
          const trimmedName = u.name.trim();
          const hasSpace = trimmedName.includes(' ');
          const notEmail = !trimmedName.includes('@');
          return hasSpace && notEmail;
        })
        .map(u => ({
          id: u.id,
          name: u.name,
          kills: u.kills,
          status: u.status,
        }))
        .sort((a, b) => b.kills - a.kills);
      return res.json(leaderboard);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Kill Feed
  app.get("/api/kill-feed", async (req, res) => {
    try {
      const confirmedTags = await storage.getConfirmedTags(20);
      const allUsers = await storage.getAllUsers();
      
      const killFeed = confirmedTags.map(tag => {
        const hunter = allUsers.find(u => u.id === tag.hunterId);
        const victim = allUsers.find(u => u.id === tag.victimId);
        return {
          id: tag.id,
          hunterName: hunter?.name || 'Unknown',
          victimName: victim?.name || 'Unknown',
          timestamp: tag.resolvedAt,
        };
      });
      
      return res.json(killFeed);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch kill feed" });
    }
  });

  // Game Status (pause/resume)
  app.get("/api/game-status", async (req, res) => {
    try {
      const isPaused = await storage.getGameSetting('game_paused');
      const pauseMessage = await storage.getGameSetting('pause_message');
      return res.json({ 
        isPaused: isPaused === 'true',
        pauseMessage: pauseMessage || null,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch game status" });
    }
  });

  app.post("/api/admin/pause-game", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { message } = req.body;
      await storage.setGameSetting('game_paused', 'true');
      await storage.setGameSetting('pause_message', message || 'Game is currently paused');
      
      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: 'game_paused',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: message || 'Game paused',
      });
      
      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to pause game" });
    }
  });

  app.post("/api/admin/resume-game", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.setGameSetting('game_paused', 'false');
      await storage.setGameSetting('pause_message', '');
      
      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: 'game_resumed',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: 'Game resumed',
      });
      
      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to resume game" });
    }
  });

  // Announcements
  app.get("/api/announcements", async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements(10);
      return res.json(announcements);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.post("/api/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, message } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      const announcement = await storage.createAnnouncement({
        title,
        message,
        createdBy: req.session.userId!,
      });

      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: 'announcement_created',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: `Announcement: ${title}`,
      });

      broadcastGameState();
      return res.json(announcement);
    } catch (error) {
      return res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.delete("/api/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  // Activity Logs
  app.get("/api/admin/activity-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getActivityLogs(100);
      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Rule Violations
  app.post("/api/rule-violations", requireAuth, async (req, res) => {
    try {
      const { accusedId, description } = req.body;
      
      if (!accusedId || !description) {
        return res.status(400).json({ message: "Accused player and description are required" });
      }

      const reporter = await storage.getUser(req.session.userId!);
      const accused = await storage.getUser(accusedId);

      if (!reporter || !accused) {
        return res.status(404).json({ message: "User not found" });
      }

      const violation = await storage.createRuleViolation({
        reporterId: reporter.id,
        reporterName: reporter.name,
        accusedId: accused.id,
        accusedName: accused.name,
        description,
      });

      await storage.createActivityLog({
        action: 'rule_violation_reported',
        actorId: reporter.id,
        actorName: reporter.name,
        targetId: accused.id,
        targetName: accused.name,
        details: description,
      });

      return res.json(violation);
    } catch (error) {
      return res.status(500).json({ message: "Failed to report violation" });
    }
  });

  app.get("/api/admin/rule-violations", requireAuth, requireAdmin, async (req, res) => {
    try {
      const violations = await storage.getRuleViolations();
      return res.json(violations);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch violations" });
    }
  });

  app.post("/api/admin/rule-violations/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { resolution } = req.body;
      
      const admin = await storage.getUser(req.session.userId!);
      const violation = await storage.updateRuleViolation(req.params.id, {
        status: 'resolved',
        resolvedBy: req.session.userId,
        resolution,
        resolvedAt: new Date(),
      });

      await storage.createActivityLog({
        action: 'rule_violation_resolved',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: `Resolution: ${resolution}`,
      });

      return res.json(violation);
    } catch (error) {
      return res.status(500).json({ message: "Failed to resolve violation" });
    }
  });

  // Special Rules - public endpoint for active rules
  app.get("/api/special-rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getActiveSpecialRules();
      return res.json(rules);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch special rules" });
    }
  });

  // Special Rules - admin management
  app.get("/api/admin/special-rules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const rules = await storage.getAllSpecialRules();
      return res.json(rules);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch special rules" });
    }
  });

  app.post("/api/admin/special-rules", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, description } = req.body;
      
      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }

      const rule = await storage.createSpecialRule({
        title,
        description,
        createdBy: req.session.userId!,
      });

      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: 'special_rule_created',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: `Special rule: ${title}`,
      });

      broadcastGameState();
      return res.json(rule);
    } catch (error) {
      return res.status(500).json({ message: "Failed to create special rule" });
    }
  });

  app.patch("/api/admin/special-rules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { title, description, isActive } = req.body;
      
      const rule = await storage.updateSpecialRule(req.params.id, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      });

      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: 'special_rule_updated',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: `Updated special rule: ${rule?.title}`,
      });

      broadcastGameState();
      return res.json(rule);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update special rule" });
    }
  });

  app.delete("/api/admin/special-rules/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteSpecialRule(req.params.id);

      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: 'special_rule_deleted',
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: `Deleted special rule`,
      });

      broadcastGameState();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete special rule" });
    }
  });

  // Kill History - player's personal tag history
  app.get("/api/kill-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const tags = await storage.getTagsForUser(userId);
      const allUsers = await storage.getAllUsers();

      const history = tags
        .filter(t => t.status === 'confirmed' && t.hunterId === userId)
        .map(t => {
          const victim = allUsers.find(u => u.id === t.victimId);
          return {
            id: t.id,
            victimName: victim?.name || 'Unknown',
            timestamp: t.resolvedAt,
          };
        });

      return res.json(history);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch kill history" });
    }
  });

  // Dispute timeline - get tag events for current user with status info
  app.get("/api/dispute-timeline", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const tags = await storage.getTagsForUser(userId);
      const allUsers = await storage.getAllUsers();

      const timeline = tags.map(t => {
        const hunter = allUsers.find(u => u.id === t.hunterId);
        const victim = allUsers.find(u => u.id === t.victimId);
        return {
          id: t.id,
          hunterId: t.hunterId,
          victimId: t.victimId,
          hunterName: hunter?.name || 'Unknown',
          victimName: victim?.name || 'Unknown',
          status: t.status,
          disputeMessage: t.disputeMessage,
          createdAt: t.createdAt,
          resolvedAt: t.resolvedAt,
        };
      });

      return res.json(timeline);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch dispute timeline" });
    }
  });

  // Player count (public - for login page)
  app.get("/api/player-count", async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const players = allUsers.filter(u => u.role === 'player');
      return res.json({
        total: players.length,
        alive: players.filter(u => u.status === 'alive').length,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch player count" });
    }
  });

  // Admin stats
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const players = allUsers.filter(u => u.role === 'player');
      const logs = await storage.getActivityLogs(500);

      // Kills per day
      const killLogs = logs.filter(l => l.action === 'auto_eliminated' || l.action === 'tag_confirmed');
      const killsByDay: Record<string, number> = {};
      for (const log of killLogs) {
        const day = new Date(log.createdAt).toLocaleDateString();
        killsByDay[day] = (killsByDay[day] || 0) + 1;
      }

      // Top killers
      const topKillers = players
        .filter(u => u.kills > 0)
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 10)
        .map(u => ({ name: u.name, kills: u.kills }));

      // Status breakdown
      const statusBreakdown = {
        alive: players.filter(u => u.status === 'alive').length,
        eliminated: players.filter(u => u.status === 'eliminated').length,
        disputed: players.filter(u => u.status === 'disputed').length,
        pending: players.filter(u => u.status === 'pending_confirmation').length,
      };

      return res.json({
        totalPlayers: players.length,
        totalKills: players.reduce((sum, u) => sum + u.kills, 0),
        killsByDay,
        topKillers,
        statusBreakdown,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin bulk action
  app.post("/api/admin/bulk-action", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userIds, action } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "No users selected" });
      }

      if (action === 'eliminate') {
        await storage.bulkUpdateUsers(userIds, { status: 'eliminated', targetId: null });
      } else if (action === 'revive') {
        await storage.bulkUpdateUsers(userIds, { status: 'alive' });
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }

      const admin = await storage.getUser(req.session.userId!);
      await storage.createActivityLog({
        action: `bulk_${action}`,
        actorId: req.session.userId,
        actorName: admin?.name || 'Admin',
        details: `Bulk ${action} ${userIds.length} players`,
      });

      broadcastGameState();
      return res.json({ success: true, count: userIds.length });
    } catch (error) {
      return res.status(500).json({ message: "Failed to perform bulk action" });
    }
  });

  // Admin CSV export
  app.get("/api/admin/export/:type", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { type } = req.params;

      if (type === 'players') {
        const allUsers = await storage.getAllUsers();
        const csv = ['Name,Email,Status,Kills,Target ID,Created At']
          .concat(allUsers.map(u =>
            `"${u.name}","${u.email}","${u.status}",${u.kills},"${u.targetId || ''}","${u.createdAt}"`
          )).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=players.csv');
        return res.send(csv);
      } else if (type === 'kills') {
        const tags = await storage.getConfirmedTags(1000);
        const allUsers = await storage.getAllUsers();
        const csv = ['Hunter,Victim,Date']
          .concat(tags.map(t => {
            const hunter = allUsers.find(u => u.id === t.hunterId);
            const victim = allUsers.find(u => u.id === t.victimId);
            return `"${hunter?.name || 'Unknown'}","${victim?.name || 'Unknown'}","${t.resolvedAt || t.createdAt}"`;
          })).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=kills.csv');
        return res.send(csv);
      } else if (type === 'activity') {
        const logs = await storage.getActivityLogs(1000);
        const csv = ['Action,Actor,Target,Details,Date']
          .concat(logs.map(l =>
            `"${l.action}","${l.actorName || ''}","${l.targetName || ''}","${(l.details || '').replace(/"/g, '""')}","${l.createdAt}"`
          )).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=activity.csv');
        return res.send(csv);
      }

      return res.status(400).json({ message: "Invalid export type" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to export data" });
    }
  });

  return httpServer;
}
