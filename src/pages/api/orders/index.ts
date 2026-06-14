import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, paginate } from '@/lib/api'

const orderItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  notes: z.string().optional().nullable(),
})

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  customer_id: z.string().uuid().optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']).optional().nullable(),
  notes: z.string().optional().nullable(),
  table_number: z.string().optional().nullable(),
  is_delivery: z.boolean().default(false),
  discount: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(1).default(0),
})

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const page = parseInt(url.searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '25'), 100)
  const status = url.searchParams.get('status')
  const branchId = url.searchParams.get('branch')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = locals.supabase
    .from('orders')
    .select(`
      *,
      customers(id, full_name, phone),
      branches(id, name),
      order_items(*, products(id, name, price))
    `, { count: 'exact' })
    .eq('business_id', locals.businessId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) query = query.eq('status', status)
  if (branchId) query = query.eq('branch_id', branchId)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  // Cooks only see active orders
  if (locals.userRole === 'cook') {
    query = query.in('status', ['confirmed', 'preparing'])
  }

  const { data, error, count } = await query

  if (error) return apiError('Error al obtener pedidos', 500)
  return apiSuccess(paginate(data ?? [], count ?? 0, page, pageSize))
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()

  const allowedRoles = ['admin', 'employee', 'cashier']
  if (!allowedRoles.includes(locals.userRole ?? '')) return apiForbidden()

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { items, tax_rate, discount, ...orderData } = parsed.data

  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const tax = subtotal * tax_rate
  const total = subtotal + tax - discount

  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .insert({
      ...orderData,
      business_id: locals.businessId,
      cashier_id: locals.session.user.id,
      subtotal,
      tax,
      discount,
      total,
      status: 'confirmed',
    })
    .select()
    .single()

  if (orderError || !order) return apiError('Error al crear pedido', 500)

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.unit_price * item.quantity,
    notes: item.notes ?? null,
  }))

  const { error: itemsError } = await locals.supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    // Rollback order if items failed
    await locals.supabase.from('orders').delete().eq('id', order.id)
    return apiError('Error al guardar items del pedido', 500)
  }

  const { data: fullOrder } = await locals.supabase
    .from('orders')
    .select('*, order_items(*, products(id, name)), customers(id, full_name)')
    .eq('id', order.id)
    .single()

  return apiSuccess(fullOrder, 201)
}
