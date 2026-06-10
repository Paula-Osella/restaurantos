/**
 * POST /api/mercadopago/change-plan
 *
 * Cambia el plan de un negocio.
 * Flujo:
 *   1. Cancela la suscripción actual en MP.
 *   2. Genera un nuevo init_point para el nuevo plan.
 *   3. Redirige al usuario al checkout del nuevo plan.
 *
 * Body: { planKey: 'basic' | 'professional' | 'premium' }
 * Response: { url: string }
 */

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { cancelSubscription, createSubscriptionLink } from '@/lib/mercadopago'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api'

const schema = z.object({
  planKey: z.enum(['basic', 'professional', 'premium']),
})

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiError('Solo administradores pueden cambiar el plan', 403)

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('planKey inválido', 400)

  const { planKey } = parsed.data

  const { data: business } = await locals.supabase
    .from('businesses')
    .select('id, email, mp_subscription_id')
    .eq('id', locals.businessId)
    .single()

  if (!business) return apiError('Empresa no encontrada', 404)

  // Cancelar suscripción anterior si existe
  if (business.mp_subscription_id) {
    try {
      await cancelSubscription(business.mp_subscription_id)
      await locals.supabase
        .from('businesses')
        .update({ mp_subscription_id: null, subscription_status: 'cancelled' })
        .eq('id', locals.businessId)
    } catch (err) {
      console.error('Error cancelling previous subscription:', err)
      // Continuamos igual para no bloquear el cambio de plan
    }
  }

  const appUrl = import.meta.env.PUBLIC_APP_URL
  const payerEmail = business.email ?? locals.session.user.email ?? ''

  try {
    const url = await createSubscriptionLink({
      planKey,
      businessId: business.id,
      payerEmail,
      backUrl: `${appUrl}/billing`,
    })

    return apiSuccess({ url })
  } catch (err) {
    console.error('MP change-plan error:', err)
    return apiError('Error al generar el link de pago', 500)
  }
}
