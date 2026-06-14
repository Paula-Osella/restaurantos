/**
 * POST /api/mercadopago/cancel
 *
 * Cancela la suscripción activa del negocio.
 * Solo el admin puede hacerlo.
 */

import type { APIRoute } from 'astro'
import { cancelSubscription } from '@/lib/mercadopago'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api'

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  if (locals.userRole !== 'admin') {
    return apiError('Solo administradores pueden cancelar suscripciones', 403)
  }

  const { data: business } = await locals.supabase
    .from('businesses')
    .select('id, mp_subscription_id, status')
    .eq('id', locals.businessId)
    .single()

  if (!business) return apiError('Empresa no encontrada', 404)

  if (!business.mp_subscription_id) {
    return apiError('No hay suscripción activa para cancelar', 400)
  }

  try {
    await cancelSubscription(business.mp_subscription_id)

    // El webhook de MP actualizará el estado automáticamente,
    // pero actualizamos de forma optimista igual para UX instantánea.
    await locals.supabase
      .from('businesses')
      .update({
        subscription_status: 'cancelled',
        status: 'cancelled',
        mp_subscription_id: null,
      })
      .eq('id', locals.businessId)

    return apiSuccess({ cancelled: true })
  } catch (err) {
    console.error('MP cancel error:', err)
    return apiError('Error al cancelar la suscripción. Intentá de nuevo.', 500)
  }
}
