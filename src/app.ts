import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/notFound.middleware.js";
import { ticketRouter } from "./modules/ticket/api.route.js";

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "QueueStorm Warmup API",
    uptime: process.uptime(),
  });
});

app.use("/", ticketRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
