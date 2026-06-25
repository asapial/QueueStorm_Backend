import "dotenv/config";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.log(`QueueStorm backend listening on port ${port}`);
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
