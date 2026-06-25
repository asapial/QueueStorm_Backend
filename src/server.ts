import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.port, () => {
  console.log(`QueueStorm Warmup API listening on port ${env.port}`);
});

const shutdown = async (signal: NodeJS.Signals) => {
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
