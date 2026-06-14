import type { APIRoute } from 'astro'
import { z } from 'zod'
import { checkPlanLimit, formatLimitMessage } from '@/lib/plan-limits'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, paginate } from '@/lib/api'

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).optional(),
  category_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
  is_available: z.boolean().default(true),
  track_inventory: z.boolean().default(false),
})

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const page = parseInt(url.searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '50'), 100)
  const search = url.searchParams.get('q') ?? ''
  const categoryId = url.searchParams.get('category')
  const available = url.searchParams.get('available')

  let query = locals.supabase
    .from('products')
    .select('*, categories(id, name, color)', { count: 'exact' })
    .eq('business_id', locals.businessId)
    .order('name')
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) query = query.ilike('name', `%${search}%`)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (available === 'true') query = query.eq('is_available', true)

  const { data, error, count } = await query

  if (error) return apiError('Error al obtener productos', 500)

  return apiSuccess(paginate(data ?? [], count ?? 0, page, pageSize))
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  const limitCheck = await checkPlanLimit(locals.supabase, locals.businessId, 'products')
  if (!limitCheck.allowed) {
    return apiError(
      formatLimitMessage('products', limitCheck.current, limitCheck.limit!, limitCheck.planName),
      403
    )
  }

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = productSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('products')
    .insert({ ...parsed.data, business_id: locals.businessId })
    .select()
    .single()

  if (error) return apiError('Error al crear producto', 500)

  return apiSuccess(data, 201)
}
