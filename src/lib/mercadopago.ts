/**
 * Mercado Pago — Cliente principal y helpers
 *
 * Docs oficiales: https://www.mercadopago.com.ar/developers/es/docs
 * SDK Node.js:    https://github.com/mercadopago/sdk-nodejs
 *
 * Usamos la API de "Suscripciones" (Preapproval) para cobros recurrentes.
 * Flujo:
 *   1. Crear un "Preapproval Plan" (plan recurrente) por cada tier.
 *   2. Cuando el usuario elige un plan, redirigirlo al init_point del plan.
 *   3. MP llama al webhook con los cambios de estado.
 *   4. El webhook actualiza la BD de Supabase.
 */

import { MercadoPagoConfig, PreApprovalPlan, PreApproval, Payment } from 'mercadopago'

// ─── Cliente singleton ────────────────────────────────────────────────────────

let _client: MercadoPagoConfig | null = null

export function getMPClient(): MercadoPagoConfig {
  if (!_client) {
    _client = new MercadoPagoConfig({
      accessToken: import.meta.env.MP_ACCESS_TOKEN,
      options: { timeout: 5000 },
    })
  }
  return _client
}

// ─── IDs de Preapproval Plans por plan ───────────────────────────────────────

export const MP_PLAN_IDS = {
  basic: import.meta.env.MP_PLAN_BASIC_ID as string,
  professional: import.meta.env.MP_PLAN_PRO_ID as string,
  premium: import.meta.env.MP_PLAN_PREMIUM_ID as string,
} as const

export type MPPlanKey = keyof typeof MP_PLAN_IDS

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface MPSubscriptionInfo {
  id: string
  status: 'authorized' | 'paused' | 'cancelled' | 'pending' | 'in_process' | 'rejected'
  preapproval_plan_id: string
  payer_email: string
  next_payment_date: string | null
  last_modified: string
  external_reference: string | null
}

// ─── Crear / obtener init_point para suscripción ─────────────────────────────

/**
 * Devuelve la URL de checkout de MP para que el usuario se suscriba.
 * external_reference = businessId para correlacionar en el webhook.
 */
export async function createSubscriptionLink({
  planKey,
  businessId,
  payerEmail,
  backUrl,
}: {
  planKey: MPPlanKey
  businessId: string
  payerEmail: string
  backUrl: string
}): Promise<string> {
  const client = getMPClient()
  const preApprovalPlan = new PreApprovalPlan(client)

  // Obtenemos el plan para extraer el init_point actualizado
  const plan = await preApprovalPlan.get({ id: MP_PLAN_IDS[planKey] })

  if (!plan.init_point) {
    throw new Error(`El plan "${planKey}" no tiene init_point. Verificá que esté activo en MP.`)
  }

  // Agregamos parámetros al init_point para que MP los devuelva al webhook
  const url = new URL(plan.init_point)
  url.searchParams.set('external_reference', businessId)
  url.searchParams.set('payer_email', payerEmail)
  url.searchParams.set('back_url', backUrl)

  return url.toString()
}

/**
 * Alternativa: crear una suscripción directamente via API (sin redirect),
 * útil cuando ya tenés el card_token del usuario (Advanced Integration).
 */
export async function createDirectSubscription({
  planKey,
  businessId,
  payerEmail,
  cardTokenId,
  backUrl,
}: {
  planKey: MPPlanKey
  businessId: string
  payerEmail: string
  cardTokenId: string
  backUrl: string
}): Promise<MPSubscriptionInfo> {
  const client = getMPClient()
  const preApproval = new PreApproval(client)

  const result = await preApproval.create({
    body: {
      preapproval_plan_id: MP_PLAN_IDS[planKey],
      payer_email: payerEmail,
      card_token_id: cardTokenId,
      external_reference: businessId,
      back_url: backUrl,
    },
  })

  return normalizeSubscription(result)
}

// ─── Obtener suscripción ──────────────────────────────────────────────────────

export async function getSubscription(subscriptionId: string): Promise<MPSubscriptionInfo> {
  const client = getMPClient()
  const preApproval = new PreApproval(client)
  const result = await preApproval.get({ id: subscriptionId })
  return normalizeSubscription(result)
}

// ─── Cancelar suscripción ─────────────────────────────────────────────────────

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const client = getMPClient()
  const preApproval = new PreApproval(client)
  await preApproval.update({
    id: subscriptionId,
    body: { status: 'cancelled' },
  })
}

// ─── Pausar / reactivar suscripción ──────────────────────────────────────────

export async function pauseSubscription(subscriptionId: string): Promise<void> {
  const client = getMPClient()
  const preApproval = new PreApproval(client)
  await preApproval.update({ id: subscriptionId, body: { status: 'paused' } })
}

export async function resumeSubscription(subscriptionId: string): Promise<void> {
  const client = getMPClient()
  const preApproval = new PreApproval(client)
  await preApproval.update({ id: subscriptionId, body: { status: 'authorized' } })
}

// ─── Obtener pago por ID (para invoices) ─────────────────────────────────────

export async function getPayment(paymentId: string | number) {
  const client = getMPClient()
  const payment = new Payment(client)
  return payment.get({ id: Number(paymentId) })
}

// ─── Verificar firma del webhook ──────────────────────────────────────────────

/**
 * MP envía un header x-signature con la firma HMAC-SHA256.
 * Formato: ts=<timestamp>,v1=<hash>
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#verificarfirma
 */
export function verifyWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
}: {
  xSignature: string
  xRequestId: string
  dataId: string
}): boolean {
  const secret = import.meta.env.MP_WEBHOOK_SECRET
  if (!secret) return false

  // Parsear ts y v1 del header
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, v] = p.split('=', 2)
      return [k.trim(), v.trim()]
    })
  )

  const { ts, v1 } = parts
  if (!ts || !v1) return false

  // El manifest que MP firma es: "id:<dataId>;request-id:<xRequestId>;ts:<ts>;"
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

  const { createHmac } = require('crypto')
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  return expected === v1
}

// ─── Normalizar respuesta de MP ───────────────────────────────────────────────

function normalizeSubscription(raw: Record<string, unknown>): MPSubscriptionInfo {
  return {
    id: raw.id as string,
    status: raw.status as MPSubscriptionInfo['status'],
    preapproval_plan_id: raw.preapproval_plan_id as string,
    payer_email: raw.payer_email as string,
    next_payment_date: (raw.next_payment_date as string | null) ?? null,
    last_modified: raw.last_modified as string,
    external_reference: (raw.external_reference as string | null) ?? null,
  }
}

// ─── Mapear estado MP → estado interno ────────────────────────────────────────

export type InternalSubStatus = 'active' | 'past_due' | 'cancelled' | 'paused' | 'pending'

export function mapMPStatus(mpStatus: MPSubscriptionInfo['status']): InternalSubStatus {
  const map: Record<MPSubscriptionInfo['status'], InternalSubStatus> = {
    authorized: 'active',
    paused: 'paused',
    cancelled: 'cancelled',
    pending: 'pending',
    in_process: 'pending',
    rejected: 'past_due',
  }
  return map[mpStatus] ?? 'pending'
}

// ─── Mapear plan_id de MP → plan interno ─────────────────────────────────────

export function getPlanKeyByMPPlanId(mpPlanId: string): MPPlanKey | null {
  const entry = Object.entries(MP_PLAN_IDS).find(([, id]) => id === mpPlanId)
  return entry ? (entry[0] as MPPlanKey) : null
}
