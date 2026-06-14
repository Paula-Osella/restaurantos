/**
 * POST /api/mercadopago/checkout
 *
 * Genera el init_point (URL de checkout de MP) para que el usuario
 * complete la suscripción al plan elegido.
 *
 * Body: { planKey: 'basic' | 'professional' | 'premium' }
 * Response: { url: string }
 */

import type { APIRoute } from 'astro'
import { z } from 'zod'
import { createSubscriptionLink } from '@/lib/mercadopago'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api'

const checkoutSchema = z.object({
  planKey: z.enum(['basic', 'professional', 'premium']),
})

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  if (locals.userRole !== 'admin') {
    return apiError('Solo administradores pueden gestionar suscripciones', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('planKey inválido. Debe ser: basic, professional o premium', 400)
  }

  const { planKey } = parsed.data

  const { data: business } = await locals.supabase
    .from('businesses')
    .select('id, name, email, mp_subscription_id')
    .eq('id', locals.businessId)
    .single()

  if (!business) return apiError('Empresa no encontrada', 404)

  // Si ya tiene suscripción activa, no crear otra
  if (business.mp_subscription_id) {
    return apiError(
      'Ya tenés una suscripción activa. Cancelala antes de cambiar de plan.',
      409
    )
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
    console.error('MP checkout error:', err)
    return apiError('Error al generar el link de pago. Intentá de nuevo.', 500)
  }
}
