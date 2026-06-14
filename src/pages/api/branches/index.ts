import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'
import { checkPlanLimit, formatLimitMessage } from '@/lib/plan-limits'

const branchSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
})

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('branches')
    .select('*')
    .eq('business_id', locals.businessId)
    .order('created_at')

  if (error) return apiError('Error al obtener sucursales', 500)
  return apiSuccess(data ?? [])
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  const limitCheck = await checkPlanLimit(locals.supabase, locals.businessId, 'branches')
  if (!limitCheck.allowed) {
    return apiError(
      formatLimitMessage('branches', limitCheck.current, limitCheck.limit!, limitCheck.planName),
      403
    )
  }

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = branchSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('branches')
    .insert({ ...parsed.data, business_id: locals.businessId })
    .select()
    .single()

  if (error) return apiError('Error al crear sucursal', 500)
  return apiSuccess(data, 201)
}
