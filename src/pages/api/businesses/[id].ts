import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api'

const updateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  logo_url: z.string().url().optional().nullable(),
})

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin' && locals.userRole !== 'superadmin') return apiForbidden()
  if (params.id !== locals.businessId && locals.userRole !== 'superadmin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = updateSettingsSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('businesses')
    .update(parsed.data)
    .eq('id', params.id!)
    .select()
    .single()

  if (error || !data) return apiNotFound('Empresa no encontrada')
  return apiSuccess(data)
}

const actionSchema = z.object({
  action: z.enum(['suspend', 'activate', 'cancel']),
  reason: z.string().optional(),
})

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.session) return apiUnauthorized()
  if (locals.userRole !== 'superadmin') return apiForbidden()

  const { data, error } = await locals.supabase
    .from('businesses')
    .select(`
      *,
      plans(id, name, price_monthly),
      user_profiles(id, full_name, email, role)
    `)
    .eq('id', params.id!)
    .single()

  if (error || !data) return apiNotFound()
  return apiSuccess(data)
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session) return apiUnauthorized()
  if (locals.userRole !== 'superadmin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400)

  const statusMap = {
    suspend: 'suspended',
    activate: 'active',
    cancel: 'cancelled',
  } as const

  const { data, error } = await locals.supabase
    .from('businesses')
    .update({ status: statusMap[parsed.data.action] })
    .eq('id', params.id!)
    .select()
    .single()

  if (error || !data) return apiNotFound()
  return apiSuccess(data)
}
