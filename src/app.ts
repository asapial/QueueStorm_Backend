import "dotenv/config";
import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import AppError from "./errorHelpers/AppError.js";
import { handleZodError } from "./errorHelpers/handleZodError.js";

const app: Application = express();

// Middleware
app.use(cookieParser());
app.use(express.json());

// CORS Setup
const allowedOrigins = [
  process.env.CORS_ORIGIN ?? "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin); // Allow Vercel deployments

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  })
);

// Better Auth API Route
// app.all('/api/auth/*', toNodeHandler(auth));

// Health Check Route — GET /health
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully",
    service: "Backend API",
    version: "1.0.0",
    environment: process.env.NODE_ENV ?? "development",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "QueueStorm API is live",
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const errorResponse = handleZodError(err);
    res.status(errorResponse.statusCode).json(errorResponse);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorSources: [{ path: "", message: err.message }],
      statusCode: err.statusCode,
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({
    success: false,
    message,
    errorSources: [{ path: "", message }],
    statusCode: 500,
  });
});

export default app;