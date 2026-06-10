import type { APIRoute } from 'astro'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api'

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('plans')
    .select('id, name, description, price_monthly, price_annual, max_products, max_employees, max_branches, features')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return apiError('Error al obtener planes', 500)
  return apiSuccess(data ?? [])
}
