import { pgTable, text, serial, integer, boolean, timestamp, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tasks schema
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  text: true,
  completed: true,
  dueDate: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Timer settings schema
export const timerSettings = pgTable("timer_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  defaultMinutes: integer("default_minutes").notNull().default(25),
  defaultSeconds: integer("default_seconds").notNull().default(0),
  alarmSound: text("alarm_sound").notNull().default("bell"),
  volume: integer("volume").notNull().default(80),
  autoStartBreak: boolean("auto_start_break").notNull().default(false),
  timerMode: text("timer_mode").notNull().default("pomodoro"), // pomodoro, countdown, stopwatch
  pomodoroMinutes: integer("pomodoro_minutes").notNull().default(25),
  shortBreakMinutes: integer("short_break_minutes").notNull().default(5),
  longBreakMinutes: integer("long_break_minutes").notNull().default(15),
  longBreakInterval: integer("long_break_interval").notNull().default(4),
  autoStartPomodoro: boolean("auto_start_pomodoro").notNull().default(false),
  // Stopwatch settings
  trackStopwatchTime: boolean("track_stopwatch_time").notNull().default(true),
  stopwatchDefaultCategory: text("stopwatch_default_category").default("General"),
  stopwatchAutoSave: boolean("stopwatch_auto_save").notNull().default(false),
  // Background image settings
  backgroundImage: text("background_image"),
  useCustomBackground: boolean("use_custom_background").notNull().default(false),
});

export const insertTimerSettingsSchema = createInsertSchema(timerSettings).pick({
  userId: true,
  defaultMinutes: true,
  defaultSeconds: true,
  alarmSound: true,
  volume: true,
  autoStartBreak: true,
  timerMode: true,
  pomodoroMinutes: true,
  shortBreakMinutes: true,
  longBreakMinutes: true,
  longBreakInterval: true,
  autoStartPomodoro: true,
  trackStopwatchTime: true,
  stopwatchDefaultCategory: true,
  stopwatchAutoSave: true,
  backgroundImage: true,
  useCustomBackground: true,
});

export type InsertTimerSettings = z.infer<typeof insertTimerSettingsSchema>;
export type TimerSettings = typeof timerSettings.$inferSelect;

// Study sessions schema to track study hours
export const studySessions = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  duration: integer("duration").default(0), // Duration in seconds
  timerType: text("timer_type").notNull(), // pomodoro, countdown, stopwatch
  tags: text("tags").array(), // Tags for categorizing study sessions
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
});

export const insertStudySessionSchema = createInsertSchema(studySessions).pick({
  userId: true,
  startTime: true,
  endTime: true,
  duration: true,
  timerType: true,
  tags: true,
  notes: true,
  completed: true,
});

export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessions.$inferSelect;

// Study statistics for tracking overall study time
export const studyStats = pgTable("study_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  totalStudyTime: integer("total_study_time").notNull().default(0), // Total time in seconds
  dailyGoal: integer("daily_goal").notNull().default(7200), // Default: 2 hours
  weeklyGoal: integer("weekly_goal").notNull().default(36000), // Default: 10 hours
  streakDays: integer("streak_days").notNull().default(0),
  lastStudyDate: timestamp("last_study_date"),
  timeByCategory: json("time_by_category").$type<Record<string, number>>().default({}),
});

export const insertStudyStatsSchema = createInsertSchema(studyStats).pick({
  userId: true,
  totalStudyTime: true,
  dailyGoal: true,
  weeklyGoal: true,
  streakDays: true,
  lastStudyDate: true,
  timeByCategory: true,
});

export type InsertStudyStats = z.infer<typeof insertStudyStatsSchema>;
export type StudyStats = typeof studyStats.$inferSelect;
