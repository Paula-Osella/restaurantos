import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, UserRole } from '@/types/database.types'

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  superadmin: ['/superadmin', '/restaurantos/dashboard', '/pos', '/kitchen'],
  admin: ['/restaurantos/dashboard', '/pos', '/kitchen'],
  employee: ['/restaurantos/dashboard/orders', '/pos', '/kitchen'],
  cashier: ['/pos'],
  cook: ['/kitchen'],
}

export const ROLE_HOME: Record<UserRole, string> = {
  superadmin: '/superadmin',
  admin: '/restaurantos/dashboard',
  employee: '/restaurantos/dashboard/orders',
  cashier: '/pos',
  cook: '/kitchen',
}

export function canAccess(role: UserRole, path: string): boolean {
  const allowedPaths = ROLE_ROUTES[role] ?? []
  return allowedPaths.some((allowed) => path.startsWith(allowed))
}

export async function getUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data } = await supabase
    .from('user_profiles')
    .select('*, businesses(id, name, slug, status, plan_id, subscription_status)')
    .eq('user_id', userId)
    .single()

  return data
}

export async function requireRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const profile = await getUserProfile(supabase, userId)
  if (!profile) return false
  return requiredRoles.includes(profile.role)
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin' || role === 'superadmin'
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'superadmin'
}