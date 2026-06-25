// src/app.ts
import cors from "cors";
import express from "express";

// src/config/env.ts
import "dotenv/config";
var required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: "${key}". Set it in your .env file (local) or in the Vercel project settings (production).`
    );
  }
  return value;
};
var env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: process.env.PORT ?? "3000",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: required("DATABASE_URL"),
  openRouterApiKey: required("OPENROUTER_API_KEY")
};

// src/middleware/error.middleware.ts
import { ZodError } from "zod";
var errorMiddleware = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  res.status(500).json({
    success: false,
    message
  });
};

// src/middleware/notFound.middleware.ts
var notFoundMiddleware = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

// src/modules/ticket/api.route.ts
import { Router } from "express";

// src/lib/openrouter.ts
var OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
var MODEL = "google/gemma-4-31b-it:free";
var MAX_ATTEMPTS = 3;
var TOTAL_TIMEOUT_MS = 3e4;
var PER_ATTEMPT_TIMEOUT_MS = 12e3;
var BASE_BACKOFF_MS = 1e3;
var RETRYABLE_HTTP_CODES = /* @__PURE__ */ new Set([429, 500, 502, 503, 504]);
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var isRetryableError = (err) => {
  if (err instanceof Error) {
    const retryableMessages = ["fetch failed", "aborted", "network", "timeout", "econnreset"];
    return retryableMessages.some(
      (m) => err.message.toLowerCase().includes(m)
    );
  }
  if (typeof err === "object" && err !== null && "status" in err) {
    return RETRYABLE_HTTP_CODES.has(err.status);
  }
  return false;
};
var fetchOnce = async (fullPrompt) => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Per-attempt timeout (${PER_ATTEMPT_TIMEOUT_MS}ms) exceeded`)),
    PER_ATTEMPT_TIMEOUT_MS
  );
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: fullPrompt }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenRouter HTTP error:", response.status, JSON.stringify(err));
      const error = Object.assign(new Error("AI service error"), { status: response.status });
      throw error;
    }
    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response.");
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
};
var chatWithAI = async (fullPrompt) => {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      console.error(`[openrouter] Total timeout of ${TOTAL_TIMEOUT_MS}ms exhausted after ${attempt - 1} attempt(s).`);
      break;
    }
    try {
      console.log(`[openrouter] Attempt ${attempt}/${MAX_ATTEMPTS} (${remaining}ms remaining)`);
      const result = await fetchOnce(fullPrompt);
      if (attempt > 1) {
        console.log(`[openrouter] Succeeded on attempt ${attempt}.`);
      }
      return result;
    } catch (err) {
      lastError = err;
      const isLast = attempt === MAX_ATTEMPTS;
      const shouldRetry = !isLast && isRetryableError(err);
      console.error(
        `[openrouter] Attempt ${attempt} failed:`,
        err instanceof Error ? err.message : err
      );
      if (!shouldRetry) break;
      const backoff = Math.min(
        BASE_BACKOFF_MS * 2 ** (attempt - 1),
        deadline - Date.now() - 1
      );
      if (backoff > 0) {
        console.log(`[openrouter] Retrying in ${backoff}ms\u2026`);
        await sleep(backoff);
      }
    }
  }
  throw lastError ?? new Error(`AI service failed after ${MAX_ATTEMPTS} attempts within ${TOTAL_TIMEOUT_MS}ms.`);
};

// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";

// prisma/generated/prisma/client.ts
import * as path from "path";
import { fileURLToPath } from "url";

