import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Resource = 'products' | 'employees' | 'branches'

interface PlanLimitResult {
  allowed: boolean
  current: number
  limit: number | null
  planName: string
}

export async function checkPlanLimit(
  supabase: SupabaseClient<Database>,
  businessId: string,
  resource: Resource
): Promise<PlanLimitResult> {
  const { data: business } = await supabase
    .from('businesses')
    .select('plans(name, max_products, max_employees, max_branches)')
    .eq('id', businessId)
    .single()

  if (!business?.plans) {
    return { allowed: false, current: 0, limit: 0, planName: 'unknown' }
  }

  const plan = business.plans as {
    name: string
    max_products: number | null
    max_employees: number | null
    max_branches: number | null
  }

  const limitMap: Record<Resource, number | null> = {
    products: plan.max_products,
    employees: plan.max_employees,
    branches: plan.max_branches,
  }

  const limit = limitMap[resource]

  if (limit === null) {
    return { allowed: true, current: 0, limit: null, planName: plan.name }
  }

  const tableMap: Record<Resource, string> = {
    products: 'products',
    employees: 'employees',
    branches: 'branches',
  }

  const { count } = await supabase
    .from(tableMap[resource])
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId)

  const current = count ?? 0
  return { allowed: current < limit, current, limit, planName: plan.name }
}

export async function getBusinessPlanFeatures(
  supabase: SupabaseClient<Database>,
  businessId: string
) {
  const { data } = await supabase
    .from('businesses')
    .select('plans(name, features, max_products, max_employees, max_branches)')
    .eq('id', businessId)
    .single()

  return data?.plans ?? null
}

export function formatLimitMessage(resource: Resource, current: number, limit: number, planName: string) {
  const resourceLabels: Record<Resource, string> = {
    products: 'productos',
    employees: 'empleados',
    branches: 'sucursales',
  }

  return `Tu plan ${planName} permite hasta ${limit} ${resourceLabels[resource]}. Actualmente tienes ${current}. Actualiza tu plan para continuar.`
}
