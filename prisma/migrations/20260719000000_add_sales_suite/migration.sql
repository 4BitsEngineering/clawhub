-- Phase 1: Sales Suite — Core data model y roles
-- Añade: SalesRep, Prospect, Campaign, CampaignSend, LandingPage,
--        LandingVisit, Purchase, Commission
-- Extiende UserRole con EMPRESA y COMERCIAL

-- ─── Extender UserRole ────────────────────────────────────────────────────────
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EMPRESA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMERCIAL';

-- ─── Nuevos enums ─────────────────────────────────────────────────────────────
CREATE TYPE "SalesRepStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TYPE "ProspectStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'CAMPAIGN_SENT',
  'VISITED_LANDING',
  'PURCHASED',
  'LOST'
);

CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED');

CREATE TYPE "Channel" AS ENUM ('EMAIL', 'SMS');

CREATE TYPE "SendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'BOUNCED');

CREATE TYPE "ProductType" AS ENUM ('ANNUAL_LICENSE');

CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID');

-- ─── SalesRep ─────────────────────────────────────────────────────────────────
CREATE TABLE "SalesRep" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "territory"      TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "status"         "SalesRepStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesRep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesRep_userId_key" ON "SalesRep"("userId");
CREATE INDEX "SalesRep_status_idx" ON "SalesRep"("status");
ALTER TABLE "SalesRep"
  ADD CONSTRAINT "SalesRep_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── LandingPage ──────────────────────────────────────────────────────────────
CREATE TABLE "LandingPage" (
    "id"                  TEXT NOT NULL,
    "slug"                TEXT NOT NULL,
    "headline"            TEXT NOT NULL DEFAULT 'Transforma tu empresa con AI-Office',
    "videoUrl"            TEXT NOT NULL DEFAULT '',
    "bodyHtml"            TEXT NOT NULL DEFAULT '',
    "originalPriceCents"  INTEGER NOT NULL DEFAULT 20000,
    "discountPriceCents"  INTEGER NOT NULL DEFAULT 14900,
    "currency"            TEXT NOT NULL DEFAULT 'EUR',
    "discountEndsAt"      TIMESTAMP(3),
    "stripeProductId"     TEXT,
    "stripeAnnualPriceId" TEXT,
    "isActive"            BOOLEAN NOT NULL DEFAULT true,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- ─── Prospect ─────────────────────────────────────────────────────────────────
CREATE TABLE "Prospect" (
    "id"              TEXT NOT NULL,
    "salesRepId"      TEXT,
    "createdById"     TEXT NOT NULL,
    "cif"             TEXT,
    "name"            TEXT NOT NULL,
    "phone"           TEXT,
    "email"           TEXT NOT NULL,
    "contactName"     TEXT,
    "status"          "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "notes"           TEXT,
    "convertedFirmId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Prospect_salesRepId_idx"  ON "Prospect"("salesRepId");
CREATE INDEX "Prospect_createdById_idx" ON "Prospect"("createdById");
CREATE INDEX "Prospect_status_idx"      ON "Prospect"("status");
CREATE INDEX "Prospect_email_idx"       ON "Prospect"("email");
ALTER TABLE "Prospect"
  ADD CONSTRAINT "Prospect_salesRepId_fkey"
  FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Campaign ─────────────────────────────────────────────────────────────────
CREATE TABLE "Campaign" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "subject"     TEXT NOT NULL,
    "bodyEmail"   TEXT NOT NULL,
    "bodySms"     TEXT,
    "landingId"   TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status"      "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_createdById_status_idx" ON "Campaign"("createdById", "status");
CREATE INDEX "Campaign_status_idx"            ON "Campaign"("status");
ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_landingId_fkey"
  FOREIGN KEY ("landingId") REFERENCES "LandingPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CampaignSend ─────────────────────────────────────────────────────────────
CREATE TABLE "CampaignSend" (
    "id"             TEXT NOT NULL,
    "campaignId"     TEXT NOT NULL,
    "prospectId"     TEXT NOT NULL,
    "channel"        "Channel" NOT NULL,
    "status"         "SendStatus" NOT NULL DEFAULT 'PENDING',
    "trackingToken"  TEXT NOT NULL,
    "externalId"     TEXT,
    "sentAt"         TIMESTAMP(3),
    "openedAt"       TIMESTAMP(3),
    "clickedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignSend_trackingToken_key" ON "CampaignSend"("trackingToken");
CREATE INDEX "CampaignSend_campaignId_idx"  ON "CampaignSend"("campaignId");
CREATE INDEX "CampaignSend_prospectId_idx"  ON "CampaignSend"("prospectId");
ALTER TABLE "CampaignSend"
  ADD CONSTRAINT "CampaignSend_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignSend"
  ADD CONSTRAINT "CampaignSend_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── LandingVisit ─────────────────────────────────────────────────────────────
CREATE TABLE "LandingVisit" (
    "id"             TEXT NOT NULL,
    "landingId"      TEXT NOT NULL,
    "sendId"         TEXT,
    "trackingToken"  TEXT,
    "ipHash"         TEXT,
    "convertedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LandingVisit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LandingVisit_landingId_createdAt_idx" ON "LandingVisit"("landingId", "createdAt");
CREATE INDEX "LandingVisit_trackingToken_idx"       ON "LandingVisit"("trackingToken");
ALTER TABLE "LandingVisit"
  ADD CONSTRAINT "LandingVisit_landingId_fkey"
  FOREIGN KEY ("landingId") REFERENCES "LandingPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LandingVisit"
  ADD CONSTRAINT "LandingVisit_sendId_fkey"
  FOREIGN KEY ("sendId") REFERENCES "CampaignSend"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Purchase ─────────────────────────────────────────────────────────────────
CREATE TABLE "Purchase" (
    "id"                  TEXT NOT NULL,
    "prospectId"          TEXT,
    "trackingToken"       TEXT,
    "stripeSessionId"     TEXT NOT NULL,
    "stripePaymentIntent" TEXT,
    "productType"         "ProductType" NOT NULL DEFAULT 'ANNUAL_LICENSE',
    "amountCents"         INTEGER NOT NULL,
    "currency"            TEXT NOT NULL DEFAULT 'EUR',
    "status"              "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "firmId"              TEXT,
    "buyerEmail"          TEXT,
    "buyerName"           TEXT,
    "completedAt"         TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Purchase_stripeSessionId_key"   ON "Purchase"("stripeSessionId");
CREATE INDEX "Purchase_prospectId_idx"               ON "Purchase"("prospectId");
CREATE INDEX "Purchase_trackingToken_idx"            ON "Purchase"("trackingToken");
CREATE INDEX "Purchase_status_createdAt_idx"         ON "Purchase"("status", "createdAt");
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Commission ───────────────────────────────────────────────────────────────
CREATE TABLE "Commission" (
    "id"          TEXT NOT NULL,
    "purchaseId"  TEXT NOT NULL,
    "salesRepId"  TEXT NOT NULL,
    "rate"        DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status"      "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt"      TIMESTAMP(3),
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Commission_purchaseId_key"        ON "Commission"("purchaseId");
CREATE INDEX "Commission_salesRepId_status_idx"        ON "Commission"("salesRepId", "status");
ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_salesRepId_fkey"
  FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