// prisma/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.8.0",
  "engineVersion": "3c6e192761c0362d496ed980de936e2f3cebcd3a",
  "activeProvider": "postgresql",
  "inlineSchema": 'model User {\n  id            String    @id\n  name          String\n  email         String\n  emailVerified Boolean   @default(false)\n  image         String?\n  createdAt     DateTime  @default(now())\n  updatedAt     DateTime  @updatedAt\n  sessions      Session[]\n  accounts      Account[]\n\n  @@unique([email])\n  @@map("user")\n}\n\nmodel Session {\n  id        String   @id\n  expiresAt DateTime\n  token     String\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n  ipAddress String?\n  userAgent String?\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@unique([token])\n  @@index([userId])\n  @@map("session")\n}\n\nmodel Account {\n  id                    String    @id\n  accountId             String\n  providerId            String\n  userId                String\n  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  accessToken           String?\n  refreshToken          String?\n  idToken               String?\n  accessTokenExpiresAt  DateTime?\n  refreshTokenExpiresAt DateTime?\n  scope                 String?\n  password              String?\n  createdAt             DateTime  @default(now())\n  updatedAt             DateTime  @updatedAt\n\n  @@index([userId])\n  @@map("account")\n}\n\nmodel Verification {\n  id         String   @id\n  identifier String\n  value      String\n  expiresAt  DateTime\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n\n  @@index([identifier])\n  @@map("verification")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel TicketLog {\n  id                  String   @id @default(cuid())\n  ticketId            String\n  channel             String?\n  locale              String?\n  message             String\n  caseType            String\n  severity            String\n  department          String\n  agentSummary        String\n  humanReviewRequired Boolean\n  confidence          Float\n  createdAt           DateTime @default(now())\n\n  @@index([ticketId])\n  @@map("ticket_log")\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"image","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"}],"dbName":"user"},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"token","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session"},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"account"},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification"},"TicketLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"ticketId","kind":"scalar","type":"String"},{"name":"channel","kind":"scalar","type":"String"},{"name":"locale","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"caseType","kind":"scalar","type":"String"},{"name":"severity","kind":"scalar","type":"String"},{"name":"department","kind":"scalar","type":"String"},{"name":"agentSummary","kind":"scalar","type":"String"},{"name":"humanReviewRequired","kind":"scalar","type":"Boolean"},{"name":"confidence","kind":"scalar","type":"Float"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"ticket_log"}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","_count","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","TicketLog.findUnique","TicketLog.findUniqueOrThrow","TicketLog.findFirst","TicketLog.findFirstOrThrow","TicketLog.findMany","TicketLog.createOne","TicketLog.createMany","TicketLog.createManyAndReturn","TicketLog.updateOne","TicketLog.updateMany","TicketLog.updateManyAndReturn","TicketLog.upsertOne","TicketLog.deleteOne","TicketLog.deleteMany","_avg","_sum","TicketLog.groupBy","TicketLog.aggregate","AND","OR","NOT","id","ticketId","channel","locale","message","caseType","severity","department","agentSummary","humanReviewRequired","confidence","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","identifier","value","expiresAt","updatedAt","accountId","providerId","userId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","name","email","emailVerified","image","every","some","none","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","increment","decrement","multiply","divide"]'),
  graph: "7wEsUAwEAACjAQAgBQAApAEAIF8AAKIBADBgAAAOABBhAACiAQAwYgEAAAABbUAAmQEAIXxAAJkBACGKAQEAlQEAIYsBAQAAAAGMASAAlwEAIY0BAQCWAQAhAQAAAAEAIAwDAACnAQAgXwAAqAEAMGAAAAMAEGEAAKgBADBiAQCVAQAhbUAAmQEAIXtAAJkBACF8QACZAQAhfwEAlQEAIYcBAQCVAQAhiAEBAJYBACGJAQEAlgEAIQMDAADjAQAgiAEAAKkBACCJAQAAqQEAIAwDAACnAQAgXwAAqAEAMGAAAAMAEGEAAKgBADBiAQAAAAFtQACZAQAhe0AAmQEAIXxAAJkBACF_AQCVAQAhhwEBAAAAAYgBAQCWAQAhiQEBAJYBACEDAAAAAwAgAQAABAAwAgAABQAgEQMAAKcBACBfAAClAQAwYAAABwAQYQAApQEAMGIBAJUBACFtQACZAQAhfEAAmQEAIX0BAJUBACF-AQCVAQAhfwEAlQEAIYABAQCWAQAhgQEBAJYBACGCAQEAlgEAIYMBQACmAQAhhAFAAKYBACGFAQEAlgEAIYYBAQCWAQAhCAMAAOMBACCAAQAAqQEAIIEBAACpAQAgggEAAKkBACCDAQAAqQEAIIQBAACpAQAghQEAAKkBACCGAQAAqQEAIBEDAACnAQAgXwAApQEAMGAAAAcAEGEAAKUBADBiAQAAAAFtQACZAQAhfEAAmQEAIX0BAJUBACF-AQCVAQAhfwEAlQEAIYABAQCWAQAhgQEBAJYBACGCAQEAlgEAIYMBQACmAQAhhAFAAKYBACGFAQEAlgEAIYYBAQCWAQAhAwAAAAcAIAEAAAgAMAIAAAkAIAEAAAADACABAAAABwAgAQAAAAEAIAwEAACjAQAgBQAApAEAIF8AAKIBADBgAAAOABBhAACiAQAwYgEAlQEAIW1AAJkBACF8QACZAQAhigEBAJUBACGLAQEAlQEAIYwBIACXAQAhjQEBAJYBACEDBAAA4QEAIAUAAOIBACCNAQAAqQEAIAMAAAAOACABAAAPADACAAABACADAAAADgAgAQAADwAwAgAAAQAgAwAAAA4AIAEAAA8AMAIAAAEAIAkEAADfAQAgBQAA4AEAIGIBAAAAAW1AAAAAAXxAAAAAAYoBAQAAAAGLAQEAAAABjAEgAAAAAY0BAQAAAAEBDAAAEwAgB2IBAAAAAW1AAAAAAXxAAAAAAYoBAQAAAAGLAQEAAAABjAEgAAAAAY0BAQAAAAEBDAAAFQAwAQwAABUAMAkEAADFAQAgBQAAxgEAIGIBAK8BACFtQACzAQAhfEAAswEAIYoBAQCvAQAhiwEBAK8BACGMASAAsQEAIY0BAQCwAQAhAgAAAAEAIAwAABgAIAdiAQCvAQAhbUAAswEAIXxAALMBACGKAQEArwEAIYsBAQCvAQAhjAEgALEBACGNAQEAsAEAIQIAAAAOACAMAAAaACACAAAADgAgDAAAGgAgAwAAAAEAIBMAABMAIBQAABgAIAEAAAABACABAAAADgAgBAYAAMIBACAZAADEAQAgGgAAwwEAII0BAACpAQAgCl8AAKEBADBgAAAhABBhAAChAQAwYgEAgwEAIW1AAIcBACF8QACHAQAhigEBAIMBACGLAQEAgwEAIYwBIACFAQAhjQEBAIQBACEDAAAADgAgAQAAIAAwGAAAIQAgAwAAAA4AIAEAAA8AMAIAAAEAIAEAAAAFACABAAAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgCQMAAMEBACBiAQAAAAFtQAAAAAF7QAAAAAF8QAAAAAF_AQAAAAGHAQEAAAABiAEBAAAAAYkBAQAAAAEBDAAAKQAgCGIBAAAAAW1AAAAAAXtAAAAAAXxAAAAAAX8BAAAAAYcBAQAAAAGIAQEAAAABiQEBAAAAAQEMAAArADABDAAAKwAwCQMAAMABACBiAQCvAQAhbUAAswEAIXtAALMBACF8QACzAQAhfwEArwEAIYcBAQCvAQAhiAEBALABACGJAQEAsAEAIQIAAAAFACAMAAAuACAIYgEArwEAIW1AALMBACF7QACzAQAhfEAAswEAIX8BAK8BACGHAQEArwEAIYgBAQCwAQAhiQEBALABACECAAAAAwAgDAAAMAAgAgAAAAMAIAwAADAAIAMAAAAFACATAAApACAUAAAuACABAAAABQAgAQAAAAMAIAUGAAC9AQAgGQAAvwEAIBoAAL4BACCIAQAAqQEAIIkBAACpAQAgC18AAKABADBgAAA3ABBhAACgAQAwYgEAgwEAIW1AAIcBACF7QACHAQAhfEAAhwEAIX8BAIMBACGHAQEAgwEAIYgBAQCEAQAhiQEBAIQBACEDAAAAAwAgAQAANgAwGAAANwAgAwAAAAMAIAEAAAQAMAIAAAUAIAEAAAAJACABAAAACQAgAwAAAAcAIAEAAAgAMAIAAAkAIAMAAAAHACABAAAIADACAAAJACADAAAABwAgAQAACAAwAgAACQAgDgMAALwBACBiAQAAAAFtQAAAAAF8QAAAAAF9AQAAAAF-AQAAAAF_AQAAAAGAAQEAAAABgQEBAAAAAYIBAQAAAAGDAUAAAAABhAFAAAAAAYUBAQAAAAGGAQEAAAABAQwAAD8AIA1iAQAAAAFtQAAAAAF8QAAAAAF9AQAAAAF-AQAAAAF_AQAAAAGAAQEAAAABgQEBAAAAAYIBAQAAAAGDAUAAAAABhAFAAAAAAYUBAQAAAAGGAQEAAAABAQwAAEEAMAEMAABBADAOAwAAuwEAIGIBAK8BACFtQACzAQAhfEAAswEAIX0BAK8BACF-AQCvAQAhfwEArwEAIYABAQCwAQAhgQEBALABACGCAQEAsAEAIYMBQAC6AQAhhAFAALoBACGFAQEAsAEAIYYBAQCwAQAhAgAAAAkAIAwAAEQAIA1iAQCvAQAhbUAAswEAIXxAALMBACF9AQCvAQAhfgEArwEAIX8BAK8BACGAAQEAsAEAIYEBAQCwAQAhggEBALABACGDAUAAugEAIYQBQAC6AQAhhQEBALABACGGAQEAsAEAIQIAAAAHACAMAABGACACAAAABwAgDAAARgAgAwAAAAkAIBMAAD8AIBQAAEQAIAEAAAAJACABAAAABwAgCgYAALcBACAZAAC5AQAgGgAAuAEAIIABAACpAQAggQEAAKkBACCCAQAAqQEAIIMBAACpAQAghAEAAKkBACCFAQAAqQEAIIYBAACpAQAgEF8AAJwBADBgAABNABBhAACcAQAwYgEAgwEAIW1AAIcBACF8QACHAQAhfQEAgwEAIX4BAIMBACF_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_AQCVAQAhhwEBAJUBACGIAQEAlgEAIYkBAQCWAQAhAAAAAAAAAZYBAQAAAAEBlgEBAAAAAQGWASAAAAABBZYBCAAAAAGcAQgAAAABnQEIAAAAAZ4BCAAAAAGfAQgAAAABAZYBQAAAAAEAAAAAAAABlgFAAAAAAQUTAADrAQAgFAAA7gEAIJMBAADsAQAglAEAAO0BACCZAQAAAQAgAxMAAOsBACCTAQAA7AEAIJkBAAABACAAAAAFEwAA5gEAIBQAAOkBACCTAQAA5wEAIJQBAADoAQAgmQEAAAEAIAMTAADmAQAgkwEAAOcBACCZAQAAAQAgAAAACxMAANMBADAUAADYAQAwkwEAANQBADCUAQAA1QEAMJUBAADWAQAglgEAANcBADCXAQAA1wEAMJgBAADXAQAwmQEAANcBADCaAQAA2QEAMJsBAADaAQAwCxMAAMcBADAUAADMAQAwkwEAAMgBADCUAQAAyQEAMJUBAADKAQAglgEAAMsBADCXAQAAywEAMJgBAADLAQAwmQEAAMsBADCaAQAAzQEAMJsBAADOAQAwDGIBAAAAAW1AAAAAAXxAAAAAAX0BAAAAAX4BAAAAAYABAQAAAAGBAQEAAAABggEBAAAAAYMBQAAAAAGEAUAAAAABhQEBAAAAAYYBAQAAAAECAAAACQAgEwAA0gEAIAMAAAAJACATAADSAQAgFAAA0QEAIAEMAADlAQAwEQMAAKcBACBfAAClAQAwYAAABwAQYQAApQEAMGIBAAAAAW1AAJkBACF8QACZAQAhfQEAlQEAIX4BAJUBACF_AQCVAQAhgAEBAJYBACGBAQEAlgEAIYIBAQCWAQAhgwFAAKYBACGEAUAApgEAIYUBAQCWAQAhhgEBAJYBACECAAAACQAgDAAA0QEAIAIAAADPAQAgDAAA0AEAIBBfAADOAQAwYAAAzwEAEGEAAM4BADBiAQCVAQAhbUAAmQEAIXxAAJkBACF9AQCVAQAhfgEAlQEAIX8BAJUBACGAAQEAlgEAIYEBAQCWAQAhggEBAJYBACGDAUAApgEAIYQBQACmAQAhhQEBAJYBACGGAQEAlgEAIRBfAADOAQAwYAAAzwEAEGEAAM4BADBiAQCVAQAhbUAAmQEAIXxAAJkBACF9AQCVAQAhfgEAlQEAIX8BAJUBACGAAQEAlgEAIYEBAQCWAQAhggEBAJYBACGDAUAApgEAIYQBQACmAQAhhQEBAJYBACGGAQEAlgEAIQxiAQCvAQAhbUAAswEAIXxAALMBACF9AQCvAQAhfgEArwEAIYABAQCwAQAhgQEBALABACGCAQEAsAEAIYMBQAC6AQAhhAFAALoBACGFAQEAsAEAIYYBAQCwAQAhDGIBAK8BACFtQACzAQAhfEAAswEAIX0BAK8BACF-AQCvAQAhgAEBALABACGBAQEAsAEAIYIBAQCwAQAhgwFAALoBACGEAUAAugEAIYUBAQCwAQAhhgEBALABACEMYgEAAAABbUAAAAABfEAAAAABfQEAAAABfgEAAAABgAEBAAAAAYEBAQAAAAGCAQEAAAABgwFAAAAAAYQBQAAAAAGFAQEAAAABhgEBAAAAAQdiAQAAAAFtQAAAAAF7QAAAAAF8QAAAAAGHAQEAAAABiAEBAAAAAYkBAQAAAAECAAAABQAgEwAA3gEAIAMAAAAFACATAADeAQAgFAAA3QEAIAEMAADkAQAwDAMAAKcBACBfAACoAQAwYAAAAwAQYQAAqAEAMGIBAAAAAW1AAJkBACF7QACZAQAhfEAAmQEAIX8BAJUBACGHAQEAAAABiAEBAJYBACGJAQEAlgEAIQIAAAAFACAMAADdAQAgAgAAANsBACAMAADcAQAgC18AANoBADBgAADbAQAQYQAA2gEAMGIBAJUBACFtQACZAQAhe0AAmQEAIXxAAJkBACF_AQCVAQAhhwEBAJUBACGIAQEAlgEAIYkBAQCWAQAhC18AANoBADBgAADbAQAQYQAA2gEAMGIBAJUBACFtQACZAQAhe0AAmQEAIXxAAJkBACF_AQCVAQAhhwEBAJUBACGIAQEAlgEAIYkBAQCWAQAhB2IBAK8BACFtQACzAQAhe0AAswEAIXxAALMBACGHAQEArwEAIYgBAQCwAQAhiQEBALABACEHYgEArwEAIW1AALMBACF7QACzAQAhfEAAswEAIYcBAQCvAQAhiAEBALABACGJAQEAsAEAIQdiAQAAAAFtQAAAAAF7QAAAAAF8QAAAAAGHAQEAAAABiAEBAAAAAYkBAQAAAAEEEwAA0wEAMJMBAADUAQAwlQEAANYBACCZAQAA1wEAMAQTAADHAQAwkwEAAMgBADCVAQAAygEAIJkBAADLAQAwAAADBAAA4QEAIAUAAOIBACCNAQAAqQEAIAdiAQAAAAFtQAAAAAF7QAAAAAF8QAAAAAGHAQEAAAABiAEBAAAAAYkBAQAAAAEMYgEAAAABbUAAAAABfEAAAAABfQEAAAABfgEAAAABgAEBAAAAAYEBAQAAAAGCAQEAAAABgwFAAAAAAYQBQAAAAAGFAQEAAAABhgEBAAAAAQgFAADgAQAgYgEAAAABbUAAAAABfEAAAAABigEBAAAAAYsBAQAAAAGMASAAAAABjQEBAAAAAQIAAAABACATAADmAQAgAwAAAA4AIBMAAOYBACAUAADqAQAgCgAAAA4AIAUAAMYBACAMAADqAQAgYgEArwEAIW1AALMBACF8QACzAQAhigEBAK8BACGLAQEArwEAIYwBIACxAQAhjQEBALABACEIBQAAxgEAIGIBAK8BACFtQACzAQAhfEAAswEAIYoBAQCvAQAhiwEBAK8BACGMASAAsQEAIY0BAQCwAQAhCAQAAN8BACBiAQAAAAFtQAAAAAF8QAAAAAGKAQEAAAABiwEBAAAAAYwBIAAAAAGNAQEAAAABAgAAAAEAIBMAAOsBACADAAAADgAgEwAA6wEAIBQAAO8BACAKAAAADgAgBAAAxQEAIAwAAO8BACBiAQCvAQAhbUAAswEAIXxAALMBACGKAQEArwEAIYsBAQCvAQAhjAEgALEBACGNAQEAsAEAIQgEAADFAQAgYgEArwEAIW1AALMBACF8QACzAQAhigEBAK8BACGLAQEArwEAIYwBIACxAQAhjQEBALABACEDBAYCBQoDBgAEAQMAAQEDAAECBAsABQwAAAAAAwYACRkAChoACwAAAAMGAAkZAAoaAAsBAwABAQMAAQMGABAZABEaABIAAAADBgAQGQARGgASAQMAAQEDAAEDBgAXGQAYGgAZAAAAAwYAFxkAGBoAGQAAAAMGAB8ZACAaACEAAAADBgAfGQAgGgAhAAAABQYAJxkAKhoAK1sAKFwAKQAAAAAABQYAJxkAKhoAK1sAKFwAKQcCAQgNAQkQAQoRAQsSAQ0UAQ4WBQ8XBhAZAREbBRIcBxUdARYeARcfBRsiCBwjDB0kAh4lAh8mAiAnAiEoAiIqAiMsBSQtDSUvAiYxBScyDigzAik0Aio1BSs4Dyw5Ey06Ay47Ay88AzA9AzE-AzJAAzNCBTRDFDVFAzZHBTdIFThJAzlKAzpLBTtOFjxPGj1RGz5SGz9VG0BWG0FXG0JZG0NbBURcHEVeG0ZgBUdhHUhiG0ljG0pkBUtnHkxoIk1qI05rI09uI1BvI1FwI1JyI1N0BVR1JFV3I1Z5BVd6JVh7I1l8I1p9BV2AASZegQEs"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer } = await import("buffer");
  const wasmArray = Buffer.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// prisma/generated/prisma/internal/prismaNamespace.ts
