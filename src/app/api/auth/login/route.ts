import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseJson, runApiRoute } from "@/lib/api";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/auth/jwt";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  assertLoginAttemptAllowed,
  buildLoginRateLimitKey,
  clearLoginRateLimit,
} from "@/lib/auth/login-rate-limit";
import { createAuthSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { logger } from "@/lib/logger";

const loginSchema = z
  .object({
    username: z.string().trim().min(1, "El username es obligatorio."),
    password: z.string().min(1, "La password es obligatoria."),
  })
  .strict();

const INVALID_CREDENTIALS_MESSAGE = "Usuario o contraseña inválidos.";

export async function POST(request: Request) {
  return runApiRoute(
    request,
    {
      operation: "auth.login",
      fallbackMessage: "No se pudo iniciar sesión.",
    },
    async (context) => {
      assertSameOrigin(request);

      const parsed = await parseJson(request, loginSchema);
      if (!parsed.success) {
        return parsed.response;
      }

      const rateLimitKey = buildLoginRateLimitKey(request, parsed.data.username);
      await assertLoginAttemptAllowed(rateLimitKey);

      const user = await db.user.findFirst({
        where: {
          username: {
            equals: parsed.data.username,
            mode: "insensitive",
          },
        },
      });
      if (!user) {
        logger.warn("auth.login.invalid_credentials", {
          ...context,
          username: parsed.data.username,
        });
        return fail(INVALID_CREDENTIALS_MESSAGE, 401);
      }

      const passwordIsValid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!passwordIsValid) {
        logger.warn("auth.login.invalid_credentials", {
          ...context,
          username: parsed.data.username,
          userId: user.id,
        });
        return fail(INVALID_CREDENTIALS_MESSAGE, 401);
      }

      context.userId = user.id;
      const sessionId = crypto.randomUUID();
      const accessToken = await signAccessToken({
        userId: user.id,
        username: user.username,
      });
      const refreshToken = await signRefreshToken({
        userId: user.id,
        sessionId,
      });

      await createAuthSession({
        sessionId,
        userId: user.id,
        refreshToken,
      });
      await clearLoginRateLimit(rateLimitKey);

      const response = ok({
        user: {
          id: user.id,
          username: user.username,
        },
      });
      setAuthCookies(response, accessToken, refreshToken);
      return response;
    },
  );
}
