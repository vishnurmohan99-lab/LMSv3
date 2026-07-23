-- Plan cards show a price and a feature list (Design System "SUBSCRIPTION / PLANS").
-- priceCents is nullable on purpose: an unpriced plan shows its course count rather than
-- a figure, so nothing implies "free" unless an admin actually sets 0.
ALTER TABLE "Subscription" ADD COLUMN "priceCents" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
