import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

export const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
