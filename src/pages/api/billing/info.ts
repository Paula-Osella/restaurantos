/**
 * GET /api/billing/info
 * Devuelve estado de suscripción del negocio actual.
 */

import type { APIRoute } from 'astro'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'superadmin'].includes(locals.userRole ?? '')) return apiForbidden()

  const { data, error } = await locals.supabase
    .from('businesses')
    .select(`
      status,
      subscription_status,
      mp_subscription_id,
      next_payment_date,
      trial_ends_at,
      plans(id, name, price_monthly, price_annual, max_products, max_employees, max_branches, features)
    `)
    .eq('id', locals.businessId)
    .single()

  if (error || !data) return apiError('Error al obtener información de facturación', 500)

  return apiSuccess({
    status: data.status,
    subscription_status: data.subscription_status,
    mp_subscription_id: data.mp_subscription_id,
    next_payment_date: data.next_payment_date,
    trial_ends_at: data.trial_ends_at,
    plan: data.plans,
  })
}
