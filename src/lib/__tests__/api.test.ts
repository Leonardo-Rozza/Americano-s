import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, fromUnknownError, ok, runApiRoute } from "../api";

describe("api helpers", () => {
  it("adjunta request id en handlers exitosos", async () => {
    const request = new Request("http://localhost/api/test", { method: "POST" });

    const response = await runApiRoute(
      request,
      {
        operation: "test.success",
        fallbackMessage: "fallo",
      },
      async () => ok({ done: true }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { done: true },
    });
  });

  it("serializa ApiError y ZodError con el contrato esperado", async () => {
    const apiErrorResponse = fromUnknownError(new ApiError("Conflicto", 409));
    await expect(apiErrorResponse.json()).resolves.toEqual({
      success: false,
      error: "Conflicto",
    });

    let zodError: z.ZodError | null = null;
    try {
      z.object({ name: z.string().min(2, "Nombre corto") }).parse({ name: "" });
    } catch (error) {
      zodError = error as z.ZodError;
    }

    const zodResponse = fromUnknownError(zodError);
    await expect(zodResponse.json()).resolves.toEqual({
      success: false,
      error: "Nombre corto",
    });
  });

  it("usa fallback para errores desconocidos", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = fromUnknownError(new Error("boom"), "Error controlado");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Error controlado",
    });

    errorSpy.mockRestore();
  });
});