import * as runtime2 from "@prisma/client/runtime/client";
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var defineExtension = runtime2.Extensions.defineExtension;

// prisma/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/lib/prisma.ts
var adapter = new PrismaPg({ connectionString: env.databaseUrl });
var prisma = new PrismaClient({ adapter });

// src/modules/ticket/api.constant.ts
var CHANNELS = ["app", "sms", "call_center", "merchant_portal"];
var LOCALES = ["bn", "en", "mixed"];
var CASE_TYPES = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "phishing_or_social_engineering",
  "other"
];
var SEVERITIES = ["low", "medium", "high", "critical"];
var DEPARTMENTS = [
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "fraud_risk"
];

// src/modules/ticket/api.service.ts
var buildPrompt = (payload) => `
You are a financial support ticket classifier for a mobile banking system.

Classify the customer complaint below using the DECISION MATRIX and return ONLY a valid JSON object. No explanation, no markdown, no code blocks \u2014 raw JSON only.

## DECISION MATRIX

| case_type                       | When to use                                                                 | severity       | department          |
|---------------------------------|-----------------------------------------------------------------------------|----------------|---------------------|
| wrong_transfer                  | Money sent to wrong number/recipient. Keywords: wrong number, wrong recipient, \u09AD\u09C1\u09B2 \u09A8\u09AE\u09CD\u09AC\u09B0, \u09AD\u09C1\u09B2\u09C7 \u09AA\u09BE\u09A0\u09BF\u09AF\u09BC\u09C7\u099B\u09BF, mistakenly sent | high           | dispute_resolution  |
| payment_failed                  | Payment/transaction failed but balance may be deducted. Keywords: failed, deducted, \u099F\u09BE\u0995\u09BE \u0995\u09C7\u099F\u09C7 \u0997\u09C7\u099B\u09C7, \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09B9\u09AF\u09BC\u09A8\u09BF | high           | payments_ops        |
| refund_request                  | Customer wants money back. If only mind changed \u2192 low. If contested/serious \u2192 medium/high | low or medium  | customer_support or dispute_resolution |
| phishing_or_social_engineering  | OTP, PIN, password, CVV, suspicious call/SMS, scammer, phishing, fake sms  | critical       | fraud_risk          |
| other                           | General issues: app crash, slow app, login problem, unclear complaint        | low            | customer_support    |

## STRICT RULES

1. human_review_required = true ONLY if case_type is "phishing_or_social_engineering" OR severity is "critical".
2. confidence must be a float between 0.0 and 1.0 representing your certainty.
3. agent_summary must be 1\u20132 neutral sentences describing what the customer reported.
   - NEVER ask the customer to share OTP, PIN, password, CVV, or full card number.
   - NEVER include instructions \u2014 only factual description of the issue.
   - BAD: "Customer should provide OTP to verify account."
   - GOOD: "Customer reports receiving a suspicious call asking for OTP."
4. ticket_id must exactly match the input ticket_id: "${payload.ticket_id}".
5. All field values must come strictly from these allowed sets:
   - case_type: wrong_transfer | payment_failed | refund_request | phishing_or_social_engineering | other
   - severity: low | medium | high | critical
   - department: customer_support | dispute_resolution | payments_ops | fraud_risk
   - human_review_required: true | false
6. Input may be in Bengali (bn), English (en), or mixed. Handle all three.

## INPUT

ticket_id: ${payload.ticket_id}
channel: ${payload.channel ?? "not specified"}
locale: ${payload.locale ?? "not specified"}
message: ${payload.message}

## OUTPUT FORMAT (raw JSON, nothing else)

{
  "ticket_id": "${payload.ticket_id}",
  "case_type": "<one of the allowed values>",
  "severity": "<one of the allowed values>",
  "department": "<one of the allowed values>",
  "agent_summary": "<neutral 1-2 sentence description>",
  "human_review_required": <true or false>,
  "confidence": <0.0 to 1.0>
}
`.trim();
var parseAIResponse = (raw2, ticketId) => {
  const cleaned = raw2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
  const ticket_id = typeof parsed["ticket_id"] === "string" ? parsed["ticket_id"] : ticketId;
  const case_type = CASE_TYPES.includes(parsed["case_type"]) ? parsed["case_type"] : "other";
  const severity = SEVERITIES.includes(parsed["severity"]) ? parsed["severity"] : "low";
  const department = DEPARTMENTS.includes(parsed["department"]) ? parsed["department"] : "customer_support";
  const agent_summary = typeof parsed["agent_summary"] === "string" && parsed["agent_summary"].length > 0 ? parsed["agent_summary"] : "Customer submitted a support request that requires review.";
  const aiHumanReview = parsed["human_review_required"] === true;
  const human_review_required = case_type === "phishing_or_social_engineering" || severity === "critical" || aiHumanReview;
  const rawConfidence = Number(parsed["confidence"]);
  const confidence = isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1 ? rawConfidence : 0.7;
  return {
    ticket_id,
    case_type,
    severity,
    department,
    agent_summary,
    human_review_required,
    confidence
  };
};
var logClassification = async (payload, result) => {
  try {
    await prisma.ticketLog.create({
      data: {
        ticketId: payload.ticket_id,
        channel: payload.channel ?? null,
        locale: payload.locale ?? null,
        message: payload.message,
        caseType: result.case_type,
        severity: result.severity,
        department: result.department,
        agentSummary: result.agent_summary,
        humanReviewRequired: result.human_review_required,
        confidence: result.confidence
      }
    });
  } catch (error) {
    console.error("Ticket classification logging failed:", error);
  }
};
var sortTicket = async (payload) => {
  const prompt = buildPrompt(payload);
  const rawAIResponse = await chatWithAI(prompt);
  console.log("AI raw response:", rawAIResponse);
  const result = parseAIResponse(rawAIResponse, payload.ticket_id);
  await logClassification(payload, result);
  return result;
};

// src/modules/ticket/api.validation.ts
import { z } from "zod";
var sortTicketSchema = z.object({
  ticket_id: z.string().trim().min(1, "ticket_id is required"),
  channel: z.enum(CHANNELS).optional(),
  locale: z.enum(LOCALES).optional(),
  message: z.string().trim().min(1, "message is required")
});

// src/modules/ticket/api.controller.ts
var sortTicketController = async (req, res, next) => {
  try {
    const payload = sortTicketSchema.parse(req.body);
    const result = await sortTicket(payload);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// src/modules/ticket/api.route.ts
var ticketRouter = Router();
ticketRouter.post("/sort-ticket", sortTicketController);

// src/app.ts
var app = express();
app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin
  })
);
app.use(express.json());
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "QueueStorm Warmup API",
    uptime: process.uptime()
  });
});
app.use("/", ticketRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
export {
  app as default
};
