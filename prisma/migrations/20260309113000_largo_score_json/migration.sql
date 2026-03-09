ALTER TABLE "PartidoGrupo"
  ADD COLUMN "scoreJson" JSONB,
  ADD COLUMN "walkover" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BracketMatch"
  ADD COLUMN "scoreJson" JSONB,
  ADD COLUMN "walkover" BOOLEAN NOT NULL DEFAULT false;
