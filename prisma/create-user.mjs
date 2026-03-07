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

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

async function main() {
  const username = readArg("username");
  const password = readArg("password");

  if (!username || !password) {
    console.error(
      "Uso: node prisma/create-user.mjs --username=<usuario> --password=<password>",
    );
    process.exit(1);
  }

  const passwordHash = await hash(password, PASSWORD_HASH_OPTIONS);
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
    },
  });

  console.log("Usuario creado/actualizado:", {
    id: user.id,
    username: user.username,
  });
}

main()
  .catch((error) => {
    console.error("No se pudo crear/actualizar el usuario.", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
