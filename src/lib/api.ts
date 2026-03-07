import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";

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

export function fromUnknownError(error: unknown, fallback = "Error interno del servidor.") {
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }
  if (error instanceof z.ZodError) {
    return fail(error.issues.map((issue) => issue.message).join(", "), 400);
  }

  // Never expose internal exception details to clients.
  console.error("[API_UNHANDLED_ERROR]", error);
  return fail(fallback, 500);
}
