import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { logger } from "@/lib/logger";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export type ApiRequestContext = {
  operation: string;
  requestId: string;
  method: string;
  pathname: string;
  userId?: string;
};

function buildRequestId() {
  return crypto.randomUUID();
}

function attachRequestId(response: Response, context: ApiRequestContext) {
  response.headers.set("x-request-id", context.requestId);
  return response;
}

export function createApiRequestContext(request: Request, operation: string): ApiRequestContext {
  const url = new URL(request.url);

  return {
    operation,
    requestId: buildRequestId(),
    method: request.method.toUpperCase(),
    pathname: url.pathname,
  };
}

export async function runApiRoute(
  request: Request,
  options: {
    operation: string;
    fallbackMessage: string;
  },
  handler: (context: ApiRequestContext) => Promise<Response> | Response,
) {
  const context = createApiRequestContext(request, options.operation);
  const startedAt = Date.now();

  try {
    const response = await handler(context);
    logger.debug("api.request.complete", {
      ...context,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return attachRequestId(response, context);
  } catch (error) {
    const response = fromUnknownError(error, options.fallbackMessage, context);
    return attachRequestId(response, context);
  }
}

export async function parseJson<T>(request: Request, schema: ZodType<T>) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return {
        success: false as const,
        response: fail(parsed.error.issues.map((issue) => issue.message).join(", "), 400),
      };
    }
    return { success: true as const, data: parsed.data };
  } catch {
    return { success: false as const, response: fail("Body JSON invalido.", 400) };
  }
}

export function fromUnknownError(
  error: unknown,
  fallback = "Error interno del servidor.",
  context?: Partial<ApiRequestContext>,
) {
  if (error instanceof ApiError) {
    logger.warn("api.request.failed", {
      ...context,
      status: error.status,
      error: {
        name: error.name,
        message: error.message,
      },
    });
    return fail(error.message, error.status);
  }
  if (error instanceof z.ZodError) {
    logger.warn("api.request.validation_failed", {
      ...context,
      status: 400,
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return fail(error.issues.map((issue) => issue.message).join(", "), 400);
  }

  logger.error("api.request.unhandled", {
    ...context,
    status: 500,
    error,
  });
  return fail(fallback, 500);
}
