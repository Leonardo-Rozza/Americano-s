import { hash, verify } from "@node-rs/argon2";

const ARGON2ID = 2;

const PASSWORD_HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

const TOKEN_HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 12_288,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(passwordHash, password, PASSWORD_HASH_OPTIONS);
}

export async function hashSecret(secret: string): Promise<string> {
  return hash(secret, TOKEN_HASH_OPTIONS);
}

export async function verifySecret(secret: string, secretHash: string): Promise<boolean> {
  return verify(secretHash, secret, TOKEN_HASH_OPTIONS);
}
