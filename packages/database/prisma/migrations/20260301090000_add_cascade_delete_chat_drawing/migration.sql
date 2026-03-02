-- AlterTable Chat and Drawing to add CASCADE delete
-- Drop existing foreign key constraints
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_roomId_fkey";
ALTER TABLE "Drawing" DROP CONSTRAINT IF EXISTS "Drawing_roomId_fkey";

-- Re-add foreign key constraints with ON DELETE CASCADE
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
