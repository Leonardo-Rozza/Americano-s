import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const ARGON2ID = 2;

const PASSWORD_HASH_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

async function main() {
  const username = "admin";
  const plainPassword = "admin123";
  const passwordHash = await hash(plainPassword, PASSWORD_HASH_OPTIONS);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
    },
  });

  console.log("Usuario inicial listo:", {
    id: user.id,
    username: user.username,
  });
}

main()
  .catch((error) => {
    console.error("No se pudo crear el usuario inicial.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
