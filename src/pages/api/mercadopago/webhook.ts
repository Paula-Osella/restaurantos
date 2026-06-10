/**
 * POST /api/mercadopago/webhook
 *
 * Recibe notificaciones IPN/Webhooks de Mercado Pago.
 *
 * MP envía dos tipos de notificaciones relevantes:
 *   - topic=preapproval  → cambio en una suscripción recurrente
 *   - topic=authorized_payment → cobro puntual dentro de una suscripción
 *
 * Configurar la URL del webhook en:
 * https://www.mercadopago.com.ar/developers/panel/webhooks
 *
 * La URL debe ser pública (usá ngrok en desarrollo):
 *   https://<tu-dominio>/api/mercadopago/webhook
 */

import type { APIRoute } from 'astro'
import {
  verifyWebhookSignature,
  getSubscription,
  getPayment,
  mapMPStatus,
  getPlanKeyByMPPlanId,
  MP_PLAN_IDS,
} from '@/lib/mercadopago'
import { apiSuccess, apiError } from '@/lib/api'

// ─── Admin Supabase client ────────────────────────────────────────────────────

async function getAdminSupabase() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Handlers por tipo de evento ─────────────────────────────────────────────

/**
 * Maneja cambios de estado en una suscripción (preapproval).
 * Estados posibles: authorized, paused, cancelled, pending, in_process, rejected
 */
async function handlePreapprovalChange(subscriptionId: string) {
  const supabase = await getAdminSupabase()
  let subscription

  try {
    subscription = await getSubscription(subscriptionId)
  } catch (err) {
    console.error('[MP Webhook] Error fetching subscription:', err)
    return
  }

  const businessId = subscription.external_reference
  if (!businessId) {
    console.warn('[MP Webhook] Subscription without external_reference:', subscriptionId)
    return
  }

  const internalStatus = mapMPStatus(subscription.status)

  // Determinar estado del negocio según estado de suscripción
  const businessStatus = (() => {
    if (internalStatus === 'active') return 'active'
    if (internalStatus === 'cancelled') return 'cancelled'
    if (internalStatus === 'past_due' || internalStatus === 'paused') return 'suspended'
    return undefined // pending/in_process → no cambiamos el estado todavía
  })()

  // Determinar plan_id interno desde el plan de MP
  const planKey = getPlanKeyByMPPlanId(subscription.preapproval_plan_id)
  let planId: string | undefined

  if (planKey) {
    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .eq('name', planKey === 'basic' ? 'Básico' : planKey === 'professional' ? 'Profesional' : 'Premium')
      .single()
    planId = plan?.id
  }

  const updatePayload: Record<string, unknown> = {
    mp_subscription_id: subscriptionId,
    subscription_status: internalStatus,
    next_payment_date: subscription.next_payment_date,
  }

  if (businessStatus) updatePayload.status = businessStatus
  if (planId) updatePayload.plan_id = planId

  const { error } = await supabase
    .from('businesses')
    .update(updatePayload)
    .eq('id', businessId)

  if (error) {
    console.error('[MP Webhook] Error updating business:', error)
  } else {
    console.log(`[MP Webhook] Business ${businessId} updated → status: ${businessStatus ?? 'unchanged'}, sub: ${internalStatus}`)
  }
}

/**
 * Maneja un cobro autorizado dentro de una suscripción.
 * Guarda la factura en la tabla invoices.
 */
async function handleAuthorizedPayment(paymentId: string) {
  const supabase = await getAdminSupabase()
  let payment

  try {
    payment = await getPayment(paymentId)
  } catch (err) {
    console.error('[MP Webhook] Error fetching payment:', err)
    return
  }

  // external_reference viene del preapproval (= businessId)
  const businessId = payment.external_reference
  if (!businessId) {
    console.warn('[MP Webhook] Payment without external_reference:', paymentId)
    return
  }

  if (payment.status !== 'approved') {
    console.log(`[MP Webhook] Payment ${paymentId} not approved (${payment.status}), skipping invoice.`)
    return
  }

  const { error } = await supabase
    .from('invoices')
    .upsert(
      {
        business_id: businessId,
        mp_payment_id: String(paymentId),
        amount: (payment.transaction_amount ?? 0),
        currency: payment.currency_id ?? 'ARS',
        status: 'paid',
        mp_payment_url: (payment as any).point_of_interaction?.transaction_data?.ticket_url ?? null,
        period_start: payment.date_created ?? null,
        period_end: payment.date_approved ?? null,
        description: (payment.description as string | null) ?? null,
      },
      { onConflict: 'mp_payment_id' }
    )

  if (error) {
    console.error('[MP Webhook] Error saving invoice:', error)
  } else {
    console.log(`[MP Webhook] Invoice saved for business ${businessId}, payment ${paymentId}`)
  }
}

/**
 * Maneja un pago rechazado → marcar suscripción en mora.
 */
async function handleRejectedPayment(paymentId: string) {
  const supabase = await getAdminSupabase()
  let payment

  try {
    payment = await getPayment(paymentId)
  } catch (err) {
    console.error('[MP Webhook] Error fetching rejected payment:', err)
    return
  }

  const businessId = payment.external_reference
  if (!businessId) return

  await supabase
    .from('businesses')
    .update({ subscription_status: 'past_due', status: 'suspended' })
    .eq('id', businessId)

  console.log(`[MP Webhook] Payment rejected for business ${businessId}`)
}

// ─── Handler principal ────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  // ── Verificar firma ──────────────────────────────────────────────────────────
  const xSignature = request.headers.get('x-signature') ?? ''
  const xRequestId = request.headers.get('x-request-id') ?? ''

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const dataId = String((body?.data as Record<string, unknown>)?.id ?? '')

  // Solo verificar firma en producción (MP no firma las notificaciones en sandbox correctamente)
  if (import.meta.env.NODE_ENV === 'production') {
    const isValid = verifyWebhookSignature({ xSignature, xRequestId, dataId })
    if (!isValid) {
      console.warn('[MP Webhook] Invalid signature, rejecting request.')
      return apiError('Invalid webhook signature', 401)
    }
  }

  const topic = (body.type ?? body.topic) as string
  const resourceId = dataId || String((body as any).id ?? '')

  console.log(`[MP Webhook] Received: type=${topic}, id=${resourceId}`)

  try {
    switch (topic) {
      // Cambio en suscripción recurrente
      case 'preapproval':
        await handlePreapprovalChange(resourceId)
        break

      // Cobro dentro de la suscripción
      case 'subscription_authorized_payment':
      case 'authorized_payment': {
        const payment = await getPayment(resourceId)
        if (payment.status === 'approved') {
          await handleAuthorizedPayment(resourceId)
        } else if (payment.status === 'rejected') {
          await handleRejectedPayment(resourceId)
        }
        break
      }

      // Pago genérico (por si MP lo envía así)
      case 'payment': {
        const payment = await getPayment(resourceId)
        // Solo procesar si viene de una suscripción
        if ((payment as any).preapproval_id) {
          if (payment.status === 'approved') {
            await handleAuthorizedPayment(resourceId)
          } else if (payment.status === 'rejected') {
            await handleRejectedPayment(resourceId)
          }
        }
        break
      }

      default:
        console.log(`[MP Webhook] Topic not handled: ${topic}`)
    }

    // MP espera 200 OK para confirmar recepción
    return apiSuccess({ received: true })
  } catch (err) {
    console.error('[MP Webhook] Unhandled error:', err)
    // Devolver 200 igualmente para que MP no reintente infinitamente
    // si el error es nuestro y no de MP
    return apiSuccess({ received: true, error: 'internal' })
  }
}
