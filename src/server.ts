import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";

const PORT = process.env.PORT ?? "3000";

async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    const server = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
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
  } catch (error) {
    console.error("An error occurred:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
