-- =====================================================
-- RestaurantOS SaaS - Migración: Stripe → Mercado Pago
-- Migration: 003_mercadopago.sql
-- =====================================================

-- ─── TABLA: businesses ────────────────────────────────────────────────────────

-- Eliminar columnas de Stripe
ALTER TABLE businesses
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

-- Agregar columnas de Mercado Pago
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS mp_payer_id       TEXT,
  ADD COLUMN IF NOT EXISTS next_payment_date  TIMESTAMPTZ;

-- El campo subscription_status y current_period_end ya existen;
-- solo ajustamos current_period_end para que también sirva como próximo cobro
-- (Alias: current_period_end = next_payment_date en el contexto de MP)
-- Opcional: podés usar next_payment_date y deprecar current_period_end.
-- Por compatibilidad los mantenemos ambos.

COMMENT ON COLUMN businesses.mp_subscription_id IS
  'ID de suscripción en Mercado Pago (preapproval.id)';

COMMENT ON COLUMN businesses.mp_payer_id IS
  'ID del pagador en Mercado Pago (preapproval.payer_id)';

COMMENT ON COLUMN businesses.subscription_status IS
  'Estado interno de la suscripción: active | past_due | cancelled | paused | pending';

-- ─── TABLA: plans ─────────────────────────────────────────────────────────────

-- Eliminar columnas de Stripe
ALTER TABLE plans
  DROP COLUMN IF EXISTS stripe_price_monthly,
  DROP COLUMN IF EXISTS stripe_price_annual;

-- Agregar IDs de planes de MP (Preapproval Plans)
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS mp_plan_id TEXT;

COMMENT ON COLUMN plans.mp_plan_id IS
  'ID del Preapproval Plan en Mercado Pago';

-- ─── TABLA: invoices ──────────────────────────────────────────────────────────

-- Eliminar columnas de Stripe
ALTER TABLE invoices
  DROP COLUMN IF EXISTS stripe_invoice_id,
  DROP COLUMN IF EXISTS invoice_url,
  DROP COLUMN IF EXISTS invoice_pdf;

-- Agregar columnas de MP
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS mp_payment_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS mp_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT;

COMMENT ON COLUMN invoices.mp_payment_id IS
  'ID del pago en Mercado Pago (payment.id)';

COMMENT ON COLUMN invoices.mp_payment_url IS
  'URL del ticket/comprobante de pago en MP';

-- ─── ACTUALIZAR SEED DE PLANES ────────────────────────────────────────────────
-- Los mp_plan_id reales se configuran via variable de entorno
-- y se actualizan manualmente o via script de seed.
-- Dejamos NULL por defecto; se setean desde el dashboard de MP.

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_businesses_mp_subscription
  ON businesses(mp_subscription_id)
  WHERE mp_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_mp_payment
  ON invoices(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
