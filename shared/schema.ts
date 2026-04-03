import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password"),
  role: text("role").notNull().default('player'),
  status: text("status").notNull().default('alive'),
  targetId: varchar("target_id"),
  kills: integer("kills").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tagEvents = pgTable("tag_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hunterId: varchar("hunter_id").notNull(),
  victimId: varchar("victim_id").notNull(),
  status: text("status").notNull().default('pending'),
  disputeMessage: text("dispute_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  kills: true,
  targetId: true,
  status: true,
});

export const insertTagEventSchema = createInsertSchema(tagEvents).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const feedbackReports = pgTable("feedback_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackReports).omit({
  id: true,
  createdAt: true,
});

// Announcements - admin mass messages
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
});

// Game Settings - pause/resume and global config
export const gameSettings = pgTable("game_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activity Logs - track all game actions
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  targetId: varchar("target_id"),
  targetName: text("target_name"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

// Rule Violations - player reports
export const ruleViolations = pgTable("rule_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull(),
  reporterName: text("reporter_name").notNull(),
  accusedId: varchar("accused_id").notNull(),
  accusedName: text("accused_name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default('pending'),
  resolvedBy: varchar("resolved_by"),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertRuleViolationSchema = createInsertSchema(ruleViolations).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  status: true,
  resolvedBy: true,
  resolution: true,
});

// Special Rules - admin-managed dynamic rules
export const specialRules = pgTable("special_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSpecialRuleSchema = createInsertSchema(specialRules).omit({
  id: true,
  createdAt: true,
  isActive: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTagEvent = z.infer<typeof insertTagEventSchema>;
export type TagEvent = typeof tagEvents.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type FeedbackReport = typeof feedbackReports.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertRuleViolation = z.infer<typeof insertRuleViolationSchema>;
export type RuleViolation = typeof ruleViolations.$inferSelect;
export type InsertSpecialRule = z.infer<typeof insertSpecialRuleSchema>;
export type SpecialRule = typeof specialRules.$inferSelect;
