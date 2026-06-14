import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

const adjustSchema = z.object({
  product_id: z.string().uuid(),
  branch_id: z.string().uuid().optional().nullable(),
  quantity: z.number(),
  low_stock_threshold: z.number().min(0).optional().nullable(),
  operation: z.enum(['set', 'add', 'subtract']).default('set'),
})

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'employee'].includes(locals.userRole ?? '')) return apiForbidden()

  const lowStock = url.searchParams.get('low_stock') === 'true'
  const branchId = url.searchParams.get('branch')

  let query = locals.supabase
    .from('inventory')
    .select('*, products(id, name, sku, price), branches(id, name)')
    .eq('business_id', locals.businessId)
    .order('updated_at', { ascending: false })

  if (branchId) query = query.eq('branch_id', branchId)
  if (lowStock) {
    query = query.not('low_stock_threshold', 'is', null)
  }

  const { data, error } = await query
  if (error) return apiError('Error al obtener inventario', 500)

  let result = data ?? []
  if (lowStock) {
    result = result.filter(
      (item) => item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold
    )
  }

  return apiSuccess(result)
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'employee'].includes(locals.userRole ?? '')) return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = adjustSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { product_id, branch_id, quantity, low_stock_threshold, operation } = parsed.data

  // Get current inventory
  const { data: current } = await locals.supabase
    .from('inventory')
    .select('id, quantity')
    .eq('business_id', locals.businessId)
    .eq('product_id', product_id)
    .eq('branch_id', branch_id ?? null)
    .single()

  let newQuantity: number
  if (operation === 'set') {
    newQuantity = quantity
  } else if (operation === 'add') {
    newQuantity = (current?.quantity ?? 0) + quantity
  } else {
    newQuantity = Math.max(0, (current?.quantity ?? 0) - quantity)
  }

  const { data, error } = await locals.supabase
    .from('inventory')
    .upsert(
      {
        business_id: locals.businessId,
        product_id,
        branch_id: branch_id ?? null,
        quantity: newQuantity,
        low_stock_threshold: low_stock_threshold ?? null,
      },
      { onConflict: 'product_id,branch_id' }
    )
    .select()
    .single()

  if (error) return apiError('Error al actualizar inventario', 500)
  return apiSuccess(data)
}
