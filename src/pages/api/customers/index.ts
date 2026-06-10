import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, paginate } from '@/lib/api'

const customerSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const page = parseInt(url.searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '25'), 100)
  const search = url.searchParams.get('q') ?? ''

  let query = locals.supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('business_id', locals.businessId)
    .order('total_spent', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return apiError('Error al obtener clientes', 500)
  return apiSuccess(paginate(data ?? [], count ?? 0, page, pageSize))
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'employee', 'cashier'].includes(locals.userRole ?? '')) return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = customerSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('customers')
    .insert({ ...parsed.data, business_id: locals.businessId })
    .select()
    .single()

  if (error) return apiError('Error al crear cliente', 500)
  return apiSuccess(data, 201)
}
