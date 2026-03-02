-- AlterTable
ALTER TABLE "Drawing" ADD COLUMN "shapeId" TEXT;

-- CreateIndex
CREATE INDEX "Drawing_shapeId_idx" ON "Drawing"("shapeId");
