-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoTorneo" AS ENUM ('AMERICANO', 'LARGO');

-- CreateEnum
CREATE TYPE "EstadoTorneo" AS ENUM ('CONFIGURACION', 'GRUPOS', 'RANKING', 'DESEMPATE', 'ELIMINATORIA', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "MetodoDesempate" AS ENUM ('MONEDA', 'TIEBREAK');

-- CreateEnum
CREATE TYPE "FaseGrupo" AS ENUM ('RONDA1', 'RONDA2');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Torneo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoTorneo" NOT NULL,
    "estado" "EstadoTorneo" NOT NULL DEFAULT 'CONFIGURACION',
    "cantidadCanchas" INTEGER NOT NULL DEFAULT 2,
    "metodoDesempate" "MetodoDesempate" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Torneo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pareja" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "grupoId" TEXT,
    "nombre" TEXT NOT NULL,
    "jugador1" TEXT,
    "jugador2" TEXT,
    "seed" INTEGER,

    CONSTRAINT "Pareja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartidoGrupo" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "fase" "FaseGrupo" NOT NULL,
    "orden" INTEGER NOT NULL,
    "pareja1Id" TEXT NOT NULL,
    "pareja2Id" TEXT NOT NULL,
    "gamesPareja1" INTEGER,
    "gamesPareja2" INTEGER,
    "completado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartidoGrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "totalRondas" INTEGER NOT NULL,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketMatch" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "ronda" INTEGER NOT NULL,
    "posicion" INTEGER NOT NULL,
    "esBye" BOOLEAN NOT NULL DEFAULT false,
    "pareja1Id" TEXT,
    "pareja2Id" TEXT,
    "ganadorId" TEXT,
    "gamesPareja1" INTEGER,
    "gamesPareja2" INTEGER,
    "completado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BracketMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Desempate" (
    "id" TEXT NOT NULL,
    "torneoId" TEXT NOT NULL,
    "pareja1Id" TEXT NOT NULL,
    "pareja2Id" TEXT NOT NULL,
    "ganadorId" TEXT,
    "metodo" "MetodoDesempate" NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Desempate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PartidoGrupo_grupoId_fase_orden_key" ON "PartidoGrupo"("grupoId", "fase", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_torneoId_key" ON "Bracket"("torneoId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_bracketId_ronda_posicion_key" ON "BracketMatch"("bracketId", "ronda", "posicion");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- AddForeignKey
ALTER TABLE "Torneo" ADD CONSTRAINT "Torneo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pareja" ADD CONSTRAINT "Pareja_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pareja" ADD CONSTRAINT "Pareja_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartidoGrupo" ADD CONSTRAINT "PartidoGrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartidoGrupo" ADD CONSTRAINT "PartidoGrupo_pareja1Id_fkey" FOREIGN KEY ("pareja1Id") REFERENCES "Pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartidoGrupo" ADD CONSTRAINT "PartidoGrupo_pareja2Id_fkey" FOREIGN KEY ("pareja2Id") REFERENCES "Pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_pareja1Id_fkey" FOREIGN KEY ("pareja1Id") REFERENCES "Pareja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_pareja2Id_fkey" FOREIGN KEY ("pareja2Id") REFERENCES "Pareja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_ganadorId_fkey" FOREIGN KEY ("ganadorId") REFERENCES "Pareja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desempate" ADD CONSTRAINT "Desempate_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desempate" ADD CONSTRAINT "Desempate_pareja1Id_fkey" FOREIGN KEY ("pareja1Id") REFERENCES "Pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desempate" ADD CONSTRAINT "Desempate_pareja2Id_fkey" FOREIGN KEY ("pareja2Id") REFERENCES "Pareja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desempate" ADD CONSTRAINT "Desempate_ganadorId_fkey" FOREIGN KEY ("ganadorId") REFERENCES "Pareja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

