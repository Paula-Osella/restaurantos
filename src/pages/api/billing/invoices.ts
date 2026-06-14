import type { APIRoute } from 'astro'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'superadmin'].includes(locals.userRole ?? '')) return apiForbidden()

  const { data, error } = await locals.supabase
    .from('invoices')
    .select('*')
    .eq('business_id', locals.businessId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return apiError('Error al obtener facturas', 500)
  return apiSuccess(data ?? [])
}
