-- Drop existing foreign key constraint
ALTER TABLE "License" DROP CONSTRAINT "License_userId_fkey";

-- Drop existing unique constraints
DROP INDEX "License_licenseHash_key";
DROP INDEX "License_userId_key";

-- Remove old columns
ALTER TABLE "License" DROP COLUMN "licenseHash";
ALTER TABLE "License" DROP COLUMN "expiresAt";
ALTER TABLE "License" DROP COLUMN "revoked";

-- Make userId nullable
ALTER TABLE "License" ALTER COLUMN "userId" DROP NOT NULL;

-- Add new columns
ALTER TABLE "License" ADD COLUMN "keyHash" TEXT NOT NULL;
ALTER TABLE "License" ADD COLUMN "redeemed" BOOLEAN NOT NULL DEFAULT false;

-- Add new unique constraints
CREATE UNIQUE INDEX "License_keyHash_key" ON "License"("keyHash");
CREATE UNIQUE INDEX "License_userId_key" ON "License"("userId");

-- Re-add foreign key (now nullable)
ALTER TABLE "License" ADD CONSTRAINT "License_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop unused enum
DROP TYPE "LicenseTier";
