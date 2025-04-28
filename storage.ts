import { 
  tasks, type Task, type InsertTask, 
  timerSettings, type TimerSettings, type InsertTimerSettings, 
  users, type User, type InsertUser,
  studySessions, type StudySession, type InsertStudySession,
  studyStats, type StudyStats, type InsertStudyStats
} from "@shared/schema";
import { db } from './db';
import { eq, desc, and, isNull, gte, lte, sql } from 'drizzle-orm';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Task methods
  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // Timer settings methods
  getTimerSettings(): Promise<TimerSettings | undefined>;
  updateTimerSettings(settings: Partial<InsertTimerSettings>): Promise<TimerSettings>;

  // Study Session methods
  getStudySessions(): Promise<StudySession[]>;
  getStudySession(id: number): Promise<StudySession | undefined>;
  createStudySession(session: InsertStudySession): Promise<StudySession>;
  updateStudySession(id: number, session: Partial<InsertStudySession>): Promise<StudySession | undefined>;
  deleteStudySession(id: number): Promise<boolean>;
  getStudySessionsByDateRange(startDate: Date, endDate: Date): Promise<StudySession[]>;
  
  // Study Stats methods
  getStudyStats(): Promise<StudyStats | undefined>;
  updateStudyStats(stats: Partial<InsertStudyStats>): Promise<StudyStats>;
  increaseStudyTime(seconds: number, category?: string): Promise<StudyStats>;
}

