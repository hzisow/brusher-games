import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  type User, type InsertUser, 
  type TagEvent, type InsertTagEvent, 
  type InsertFeedback, type FeedbackReport, 
  type Announcement, type InsertAnnouncement,
  type ActivityLog, type InsertActivityLog,
  type RuleViolation, type InsertRuleViolation,
  type SpecialRule, type InsertSpecialRule,
  users, tagEvents, feedbackReports, announcements, gameSettings, activityLogs, ruleViolations, specialRules 
} from "@shared/schema";

const { Pool } = pg;

// Increased pool size for 400+ concurrent users
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle(pool);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined>;
  
  // Tag operations
  createTagEvent(tagEvent: InsertTagEvent): Promise<TagEvent>;
  getTagEvent(id: string): Promise<TagEvent | undefined>;
  getPendingTagForVictim(victimId: string): Promise<TagEvent | undefined>;
  getPendingTagByHunter(hunterId: string): Promise<TagEvent | undefined>;
  getExpiredPendingTags(): Promise<TagEvent[]>;
  getDisputedTags(): Promise<TagEvent[]>;
  getConfirmedTags(limit?: number): Promise<TagEvent[]>;
  updateTagEvent(id: string, updates: Partial<Omit<TagEvent, 'id' | 'createdAt'>>): Promise<TagEvent | undefined>;
  
  // Game operations
  assignTargets(assignments: Map<string, string>): Promise<void>;
  
  // Feedback operations
  createFeedback(feedback: InsertFeedback): Promise<FeedbackReport>;
  getAllFeedback(): Promise<FeedbackReport[]>;
  
  // Announcement operations
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getAnnouncements(limit?: number): Promise<Announcement[]>;
  deleteAnnouncement(id: string): Promise<void>;
  
  // Game settings operations
  getGameSetting(key: string): Promise<string | undefined>;
  setGameSetting(key: string, value: string): Promise<void>;
  
  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  
  // Rule violation operations
  createRuleViolation(report: InsertRuleViolation): Promise<RuleViolation>;
  getRuleViolations(): Promise<RuleViolation[]>;
  updateRuleViolation(id: string, updates: Partial<Omit<RuleViolation, 'id' | 'createdAt'>>): Promise<RuleViolation | undefined>;
  
  // Special rules operations
  createSpecialRule(rule: InsertSpecialRule): Promise<SpecialRule>;
  getActiveSpecialRules(): Promise<SpecialRule[]>;
  getAllSpecialRules(): Promise<SpecialRule[]>;
  updateSpecialRule(id: string, updates: Partial<Omit<SpecialRule, 'id' | 'createdAt'>>): Promise<SpecialRule | undefined>;
  deleteSpecialRule(id: string): Promise<void>;

  // Kill history
  getTagsForUser(userId: string): Promise<TagEvent[]>;

  // Bulk operations
  bulkUpdateUsers(userIds: string[], updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  // Tag operations
  async createTagEvent(tagEvent: InsertTagEvent): Promise<TagEvent> {
    const result = await db.insert(tagEvents).values(tagEvent).returning();
    return result[0];
  }

  async getTagEvent(id: string): Promise<TagEvent | undefined> {
    const result = await db.select().from(tagEvents).where(eq(tagEvents.id, id)).limit(1);
    return result[0];
  }

  async getPendingTagForVictim(victimId: string): Promise<TagEvent | undefined> {
    const result = await db
      .select()
      .from(tagEvents)
      .where(and(eq(tagEvents.victimId, victimId), eq(tagEvents.status, 'pending')))
      .limit(1);
    return result[0];
  }

  async getPendingTagByHunter(hunterId: string): Promise<TagEvent | undefined> {
    const result = await db
      .select()
      .from(tagEvents)
      .where(and(eq(tagEvents.hunterId, hunterId), eq(tagEvents.status, 'pending')))
      .limit(1);
    return result[0];
  }

  async getExpiredPendingTags(): Promise<TagEvent[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return await db
      .select()
      .from(tagEvents)
      .where(
        and(
          eq(tagEvents.status, 'pending'),
          sql`${tagEvents.createdAt} < ${oneHourAgo}`
        )
      );
  }

  async getDisputedTags(): Promise<TagEvent[]> {
    return await db
      .select()
      .from(tagEvents)
      .where(eq(tagEvents.status, 'disputed'));
  }

  async getConfirmedTags(limit: number = 20): Promise<TagEvent[]> {
    return await db
      .select()
      .from(tagEvents)
      .where(eq(tagEvents.status, 'confirmed'))
      .orderBy(desc(tagEvents.resolvedAt))
      .limit(limit);
  }

  async updateTagEvent(id: string, updates: Partial<Omit<TagEvent, 'id' | 'createdAt'>>): Promise<TagEvent | undefined> {
    const result = await db.update(tagEvents).set(updates).where(eq(tagEvents.id, id)).returning();
    return result[0];
  }

  // Game operations - uses transaction for atomic batch updates
  async assignTargets(assignments: Map<string, string>): Promise<void> {
    const entries = Array.from(assignments.entries());
    if (entries.length === 0) return;
    
    // Use a transaction to ensure all assignments happen atomically
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Build batch update query for better performance
      const updatePromises = entries.map(([hunterId, targetId]) => 
        client.query('UPDATE users SET target_id = $1 WHERE id = $2', [targetId, hunterId])
      );
      
      await Promise.all(updatePromises);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Feedback operations
  async createFeedback(feedback: InsertFeedback): Promise<FeedbackReport> {
    const result = await db.insert(feedbackReports).values(feedback).returning();
    return result[0];
  }

  async getAllFeedback(): Promise<FeedbackReport[]> {
    return await db.select().from(feedbackReports);
  }

  // Announcement operations
  async createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement> {
    const result = await db.insert(announcements).values(announcement).returning();
    return result[0];
  }

  async getAnnouncements(limit: number = 10): Promise<Announcement[]> {
    return await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(limit);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  // Game settings operations
  async getGameSetting(key: string): Promise<string | undefined> {
    const result = await db.select().from(gameSettings).where(eq(gameSettings.key, key)).limit(1);
    return result[0]?.value;
  }

  async setGameSetting(key: string, value: string): Promise<void> {
    const existing = await this.getGameSetting(key);
    if (existing !== undefined) {
      await db.update(gameSettings).set({ value, updatedAt: new Date() }).where(eq(gameSettings.key, key));
    } else {
      await db.insert(gameSettings).values({ key, value });
    }
  }

  // Activity log operations
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(log).returning();
    return result[0];
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  // Rule violation operations
  async createRuleViolation(report: InsertRuleViolation): Promise<RuleViolation> {
    const result = await db.insert(ruleViolations).values(report).returning();
    return result[0];
  }

  async getRuleViolations(): Promise<RuleViolation[]> {
    return await db
      .select()
      .from(ruleViolations)
      .orderBy(desc(ruleViolations.createdAt));
  }

  async updateRuleViolation(id: string, updates: Partial<Omit<RuleViolation, 'id' | 'createdAt'>>): Promise<RuleViolation | undefined> {
    const result = await db.update(ruleViolations).set(updates).where(eq(ruleViolations.id, id)).returning();
    return result[0];
  }

  // Special rules operations
  async createSpecialRule(rule: InsertSpecialRule): Promise<SpecialRule> {
    const result = await db.insert(specialRules).values(rule).returning();
    return result[0];
  }

  async getActiveSpecialRules(): Promise<SpecialRule[]> {
    return await db
      .select()
      .from(specialRules)
      .where(eq(specialRules.isActive, true))
      .orderBy(desc(specialRules.createdAt));
  }

  async getAllSpecialRules(): Promise<SpecialRule[]> {
    return await db
      .select()
      .from(specialRules)
      .orderBy(desc(specialRules.createdAt));
  }

  async updateSpecialRule(id: string, updates: Partial<Omit<SpecialRule, 'id' | 'createdAt'>>): Promise<SpecialRule | undefined> {
    const result = await db.update(specialRules).set(updates).where(eq(specialRules.id, id)).returning();
    return result[0];
  }

  async deleteSpecialRule(id: string): Promise<void> {
    await db.delete(specialRules).where(eq(specialRules.id, id));
  }

  // Kill history - get all tags involving a user (as hunter or victim)
  async getTagsForUser(userId: string): Promise<TagEvent[]> {
    return await db
      .select()
      .from(tagEvents)
      .where(
        sql`${tagEvents.hunterId} = ${userId} OR ${tagEvents.victimId} = ${userId}`
      )
      .orderBy(desc(tagEvents.createdAt));
  }

  // Bulk update users
  async bulkUpdateUsers(userIds: string[], updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of userIds) {
        await db.update(users).set(updates).where(eq(users.id, id));
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const storage = new DatabaseStorage();
