-- CreateTable
CREATE TABLE "public"."Flashcard" (
    "id" INTEGER NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "tags" TEXT,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);