// Memory-based storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tasksMap: Map<number, Task>;
  private timerSettingsInstance: TimerSettings | undefined;
  private studySessionsMap: Map<number, StudySession>;
  private studyStatsInstance: StudyStats | undefined;
  private userId: number;
  private taskId: number;
  private sessionId: number;

  constructor() {
    this.users = new Map();
    this.tasksMap = new Map();
    this.studySessionsMap = new Map();
    this.userId = 1;
    this.taskId = 1;
    this.sessionId = 1;
    
    // Initialize with default timer settings
    this.timerSettingsInstance = {
      id: 1,
      userId: null,
      defaultMinutes: 25,
      defaultSeconds: 0,
      alarmSound: "bell",
      volume: 80,
      autoStartBreak: false,
      timerMode: "pomodoro",
      pomodoroMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
      autoStartPomodoro: false,
      trackStopwatchTime: true,
      stopwatchDefaultCategory: "General",
      stopwatchAutoSave: false
    };
    
    // Initialize with default study stats
    this.studyStatsInstance = {
      id: 1,
      userId: null,
      totalStudyTime: 0,
      dailyGoal: 7200, // 2 hours in seconds
      weeklyGoal: 36000, // 10 hours in seconds
      streakDays: 0,
      lastStudyDate: null,
      timeByCategory: {}
    };
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Task methods
  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasksMap.values()).sort((a, b) => {
      // Sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getTask(id: number): Promise<Task | undefined> {
    return this.tasksMap.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = this.taskId++;
    const createdAt = new Date();
    const task: Task = { 
      ...insertTask, 
      id, 
      createdAt,
      completed: insertTask.completed ?? false,
      dueDate: insertTask.dueDate ?? null
    };
    this.tasksMap.set(id, task);
    return task;
  }

  async updateTask(id: number, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasksMap.get(id);
    if (!task) return undefined;

    const updatedTask: Task = {
      ...task,
      ...updateData,
    };

    this.tasksMap.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: number): Promise<boolean> {
    return this.tasksMap.delete(id);
  }

  // Timer settings methods
  async getTimerSettings(): Promise<TimerSettings | undefined> {
    return this.timerSettingsInstance;
  }

  async updateTimerSettings(settings: Partial<InsertTimerSettings>): Promise<TimerSettings> {
    if (!this.timerSettingsInstance) {
      const defaultSettings: TimerSettings = {
        id: 1,
        userId: null,
        defaultMinutes: 25,
        defaultSeconds: 0,
        alarmSound: "bell",
        volume: 80,
        autoStartBreak: false,
        timerMode: "pomodoro",
        pomodoroMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 4,
        autoStartPomodoro: false,
        trackStopwatchTime: true,
        stopwatchDefaultCategory: "General",
        stopwatchAutoSave: false
      };
      
      this.timerSettingsInstance = {
        ...defaultSettings,
        ...settings
      };
    } else {
      this.timerSettingsInstance = {
        ...this.timerSettingsInstance,
        ...settings
      };
    }
    
    return this.timerSettingsInstance;
  }
  
  // Study Session methods
  async getStudySessions(): Promise<StudySession[]> {
    return Array.from(this.studySessionsMap.values()).sort((a, b) => {
      // Sort by start time (newest first)
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }

  async getStudySession(id: number): Promise<StudySession | undefined> {
    return this.studySessionsMap.get(id);
  }

  async createStudySession(session: InsertStudySession): Promise<StudySession> {
    const id = this.sessionId++;
    const studySession: StudySession = {
      ...session,
      id,
      userId: session.userId ?? null,
      startTime: session.startTime || new Date(),
      endTime: session.endTime ?? null,
      tags: session.tags || [],
      completed: session.completed || false,
      duration: session.duration || 0,
      timerType: session.timerType || "pomodoro",
      notes: session.notes ?? null
    };
    
    this.studySessionsMap.set(id, studySession);
    return studySession;
  }

  async updateStudySession(id: number, sessionData: Partial<InsertStudySession>): Promise<StudySession | undefined> {
    const session = this.studySessionsMap.get(id);
    if (!session) return undefined;

    const updatedSession: StudySession = {
      ...session,
      ...sessionData
    };

    this.studySessionsMap.set(id, updatedSession);
    return updatedSession;
  }

  async deleteStudySession(id: number): Promise<boolean> {
    return this.studySessionsMap.delete(id);
  }

  async getStudySessionsByDateRange(startDate: Date, endDate: Date): Promise<StudySession[]> {
    const sessions = Array.from(this.studySessionsMap.values());
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate && sessionDate <= endDate;
    }).sort((a, b) => {
      // Sort by start time (newest first)
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }

  // Study Stats methods
  async getStudyStats(): Promise<StudyStats | undefined> {
    return this.studyStatsInstance;
  }

  async updateStudyStats(stats: Partial<InsertStudyStats>): Promise<StudyStats> {
    if (!this.studyStatsInstance) {
      const defaultStats: StudyStats = {
        id: 1,
        userId: null,
        totalStudyTime: 0,
        dailyGoal: 7200, // 2 hours in seconds
        weeklyGoal: 36000, // 10 hours in seconds
        streakDays: 0,
        lastStudyDate: null,
        timeByCategory: {}
      };
      
      this.studyStatsInstance = {
        ...defaultStats,
        ...stats
      };
    } else {
      this.studyStatsInstance = {
        ...this.studyStatsInstance,
        ...stats
      };
    }
    
    return this.studyStatsInstance;
  }

  async increaseStudyTime(seconds: number, category?: string): Promise<StudyStats> {
    if (!this.studyStatsInstance) {
      await this.updateStudyStats({});
    }
    
    if (!this.studyStatsInstance) {
      throw new Error("Failed to initialize study stats");
    }
    
    // Check if streak should be updated
    const lastStudyDate = this.studyStatsInstance.lastStudyDate 
      ? new Date(this.studyStatsInstance.lastStudyDate) 
      : null;
      
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let streakDays = this.studyStatsInstance.streakDays || 0;
    
    if (lastStudyDate) {
      const lastStudyDay = new Date(lastStudyDate);
      lastStudyDay.setHours(0, 0, 0, 0);
      
      if (lastStudyDay.getTime() === yesterday.getTime()) {
        // Studied yesterday, increment streak
        streakDays += 1;
      } else if (lastStudyDay.getTime() < yesterday.getTime()) {
        // Missed days, reset streak
        streakDays = 1;
      }
      // If lastStudyDay is today, just keep current streak
    } else {
      // First study session
      streakDays = 1;
    }
    
    // Update timeByCategory
    let timeByCategory = this.studyStatsInstance.timeByCategory || {};
    if (category) {
      timeByCategory = {
        ...timeByCategory,
        [category]: (timeByCategory[category] || 0) + seconds
      };
    }
    
    // Update stats
    const totalStudyTime = (this.studyStatsInstance.totalStudyTime || 0) + seconds;
    
    this.studyStatsInstance = {
      ...this.studyStatsInstance,
      totalStudyTime,
      lastStudyDate: new Date(),
      streakDays,
      timeByCategory
    };
    
    return this.studyStatsInstance;
  }
}

// Database-based storage implementation
export class DbStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Task methods
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const insertData = {
      ...task,
      completed: task.completed ?? false,
      createdAt: new Date()
    };
    const result = await db.insert(tasks).values(insertData).returning();
    return result[0];
  }

  async updateTask(id: number, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning({ id: tasks.id });
      
    return result.length > 0;
  }

  // Timer settings methods
  async getTimerSettings(): Promise<TimerSettings | undefined> {
    // Get the first timer settings, or the one for the current user if we had auth
    const result = await db
      .select()
      .from(timerSettings)
      .where(isNull(timerSettings.userId))
      .limit(1);
      
    return result.length > 0 ? result[0] : undefined;
  }

  async updateTimerSettings(settings: Partial<InsertTimerSettings>): Promise<TimerSettings> {
    // Try to get existing settings first
    const existingSettings = await this.getTimerSettings();
    
    if (!existingSettings) {
      // Create new settings if none exist
      const defaultSettings: InsertTimerSettings = {
        userId: null,
        defaultMinutes: 25,
        defaultSeconds: 0,
        alarmSound: "bell",
        volume: 80,
        autoStartBreak: false,
        timerMode: "pomodoro",
        pomodoroMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 4,
        autoStartPomodoro: false,
        trackStopwatchTime: true,
        stopwatchDefaultCategory: "General",
        stopwatchAutoSave: false
      };
      
      // Merge with provided settings
      const newSettings = {
        ...defaultSettings,
        ...settings
      };
      
      const result = await db
        .insert(timerSettings)
        .values(newSettings)
        .returning();
        
      return result[0];
    } else {
      // Update existing settings
      const result = await db
        .update(timerSettings)
        .set(settings)
        .where(eq(timerSettings.id, existingSettings.id))
        .returning();
        
      return result[0];
    }
  }

  // Study Session methods
  async getStudySessions(): Promise<StudySession[]> {
    return await db.select().from(studySessions).orderBy(desc(studySessions.startTime));
  }

  async getStudySession(id: number): Promise<StudySession | undefined> {
    const result = await db.select().from(studySessions).where(eq(studySessions.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createStudySession(session: InsertStudySession): Promise<StudySession> {
    const result = await db.insert(studySessions).values(session).returning();
    return result[0];
  }

  async updateStudySession(id: number, sessionData: Partial<InsertStudySession>): Promise<StudySession | undefined> {
    const result = await db
      .update(studySessions)
      .set(sessionData)
      .where(eq(studySessions.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteStudySession(id: number): Promise<boolean> {
    const result = await db
      .delete(studySessions)
      .where(eq(studySessions.id, id))
      .returning({ id: studySessions.id });
      
    return result.length > 0;
  }

  async getStudySessionsByDateRange(startDate: Date, endDate: Date): Promise<StudySession[]> {
    return await db
      .select()
      .from(studySessions)
      .where(
        and(
          gte(studySessions.startTime, startDate),
          lte(studySessions.startTime, endDate)
        )
      )
      .orderBy(desc(studySessions.startTime));
  }

  // Study Stats methods
  async getStudyStats(): Promise<StudyStats | undefined> {
    // Get the stats for the current user (or default if we had auth)
    const result = await db
      .select()
      .from(studyStats)
      .where(isNull(studyStats.userId))
      .limit(1);
      
    return result.length > 0 ? result[0] : undefined;
  }

  async updateStudyStats(stats: Partial<InsertStudyStats>): Promise<StudyStats> {
    // Try to get existing stats first
    const existingStats = await this.getStudyStats();
    
    if (!existingStats) {
      // Create new stats if none exist
      const defaultStats: InsertStudyStats = {
        userId: null,
        totalStudyTime: 0,
        dailyGoal: 7200, // 2 hours in seconds
        weeklyGoal: 36000, // 10 hours in seconds
        streakDays: 0,
        lastStudyDate: new Date(),
        timeByCategory: {}
      };
      
      // Merge with provided stats
      const newStats = {
        ...defaultStats,
        ...stats
      };
      
      const result = await db
        .insert(studyStats)
        .values(newStats)
        .returning();
        
      return result[0];
    } else {
      // Update existing stats
      const result = await db
        .update(studyStats)
        .set(stats)
        .where(eq(studyStats.id, existingStats.id))
        .returning();
        
      return result[0];
    }
  }

  async increaseStudyTime(seconds: number, category?: string): Promise<StudyStats> {
    // Get current stats
    const currentStats = await this.getStudyStats();
    
    if (!currentStats) {
      // Create new stats if none exist
      const newStats: InsertStudyStats = {
        userId: null,
        totalStudyTime: seconds,
        dailyGoal: 7200, // 2 hours in seconds
        weeklyGoal: 36000, // 10 hours in seconds
        streakDays: 1,
        lastStudyDate: new Date(),
        timeByCategory: category ? { [category]: seconds } : {}
      };
      
      const result = await db
        .insert(studyStats)
        .values(newStats)
        .returning();
        
      return result[0];
    } else {
      // Check if streaks should be updated
      const lastStudyDate = currentStats.lastStudyDate ? new Date(currentStats.lastStudyDate) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let streakDays = currentStats.streakDays || 0;
      
      if (lastStudyDate) {
        const lastStudyDay = new Date(lastStudyDate);
        lastStudyDay.setHours(0, 0, 0, 0);
        
        if (lastStudyDay.getTime() === yesterday.getTime()) {
          // Studied yesterday, increment streak
          streakDays += 1;
        } else if (lastStudyDay.getTime() < yesterday.getTime()) {
          // Missed days, reset streak
          streakDays = 1;
        }
        // If lastStudyDay is today, just keep current streak
      }
      
      // Update timeByCategory
      let timeByCategory = currentStats.timeByCategory || {};
      if (category) {
        timeByCategory = {
          ...timeByCategory,
          [category]: (timeByCategory[category] || 0) + seconds
        };
      }
      
      // Update stats
      const updatedStats = {
        totalStudyTime: (currentStats.totalStudyTime || 0) + seconds,
        lastStudyDate: new Date(),
        streakDays,
        timeByCategory
      };
      
      const result = await db
        .update(studyStats)
        .set(updatedStats)
        .where(eq(studyStats.id, currentStats.id))
        .returning();
        
      return result[0];
    }
  }
}

// Use the database storage implementation
// Use in-memory storage for now while we diagnose database connection issues
export const storage = new MemStorage();
