-- Create enums
CREATE TYPE "Deporte" AS ENUM ('PADEL', 'FUTBOL', 'TENIS');
CREATE TYPE "Formato" AS ENUM ('AMERICANO', 'LARGO', 'LIGA');
CREATE TYPE "TipoParticipante" AS ENUM ('INDIVIDUAL', 'PAREJA', 'EQUIPO');
CREATE TYPE "FasePartido" AS ENUM ('GRUPOS', 'FECHAS', 'ELIMINATORIA');
CREATE TYPE "EstadoPartido" AS ENUM ('PENDIENTE', 'EN_JUEGO', 'FINALIZADO', 'WALKOVER');
CREATE TYPE "TipoEventoPartido" AS ENUM (
  'GOL',
  'ASISTENCIA',
  'AMARILLA',
  'ROJA',
  'MVP',
  'ACE',
  'WINNER',
  'ERROR_NO_FORZADO'
);
CREATE TYPE "EstadoFechaCompetencia" AS ENUM ('PROGRAMADA', 'EN_CURSO', 'CERRADA');

-- Torneo additive fields
ALTER TABLE "Torneo"
  ADD COLUMN "deporte" "Deporte" NOT NULL DEFAULT 'PADEL',
  ADD COLUMN "formato" "Formato" NOT NULL DEFAULT 'AMERICANO',
  ADD COLUMN "config" JSONB;

