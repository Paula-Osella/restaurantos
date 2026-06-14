import type { APIRoute } from 'astro'
import { z } from 'zod'
import { checkPlanLimit, formatLimitMessage } from '@/lib/plan-limits'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

const employeeSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email(),
  role: z.enum(['admin', 'employee', 'cashier', 'cook']),
  branch_id: z.string().uuid().optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  hired_at: z.string().optional().nullable(),
})

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'superadmin'].includes(locals.userRole ?? '')) return apiForbidden()

  const active = url.searchParams.get('active')

  let query = locals.supabase
    .from('employees')
    .select('*, branches(id, name)')
    .eq('business_id', locals.businessId)
    .order('full_name')

  if (active === 'true') query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return apiError('Error al obtener empleados', 500)
  return apiSuccess(data ?? [])
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  const limitCheck = await checkPlanLimit(locals.supabase, locals.businessId, 'employees')
  if (!limitCheck.allowed) {
    return apiError(
      formatLimitMessage('employees', limitCheck.current, limitCheck.limit!, limitCheck.planName),
      403
    )
  }

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = employeeSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  // Check if employee email already exists for this business
  const { data: existing } = await locals.supabase
    .from('employees')
    .select('id')
    .eq('business_id', locals.businessId)
    .eq('email', parsed.data.email)
    .single()

  if (existing) return apiError('Ya existe un empleado con ese email', 409)

  const { data, error } = await locals.supabase
    .from('employees')
    .insert({ ...parsed.data, business_id: locals.businessId })
    .select()
    .single()

  if (error) return apiError('Error al crear empleado', 500)

  // TODO: Send invitation email via Supabase Auth
  // await supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
  //   data: { business_id: locals.businessId, role: parsed.data.role }
  // })

  return apiSuccess(data, 201)
}
