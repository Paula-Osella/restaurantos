import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

const planSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  price_monthly: z.number().min(0),
  price_annual: z.number().min(0),
  max_products: z.number().int().positive().nullable().optional(),
  max_employees: z.number().int().positive().nullable().optional(),
  max_branches: z.number().int().positive().nullable().optional(),
  mp_plan_id: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  features: z.record(z.boolean()).default({}),
})

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('plans')
    .select('*')
    .order('sort_order')

  if (error) return apiError('Error al obtener planes', 500)
  return apiSuccess(data ?? [])
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session) return apiUnauthorized()
  if (locals.userRole !== 'superadmin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = planSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('plans')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return apiError('Error al crear plan', 500)
  return apiSuccess(data, 201)
}
