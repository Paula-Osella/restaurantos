import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api'

const updateSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'employee', 'cashier', 'cook']).optional(),
  branch_id: z.string().uuid().nullable().optional(),
  hourly_rate: z.number().nullable().optional(),
  hired_at: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('employees')
    .update(parsed.data)
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .select()
    .single()

  if (error || !data) return apiNotFound('Empleado no encontrado')
  return apiSuccess(data)
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  const { error } = await locals.supabase
    .from('employees')
    .update({ is_active: false })
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)

  if (error) return apiError('Error al desactivar empleado', 500)
  return apiSuccess({ deactivated: true })
}
