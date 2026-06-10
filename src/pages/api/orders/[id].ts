import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api'
import type { UserRole, OrderStatus } from '@/types/database.types'

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
}

const ROLE_STATUS_PERMISSIONS: Record<UserRole, OrderStatus[]> = {
  superadmin: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
  admin: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
  employee: ['confirmed', 'preparing', 'ready', 'cancelled'],
  cashier: ['confirmed', 'cancelled', 'delivered'],
  cook: ['preparing', 'ready'],
}

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']).optional(),
})

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const { data, error } = await locals.supabase
    .from('orders')
    .select(`
      *,
      customers(id, full_name, phone, email),
      branches(id, name),
      order_items(*, products(id, name, price, image_url))
    `)
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .single()

  if (error || !data) return apiNotFound('Pedido no encontrado')
  return apiSuccess(data)
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400)

  const { status: newStatus, payment_method } = parsed.data
  const userRole = locals.userRole!

  // Check role permission for this status
  const allowedForRole = ROLE_STATUS_PERMISSIONS[userRole] ?? []
  if (!allowedForRole.includes(newStatus)) {
    return apiForbidden(`Tu rol no puede establecer el estado "${newStatus}"`)
  }

  // Get current order
  const { data: order } = await locals.supabase
    .from('orders')
    .select('status')
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .single()

  if (!order) return apiNotFound()

  // Validate transition
  const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? []
  if (!allowed.includes(newStatus)) {
    return apiError(`No se puede cambiar de "${order.status}" a "${newStatus}"`, 400)
  }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (payment_method) updateData.payment_method = payment_method

  const { data: updated, error } = await locals.supabase
    .from('orders')
    .update(updateData)
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)
    .select()
    .single()

  if (error || !updated) return apiError('Error al actualizar pedido', 500)
  return apiSuccess(updated)
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (locals.userRole !== 'admin') return apiForbidden()

  const { error } = await locals.supabase
    .from('orders')
    .delete()
    .eq('id', params.id!)
    .eq('business_id', locals.businessId)

  if (error) return apiError('Error al eliminar pedido', 500)
  return apiSuccess({ deleted: true })
}
