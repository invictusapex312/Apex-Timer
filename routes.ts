import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTaskSchema, insertTimerSettingsSchema, insertStudySessionSchema, insertStudyStatsSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Tasks routes
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get tasks", error: String(error) });
    }
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error as ZodError);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to create task", error: String(error) });
      }
    }
  });

  app.put("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const validatedData = insertTaskSchema.partial().parse(req.body);
      const updatedTask = await storage.updateTask(id, validatedData);

      if (!updatedTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(updatedTask);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error as ZodError);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update task", error: String(error) });
      }
    }
  });

  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const success = await storage.deleteTask(id);
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete task", error: String(error) });
    }
  });

  // Timer settings routes
  app.get("/api/timer-settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getTimerSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get timer settings", error: String(error) });
    }
  });

  app.put("/api/timer-settings", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTimerSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateTimerSettings(validatedData);
      res.json(settings);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error as ZodError);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update timer settings", error: String(error) });
      }
    }
  });

  // Clear completed tasks
  app.delete("/api/tasks/completed", async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasks();
      const completedTasks = tasks.filter(task => task.completed);
      
      const promises = completedTasks.map(task => storage.deleteTask(task.id));
      await Promise.all(promises);
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to clear completed tasks", error: String(error) });
    }
  });

  // Study Sessions routes
  app.get("/api/study-sessions", async (req: Request, res: Response) => {
    try {
      const sessions = await storage.getStudySessions();
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get study sessions", error: String(error) });
    }
  });

  app.get("/api/study-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }

      const session = await storage.getStudySession(id);
      if (!session) {
        return res.status(404).json({ message: "Study session not found" });
      }

      res.json(session);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get study session", error: String(error) });
    }
  });

  app.post("/api/study-sessions", async (req: Request, res: Response) => {
    try {
      const validatedData = insertStudySessionSchema.parse(req.body);
      const session = await storage.createStudySession(validatedData);
      res.status(201).json(session);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error as ZodError);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to create study session", error: String(error) });
      }
    }
  });

  app.put("/api/study-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }

      const validatedData = insertStudySessionSchema.partial().parse(req.body);
      const updatedSession = await storage.updateStudySession(id, validatedData);

      if (!updatedSession) {
        return res.status(404).json({ message: "Study session not found" });
      }

      // If the session is completed, update study stats
      if (updatedSession.completed && updatedSession.duration && updatedSession.duration > 0) {
        await storage.increaseStudyTime(
          updatedSession.duration,
          updatedSession.tags && updatedSession.tags.length > 0 ? updatedSession.tags[0] : undefined
        );
      }

      res.json(updatedSession);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error as ZodError);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update study session", error: String(error) });
      }
    }
  });

  app.delete("/api/study-sessions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid session ID" });
      }

      const success = await storage.deleteStudySession(id);
      if (!success) {
        return res.status(404).json({ message: "Study session not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete study session", error: String(error) });
    }
  });

  app.get("/api/study-sessions/date-range", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const sessions = await storage.getStudySessionsByDateRange(start, end);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get study sessions", error: String(error) });
    }
  });

  // Study Stats routes
  app.get("/api/study-stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStudyStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get study stats", error: String(error) });
    }
  });

  app.put("/api/study-stats", async (req: Request, res: Response) => {
    try {
      const validatedData = insertStudyStatsSchema.partial().parse(req.body);
      const stats = await storage.updateStudyStats(validatedData);
      res.json(stats);
    } catch (error: any) {
      if (error.name === "ZodError") {
        const validationError = fromZodError(error as ZodError);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update study stats", error: String(error) });
      }
    }
  });

  app.post("/api/study-stats/increase-time", async (req: Request, res: Response) => {
    try {
      const { seconds, category } = req.body;
      
      if (typeof seconds !== 'number' || seconds <= 0) {
        return res.status(400).json({ message: "Valid seconds value is required" });
      }
      
      const stats = await storage.increaseStudyTime(seconds, category);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to increase study time", error: String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}