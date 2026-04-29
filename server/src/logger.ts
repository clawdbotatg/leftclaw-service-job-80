import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // pretty-print only in development. In production, ship JSON to stdout for
  // Railway / Fly.io / log aggregators to ingest.
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});
