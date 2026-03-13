import { appConfig, type LogLevel } from "@/lib/config";

type LogContext = Record<string, unknown> | undefined;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|secret|token|hash)/i;

function sanitizeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

export function sanitizeForLog(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return value;
  }

  if (depth >= 5) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, seen, depth + 1));
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }

  seen.add(value);
  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : sanitizeForLog(nestedValue, seen, depth + 1);
  }
  return output;
}

function shouldLog(level: LogLevel): boolean {
  if (level === "debug") {
    return appConfig.debugLogsEnabled;
  }

  return levelPriority[level] >= levelPriority[appConfig.logLevel];
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const safeContext = context ? sanitizeForLog(context) : undefined;
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (level === "error") {
    console.error(formattedMessage, safeContext ?? "");
    return;
  }

  if (level === "warn") {
    console.warn(formattedMessage, safeContext ?? "");
    return;
  }

  if (level === "debug") {
    console.debug(formattedMessage, safeContext ?? "");
    return;
  }

  console.info(formattedMessage, safeContext ?? "");
}

export const logger = {
  debug(message: string, context?: LogContext) {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    write("error", message, context);
  },
};

