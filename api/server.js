// src/server.ts
import "dotenv/config";

// src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";

// src/errorHelpers/AppError.ts
var AppError = class extends Error {
  statusCode;
  constructor(statusCode, message, stack = "") {
    super(message);
    this.statusCode = statusCode;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};
var AppError_default = AppError;

// src/errorHelpers/handleZodError.ts
var handleZodError = (err) => {
  const statusCode = 400;
  const message = "Zod Validation Error";
  const errorSources = err.issues.map((issue) => ({
    path: issue.path.join(" => "),
    message: issue.message
  }));
  return {
    success: false,
    message,
    errorSources,
    statusCode
  };
};

// src/app.ts
var app = express();
app.use(cookieParser());
app.use(express.json());
var allowedOrigins = [
  process.env.CORS_ORIGIN ?? "http://localhost:3000"
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"]
  })
);
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully",
    service: "Backend API",
    version: "1.0.0",
    environment: process.env.NODE_ENV ?? "development",
    uptime: process.uptime(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "QueueStorm API is live"
  });
});
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const errorResponse = handleZodError(err);
    res.status(errorResponse.statusCode).json(errorResponse);
    return;
  }
  if (err instanceof AppError_default) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorSources: [{ path: "", message: err.message }],
      statusCode: err.statusCode
    });
    return;
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({
    success: false,
    message,
    errorSources: [{ path: "", message }],
    statusCode: 500
  });
});
var app_default = app;

