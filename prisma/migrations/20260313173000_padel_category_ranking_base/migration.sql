-- CreateEnum
CREATE TYPE "CategoriaPadel" AS ENUM ('TERCERA', 'CUARTA', 'QUINTA', 'SEXTA', 'SEPTIMA', 'OCTAVA', 'NOVENA');

-- AlterTable
ALTER TABLE "Torneo" ADD COLUMN "categoriaPadel" "CategoriaPadel";

-- DropForeignKey
ALTER TABLE "Participante" DROP CONSTRAINT "Participante_categoriaId_fkey";

-- DropIndex
DROP INDEX "Participante_torneoId_categoriaId_idx";

-- AlterTable
ALTER TABLE "Participante" DROP COLUMN "categoriaId";

-- DropTable
DROP TABLE "Categoria";
