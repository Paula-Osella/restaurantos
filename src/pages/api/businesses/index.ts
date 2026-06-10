import type { APIRoute } from 'astro'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, paginate } from '@/lib/api'

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.session) return apiUnauthorized()
  if (locals.userRole !== 'superadmin') return apiForbidden()

  const page = parseInt(url.searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '25'), 100)
  const status = url.searchParams.get('status')
  const search = url.searchParams.get('q') ?? ''

  let query = locals.supabase
    .from('businesses')
    .select('*, plans(id, name, price_monthly)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query
  if (error) return apiError('Error al obtener empresas', 500)
  return apiSuccess(paginate(data ?? [], count ?? 0, page, pageSize))
}