// src/lib/prisma.ts
import "dotenv/config";
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
  "inlineSchema": 'model User {\n  id            String    @id\n  name          String\n  email         String\n  emailVerified Boolean   @default(false)\n  image         String?\n  createdAt     DateTime  @default(now())\n  updatedAt     DateTime  @updatedAt\n  sessions      Session[]\n  accounts      Account[]\n\n  @@unique([email])\n  @@map("user")\n}\n\nmodel Session {\n  id        String   @id\n  expiresAt DateTime\n  token     String\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n  ipAddress String?\n  userAgent String?\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@unique([token])\n  @@index([userId])\n  @@map("session")\n}\n\nmodel Account {\n  id                    String    @id\n  accountId             String\n  providerId            String\n  userId                String\n  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  accessToken           String?\n  refreshToken          String?\n  idToken               String?\n  accessTokenExpiresAt  DateTime?\n  refreshTokenExpiresAt DateTime?\n  scope                 String?\n  password              String?\n  createdAt             DateTime  @default(now())\n  updatedAt             DateTime  @updatedAt\n\n  @@index([userId])\n  @@map("account")\n}\n\nmodel Verification {\n  id         String   @id\n  identifier String\n  value      String\n  expiresAt  DateTime\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n\n  @@index([identifier])\n  @@map("verification")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n',
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
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"image","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"}],"dbName":"user"},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"token","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session"},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"account"},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification"}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","_count","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","AND","OR","NOT","id","identifier","value","expiresAt","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","accountId","providerId","userId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","name","email","emailVerified","image","every","some","none","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany"]'),
  graph: "ygEiQAwEAACEAQAgBQAAhQEAIE0AAIEBADBOAAAOABBPAACBAQAwUAEAAAABVEAAcwAhVUAAcwAhbgEAcgAhbwEAAAABcCAAggEAIXEBAIMBACEBAAAAAQAgDAMAAIgBACBNAACJAQAwTgAAAwAQTwAAiQEAMFABAHIAIVNAAHMAIVRAAHMAIVVAAHMAIWMBAHIAIWsBAHIAIWwBAIMBACFtAQCDAQAhAwMAAL4BACBsAACPAQAgbQAAjwEAIAwDAACIAQAgTQAAiQEAME4AAAMAEE8AAIkBADBQAQAAAAFTQABzACFUQABzACFVQABzACFjAQByACFrAQAAAAFsAQCDAQAhbQEAgwEAIQMAAAADACABAAAEADACAAAFACARAwAAiAEAIE0AAIYBADBOAAAHABBPAACGAQAwUAEAcgAhVEAAcwAhVUAAcwAhYQEAcgAhYgEAcgAhYwEAcgAhZAEAgwEAIWUBAIMBACFmAQCDAQAhZ0AAhwEAIWhAAIcBACFpAQCDAQAhagEAgwEAIQgDAAC-AQAgZAAAjwEAIGUAAI8BACBmAACPAQAgZwAAjwEAIGgAAI8BACBpAACPAQAgagAAjwEAIBEDAACIAQAgTQAAhgEAME4AAAcAEE8AAIYBADBQAQAAAAFUQABzACFVQABzACFhAQByACFiAQByACFjAQByACFkAQCDAQAhZQEAgwEAIWYBAIMBACFnQACHAQAhaEAAhwEAIWkBAIMBACFqAQCDAQAhAwAAAAcAIAEAAAgAMAIAAAkAIAEAAAADACABAAAABwAgAQAAAAEAIAwEAACEAQAgBQAAhQEAIE0AAIEBADBOAAAOABBPAACBAQAwUAEAcgAhVEAAcwAhVUAAcwAhbgEAcgAhbwEAcgAhcCAAggEAIXEBAIMBACEDBAAAvAEAIAUAAL0BACBxAACPAQAgAwAAAA4AIAEAAA8AMAIAAAEAIAMAAAAOACABAAAPADACAAABACADAAAADgAgAQAADwAwAgAAAQAgCQQAALoBACAFAAC7AQAgUAEAAAABVEAAAAABVUAAAAABbgEAAAABbwEAAAABcCAAAAABcQEAAAABAQwAABMAIAdQAQAAAAFUQAAAAAFVQAAAAAFuAQAAAAFvAQAAAAFwIAAAAAFxAQAAAAEBDAAAFQAwAQwAABUAMAkEAACgAQAgBQAAoQEAIFABAI0BACFUQACOAQAhVUAAjgEAIW4BAI0BACFvAQCNAQAhcCAAnwEAIXEBAJMBACECAAAAAQAgDAAAGAAgB1ABAI0BACFUQACOAQAhVUAAjgEAIW4BAI0BACFvAQCNAQAhcCAAnwEAIXEBAJMBACECAAAADgAgDAAAGgAgAgAAAA4AIAwAABoAIAMAAAABACATAAATACAUAAAYACABAAAAAQAgAQAAAA4AIAQGAACcAQAgGQAAngEAIBoAAJ0BACBxAACPAQAgCk0AAH0AME4AACEAEE8AAH0AMFABAGoAIVRAAGsAIVVAAGsAIW4BAGoAIW8BAGoAIXAgAH4AIXEBAHUAIQMAAAAOACABAAAgADAYAAAhACADAAAADgAgAQAADwAwAgAAAQAgAQAAAAUAIAEAAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACAJAwAAmwEAIFABAAAAAVNAAAAAAVRAAAAAAVVAAAAAAWMBAAAAAWsBAAAAAWwBAAAAAW0BAAAAAQEMAAApACAIUAEAAAABU0AAAAABVEAAAAABVUAAAAABYwEAAAABawEAAAABbAEAAAABbQEAAAABAQwAACsAMAEMAAArADAJAwAAmgEAIFABAI0BACFTQACOAQAhVEAAjgEAIVVAAI4BACFjAQCNAQAhawEAjQEAIWwBAJMBACFtAQCTAQAhAgAAAAUAIAwAAC4AIAhQAQCNAQAhU0AAjgEAIVRAAI4BACFVQACOAQAhYwEAjQEAIWsBAI0BACFsAQCTAQAhbQEAkwEAIQIAAAADACAMAAAwACACAAAAAwAgDAAAMAAgAwAAAAUAIBMAACkAIBQAAC4AIAEAAAAFACABAAAAAwAgBQYAAJcBACAZAACZAQAgGgAAmAEAIGwAAI8BACBtAACPAQAgC00AAHwAME4AADcAEE8AAHwAMFABAGoAIVNAAGsAIVRAAGsAIVVAAGsAIWMBAGoAIWsBAGoAIWwBAHUAIW0BAHUAIQMAAAADACABAAA2ADAYAAA3ACADAAAAAwAgAQAABAAwAgAABQAgAQAAAAkAIAEAAAAJACADAAAABwAgAQAACAAwAgAACQAgAwAAAAcAIAEAAAgAMAIAAAkAIAMAAAAHACABAAAIADACAAAJACAOAwAAlgEAIFABAAAAAVRAAAAAAVVAAAAAAWEBAAAAAWIBAAAAAWMBAAAAAWQBAAAAAWUBAAAAAWYBAAAAAWdAAAAAAWhAAAAAAWkBAAAAAWoBAAAAAQEMAAA_ACANUAEAAAABVEAAAAABVUAAAAABYQEAAAABYgEAAAABYwEAAAABZAEAAAABZQEAAAABZgEAAAABZ0AAAAABaEAAAAABaQEAAAABagEAAAABAQwAAEEAMAEMAABBADAOAwAAlQEAIFABAI0BACFUQACOAQAhVUAAjgEAIWEBAI0BACFiAQCNAQAhYwEAjQEAIWQBAJMBACFlAQCTAQAhZgEAkwEAIWdAAJQBACFoQACUAQAhaQEAkwEAIWoBAJMBACECAAAACQAgDAAARAAgDVABAI0BACFUQACOAQAhVUAAjgEAIWEBAI0BACFiAQCNAQAhYwEAjQEAIWQBAJMBACFlAQCTAQAhZgEAkwEAIWdAAJQBACFoQACUAQAhaQEAkwEAIWoBAJMBACECAAAABwAgDAAARgAgAgAAAAcAIAwAAEYAIAMAAAAJACATAAA_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AACIAQAgTQAAiQEAME4AAAMAEE8AAIkBADBQAQByACFTQABzACFUQABzACFVQABzACFjAQByACFrAQByACFsAQCDAQAhbQEAgwEAIQAAAAF6AQAAAAEBekAAAAABAAAAAAF6AQAAAAEBekAAAAABBRMAAMYBACAUAADJAQAgdwAAxwEAIHgAAMgBACB9AAABACADEwAAxgEAIHcAAMcBACB9AAABACAAAAAFEwAAwQEAIBQAAMQBACB3AADCAQAgeAAAwwEAIH0AAAEAIAMTAADBAQAgdwAAwgEAIH0AAAEAIAAAAAF6IAAAAAELEwAArgEAMBQAALMBADB3AACvAQAweAAAsAEAMHkAALEBACB6AACyAQAwewAAsgEAMHwAALIBADB9AACyAQAwfgAAtAEAMH8AALUBADALEwAAogEAMBQAAKcBADB3AACjAQAweAAApAEAMHkAAKUBACB6AACmAQAwewAApgEAMHwAAKYBADB9AACmAQAwfgAAqAEAMH8AAKkBADAMUAEAAAABVEAAAAABVUAAAAABYQEAAAABYgEAAAABZAEAAAABZQEAAAABZgEAAAABZ0AAAAABaEAAAAABaQEAAAABagEAAAABAgAAAAkAIBMAAK0BACADAAAACQAgEwAArQEAIBQAAKwBACABDAAAwAEAMBEDAACIAQAgTQAAhgEAME4AAAcAEE8AAIYBADBQAQAAAAFUQABzACFVQABzACFhAQByACFiAQByACFjAQByACFkAQCDAQAhZQEAgwEAIWYBAIMBACFnQACHAQAhaEAAhwEAIWkBAIMBACFqAQCDAQAhAgAAAAkAIAwAAKwBACACAAAAqgEAIAwAAKsBACAQTQAAqQEAME4AAKoBABBPAACpAQAwUAEAcgAhVEAAcwAhVUAAcwAhYQEAcgAhYgEAcgAhYwEAcgAhZAEAgwEAIWUBAIMBACFmAQCDAQAhZ0AAhwEAIWhAAIcBACFpAQCDAQAhagEAgwEAIRBNAACpAQAwTgAAqgEAEE8AAKkBADBQAQByACFUQABzACFVQABzACFhAQByACFiAQByACFjAQByACFkAQCDAQAhZQEAgwEAIWYBAIMBACFnQACHAQAhaEAAhwEAIWkBAIMBACFqAQCDAQAhDFABAI0BACFUQACOAQAhVUAAjgEAIWEBAI0BACFiAQCNAQAh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-Uhs_VRtAVhtBVxtCWRtDWwVEXBxFXhtGYAVHYR1IYhtJYxtKZAVLZx5MaCI"
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
var connectionString = `${process.env.DATABASE_URL}`;
var adapter = new PrismaPg({ connectionString });
var prisma = new PrismaClient({ adapter });

// src/server.ts
var PORT = process.env.PORT ?? "3000";
async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");
    const server = app_default.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);
      server.close(async (error) => {
        await prisma.$disconnect();
        if (error) {
          console.error(error);
          process.exit(1);
        }
        process.exit(0);
      });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("An error occurred:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}
main();
