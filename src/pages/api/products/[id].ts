import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
  is_available: z.boolean().optional(),
  track_inventory: z.boolean().optional(),
  image_url: z.string().url().optional().nullable(),
})

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('products')
    .select('*, categories(id, name, color), inventory(*)')
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .single()

  if (error || !data) return apiNotFound('Producto no encontrado')
  return apiSuccess(data)
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase
    .from('products')
    .update(parsed.data)
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .select()
    .single()

  if (error || !data) return apiNotFound('Producto no encontrado')
  return apiSuccess(data)
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  const { error } = await locals.supabase
    .from('products')
    .delete()
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)

  if (error) return apiError('Error al eliminar producto', 500)
  return apiSuccess({ deleted: true })
}
