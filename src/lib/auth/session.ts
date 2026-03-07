import { db } from "@/lib/db";
import { refreshExpiresAtFromNow } from "@/lib/auth/jwt";
import { hashSecret } from "@/lib/auth/password";

export async function createAuthSession(input: {
  sessionId: string;
  userId: string;
  refreshToken: string;
}) {
  return db.authSession.create({
    data: {
      id: input.sessionId,
      userId: input.userId,
      refreshTokenHash: await hashSecret(input.refreshToken),
      expiresAt: refreshExpiresAtFromNow(),
    },
  });
}

export async function rotateAuthSession(input: { sessionId: string; refreshToken: string }) {
  return db.authSession.update({
    where: { id: input.sessionId },
    data: {
      refreshTokenHash: await hashSecret(input.refreshToken),
      expiresAt: refreshExpiresAtFromNow(),
      revokedAt: null,
    },
  });
}

export async function revokeAuthSession(sessionId: string) {
  return db.authSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
