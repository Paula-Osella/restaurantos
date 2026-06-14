import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api'

const updateSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('customers')
    .select('*')
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .single()

  if (error || !data) return apiNotFound()
  return apiSuccess(data)
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'employee', 'cashier'].includes(locals.userRole ?? '')) return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('customers')
    .update(parsed.data)
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .select()
    .single()

  if (error || !data) return apiNotFound()
  return apiSuccess(data)
}