-- Categoria
CREATE TABLE "Categoria" (
  "id" TEXT NOT NULL,
  "torneoId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "nivel" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- Participante
CREATE TABLE "Participante" (
  "id" TEXT NOT NULL,
  "torneoId" TEXT NOT NULL,
  "grupoId" TEXT,
  "categoriaId" TEXT,
  "nombre" TEXT NOT NULL,
  "tipo" "TipoParticipante" NOT NULL,
  "escudo" TEXT,
  "seed" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Participante_pkey" PRIMARY KEY ("id")
);

-- Jugador
CREATE TABLE "Jugador" (
  "id" TEXT NOT NULL,
  "torneoId" TEXT NOT NULL,
  "participanteId" TEXT,
  "nombre" TEXT NOT NULL,
  "apodo" TEXT,
  "dorsal" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Jugador_pkey" PRIMARY KEY ("id")
);

-- FechaCompetencia
CREATE TABLE "FechaCompetencia" (
  "id" TEXT NOT NULL,
  "torneoId" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "inicio" TIMESTAMP(3),
  "fin" TIMESTAMP(3),
  "estado" "EstadoFechaCompetencia" NOT NULL DEFAULT 'PROGRAMADA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FechaCompetencia_pkey" PRIMARY KEY ("id")
);

-- Partido
CREATE TABLE "Partido" (
  "id" TEXT NOT NULL,
  "torneoId" TEXT NOT NULL,
  "grupoId" TEXT,
  "bracketId" TEXT,
  "fechaId" TEXT,
  "fase" "FasePartido" NOT NULL DEFAULT 'GRUPOS',
  "ronda" INTEGER,
  "orden" INTEGER,
  "localId" TEXT,
  "visitanteId" TEXT,
  "ganadorId" TEXT,
  "estado" "EstadoPartido" NOT NULL DEFAULT 'PENDIENTE',
  "walkover" BOOLEAN NOT NULL DEFAULT false,
  "completado" BOOLEAN NOT NULL DEFAULT false,
  "golesLocal" INTEGER,
  "golesVisitante" INTEGER,
  "penalesLocal" INTEGER,
  "penalesVisitante" INTEGER,
  "set1Local" INTEGER,
  "set1Visitante" INTEGER,
  "set2Local" INTEGER,
  "set2Visitante" INTEGER,
  "set3Local" INTEGER,
  "set3Visitante" INTEGER,
  "tiebreak3Local" INTEGER,
  "tiebreak3Visitante" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partido_pkey" PRIMARY KEY ("id")
);

-- EventoPartido
CREATE TABLE "EventoPartido" (
  "id" TEXT NOT NULL,
  "torneoId" TEXT NOT NULL,
  "partidoId" TEXT NOT NULL,
  "jugadorId" TEXT,
  "participanteId" TEXT,
  "tipo" "TipoEventoPartido" NOT NULL,
  "minuto" INTEGER,
  "descripcion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoPartido_pkey" PRIMARY KEY ("id")
);

-- RankingConfig
CREATE TABLE "RankingConfig" (
  "torneoId" TEXT NOT NULL,
  "campeon" INTEGER NOT NULL DEFAULT 100,
  "subcampeon" INTEGER NOT NULL DEFAULT 70,
  "semifinalista" INTEGER NOT NULL DEFAULT 50,
  "cuartofinalista" INTEGER NOT NULL DEFAULT 35,
  "octavos" INTEGER NOT NULL DEFAULT 20,
  "dieciseisavos" INTEGER NOT NULL DEFAULT 10,
  "faseGrupos" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankingConfig_pkey" PRIMARY KEY ("torneoId")
);

-- Foreign keys
ALTER TABLE "Categoria"
  ADD CONSTRAINT "Categoria_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Participante"
  ADD CONSTRAINT "Participante_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Participante_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Participante_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Jugador"
  ADD CONSTRAINT "Jugador_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Jugador_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "Participante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FechaCompetencia"
  ADD CONSTRAINT "FechaCompetencia_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Partido"
  ADD CONSTRAINT "Partido_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Partido_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Partido_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Partido_fechaId_fkey" FOREIGN KEY ("fechaId") REFERENCES "FechaCompetencia"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Partido_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Participante"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Partido_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "Participante"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Partido_ganadorId_fkey" FOREIGN KEY ("ganadorId") REFERENCES "Participante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventoPartido"
  ADD CONSTRAINT "EventoPartido_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventoPartido_partidoId_fkey" FOREIGN KEY ("partidoId") REFERENCES "Partido"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventoPartido_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "EventoPartido_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "Participante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RankingConfig"
  ADD CONSTRAINT "RankingConfig_torneoId_fkey" FOREIGN KEY ("torneoId") REFERENCES "Torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Torneo_userId_deporte_formato_estado_createdAt_idx" ON "Torneo"("userId", "deporte", "formato", "estado", "createdAt");

CREATE INDEX "Participante_torneoId_tipo_seed_idx" ON "Participante"("torneoId", "tipo", "seed");
CREATE INDEX "Participante_torneoId_categoriaId_idx" ON "Participante"("torneoId", "categoriaId");

CREATE INDEX "Jugador_torneoId_participanteId_idx" ON "Jugador"("torneoId", "participanteId");
CREATE INDEX "Jugador_torneoId_nombre_idx" ON "Jugador"("torneoId", "nombre");

CREATE UNIQUE INDEX "FechaCompetencia_torneoId_numero_key" ON "FechaCompetencia"("torneoId", "numero");
CREATE INDEX "FechaCompetencia_torneoId_estado_inicio_idx" ON "FechaCompetencia"("torneoId", "estado", "inicio");

CREATE INDEX "Categoria_torneoId_nivel_idx" ON "Categoria"("torneoId", "nivel");

CREATE INDEX "Partido_torneoId_estado_fase_idx" ON "Partido"("torneoId", "estado", "fase");
CREATE INDEX "Partido_torneoId_fechaId_ronda_idx" ON "Partido"("torneoId", "fechaId", "ronda");
CREATE INDEX "Partido_localId_idx" ON "Partido"("localId");
CREATE INDEX "Partido_visitanteId_idx" ON "Partido"("visitanteId");
CREATE INDEX "Partido_ganadorId_idx" ON "Partido"("ganadorId");

CREATE INDEX "EventoPartido_torneoId_tipo_createdAt_idx" ON "EventoPartido"("torneoId", "tipo", "createdAt");
CREATE INDEX "EventoPartido_partidoId_tipo_idx" ON "EventoPartido"("partidoId", "tipo");
CREATE INDEX "EventoPartido_jugadorId_tipo_idx" ON "EventoPartido"("jugadorId", "tipo");
