import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  price_monthly: z.number().min(0).optional(),
  price_annual: z.number().min(0).optional(),
  max_products: z.number().int().positive().nullable().optional(),
  max_employees: z.number().int().positive().nullable().optional(),
  max_branches: z.number().int().positive().nullable().optional(),
  mp_plan_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  features: z.record(z.boolean()).optional(),
})

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session) return apiUnauthorized()
  if (locals.userRole !== 'superadmin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('plans')
    .update(parsed.data)
    .eq('id', params.id!)
    .select()
    .single()

  if (error || !data) return apiNotFound('Plan no encontrado')
  return apiSuccess(data)
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.session) return apiUnauthorized()
  if (locals.userRole !== 'superadmin') return apiForbidden()

  const { error } = await locals.supabase
    .from('plans')
    .update({ is_active: false })
    .eq('id', params.id!)

  if (error) return apiError('Error al desactivar plan', 500)
  return apiSuccess({ deactivated: true })
}
