import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
})

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('categories')
    .select('*')
    .eq('business_id', locals.businessId)
    .order('sort_order')

  if (error) return apiError('Error al obtener categorías', 500)
  return apiSuccess(data ?? [])
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('categories')
    .insert({ ...parsed.data, business_id: locals.businessId })
    .select()
    .single()

  if (error) return apiError('Error al crear categoría', 500)
  return apiSuccess(data, 201)
}
