import type { APIRoute } from 'astro'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api'

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session || !locals.businessId) return apiUnauthorized()
  if (!['admin', 'superadmin'].includes(locals.userRole ?? '')) return apiForbidden()

  const type = url.searchParams.get('type') ?? 'summary'
  const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const to = url.searchParams.get('to') ?? new Date().toISOString()
  const businessId = locals.businessId

  try {
    if (type === 'summary') {
      const [
        { data: ordersData },
        { data: topProducts },
        { data: recentOrders },
      ] = await Promise.all([
        locals.supabase
          .from('orders')
          .select('total, status, created_at')
          .eq('business_id', businessId)
          .gte('created_at', from)
          .lte('created_at', to),

        locals.supabase
          .from('order_items')
          .select('product_id, quantity, subtotal, products(name)')
          .eq('orders.business_id', businessId)
          .gte('orders.created_at', from)
          .lte('orders.created_at', to)
          .limit(10),

        locals.supabase
          .from('orders')
          .select('id, order_number, total, status, created_at, customers(full_name)')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      const orders = ordersData ?? []
      const delivered = orders.filter((o) => o.status === 'delivered')
      const totalRevenue = delivered.reduce((sum, o) => sum + o.total, 0)
      const totalOrders = orders.length
      const avgOrderValue = delivered.length > 0 ? totalRevenue / delivered.length : 0

      const daily: Record<string, number> = {}
      delivered.forEach((o) => {
        const date = o.created_at.split('T')[0]
        daily[date] = (daily[date] ?? 0) + o.total
      })

      const dailyRevenue = Object.entries(daily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue }))

      return apiSuccess({
        totalRevenue,
        totalOrders,
        avgOrderValue,
        cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
        dailyRevenue,
        recentOrders: recentOrders ?? [],
      })
    }

    if (type === 'products') {
      const { data } = await locals.supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          subtotal,
          products(id, name, price),
          orders!inner(business_id, status, created_at)
        `)
        .eq('orders.business_id', businessId)
        .eq('orders.status', 'delivered')
        .gte('orders.created_at', from)
        .lte('orders.created_at', to)

      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
      ;(data ?? []).forEach((item) => {
        const pid = item.product_id
        const existing = productMap.get(pid) ?? {
          name: (item.products as any)?.name ?? 'Desconocido',
          quantity: 0,
          revenue: 0,
        }
        existing.quantity += item.quantity
        existing.revenue += item.subtotal
        productMap.set(pid, existing)
      })

      const topProducts = Array.from(productMap.entries())
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20)

      return apiSuccess({ topProducts })
    }

    return apiError('Tipo de reporte no válido', 400)
  } catch (err) {
    console.error('Reports error:', err)
    return apiError('Error al generar reporte', 500)
  }
}
