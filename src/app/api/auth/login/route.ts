import { z } from "zod";
import { db } from "@/lib/db";
import { fail, fromUnknownError, ok, parseJson } from "@/lib/api";
import { signAccessToken, signRefreshToken, setAuthCookies } from "@/lib/auth/jwt";
import { createAuthSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

const loginSchema = z
  .object({
    username: z.string().trim().min(1, "El username es obligatorio."),
    password: z.string().min(1, "La password es obligatoria."),
  })
  .strict();

const INVALID_CREDENTIALS_MESSAGE = "Usuario o contraseña inválidos.";

export async function POST(request: Request) {
  try {
    const parsed = await parseJson(request, loginSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const user = await db.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (!user) {
      return fail(INVALID_CREDENTIALS_MESSAGE, 401);
    }

    const passwordIsValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!passwordIsValid) {
      return fail(INVALID_CREDENTIALS_MESSAGE, 401);
    }

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

    const response = ok({
      user: {
        id: user.id,
        username: user.username,
      },
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    return fromUnknownError(error, "No se pudo iniciar sesión.");
  }
}
