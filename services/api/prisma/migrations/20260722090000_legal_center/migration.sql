CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "LegalDocument" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "slug" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "changeSummary" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LegalDocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "content" JSONB NOT NULL,
  "changeSummary" TEXT,
  "status" "LegalDocumentStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "operatingSystem" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegalDocument_slug_key" ON "LegalDocument"("slug");
CREATE INDEX "LegalDocument_status_category_idx" ON "LegalDocument"("status", "category");
CREATE INDEX "LegalDocument_required_status_idx" ON "LegalDocument"("required", "status");
CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_version_key" ON "LegalDocumentVersion"("documentId", "version");
CREATE INDEX "LegalDocumentVersion_documentId_createdAt_idx" ON "LegalDocumentVersion"("documentId", "createdAt");
CREATE UNIQUE INDEX "LegalAcceptance_userId_documentId_version_key" ON "LegalAcceptance"("userId", "documentId", "version");
CREATE INDEX "LegalAcceptance_documentId_version_acceptedAt_idx" ON "LegalAcceptance"("documentId", "version", "acceptedAt");
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
