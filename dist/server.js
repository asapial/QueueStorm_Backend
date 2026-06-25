// src/server.ts
import "dotenv/config";

// src/app.ts
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
var app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";

// prisma/generated/prisma/client.ts
import "process";
import * as path from "path";
import { fileURLToPath } from "url";
import "@prisma/client/runtime/client";

// prisma/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.8.0",
  "engineVersion": "3c6e192761c0362d496ed980de936e2f3cebcd3a",
  "activeProvider": "postgresql",
  "inlineSchema": '// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\n// Get a free hosted Postgres database in seconds: `npx create-db`\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n',
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
config.runtimeDataModel = JSON.parse('{"models":{},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse("[]"),
  graph: "AAAA"
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
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma.");
}
var adapter = new PrismaPg({ connectionString: databaseUrl });
var prisma = new PrismaClient({ adapter });

// src/server.ts
var port = Number(process.env.PORT ?? 3e3);
var server = app.listen(port, () => {
  console.log(`QueueStorm backend listening on port ${port}`);
});
var shutdown = async (signal) => {
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
