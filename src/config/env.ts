import "dotenv/config";

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: "${key}". ` +
        `Set it in your .env file (local) or in the Vercel project settings (production).`,
    );
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: process.env.PORT ?? "3000",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: required("DATABASE_URL"),
  openRouterApiKey: required("OPENROUTER_API_KEY"),
};
