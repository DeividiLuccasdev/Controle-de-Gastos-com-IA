-- Idempotência dos gastos com comprovante.

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN "imagemHash" TEXT;

-- Gastos duplicados que já existam (mesmo usuário e mesma imagem, criados por
-- duplo clique antes desta correção) impediriam a restrição única.
-- Nenhum dado é apagado: o gasto mais antigo continua com a imagem e os
-- repetidos ficam sem imagemUrl, para o usuário revisar e excluir se quiser.
UPDATE "Gasto" AS g
SET "imagemUrl" = NULL
WHERE g."imagemUrl" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Gasto" AS original
    WHERE original."usuarioId" = g."usuarioId"
      AND original."imagemUrl" = g."imagemUrl"
      AND original."id" < g."id"
  );

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_usuarioId_imagemUrl_key" ON "Gasto"("usuarioId", "imagemUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_usuarioId_imagemHash_key" ON "Gasto"("usuarioId", "imagemHash");
