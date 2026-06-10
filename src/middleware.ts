import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServerClient } from '@/lib/supabase'
import { canAccess, getUserProfile } from '@/lib/auth'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/pricing',
  '/api/mercadopago/webhook',
  '/api/auth',
]

const SUPERADMIN_ROUTES = ['/superadmin']
const PROTECTED_ROUTES = ['/dashboard', '/pos', '/kitchen', '/billing', '/onboarding', '/superadmin']

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

function isProtected(pathname: string): boolean {
  return PROTECTED_ROUTES.some((r) => pathname.startsWith(r))
}

function isSuperAdminRoute(pathname: string): boolean {
  return SUPERADMIN_ROUTES.some((r) => pathname.startsWith(r))
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { cookies, url, redirect, locals } = context

  const supabase = createSupabaseServerClient(cookies, context.request)
  locals.supabase = supabase

  const { data: { session } } = await supabase.auth.getSession()
  locals.session = session
  locals.user = session?.user ?? null

  if (!isProtected(url.pathname)) {
    return next()
  }

  if (!session) {
    const loginUrl = new URL('/login', url)
    loginUrl.searchParams.set('redirect', url.pathname)
    return redirect(loginUrl.toString())
  }

  const profile = await getUserProfile(supabase, session.user.id)

  if (!profile) {
    if (url.pathname === '/onboarding') return next()
    return redirect('/onboarding')
  }

  locals.businessId = profile.business_id
  locals.userRole = profile.role
  locals.businessStatus = profile.businesses?.status ?? null

  if (isSuperAdminRoute(url.pathname) && profile.role !== 'superadmin') {
    return redirect('/dashboard')
  }

  if (!isSuperAdminRoute(url.pathname) && url.pathname !== '/billing') {
    const businessStatus = profile.businesses?.status
    if (businessStatus === 'suspended') {
      return redirect('/billing?suspended=true')
    }
    if (businessStatus === 'cancelled') {
      return redirect('/billing?cancelled=true')
    }
  }

  if (profile.role !== 'superadmin' && !canAccess(profile.role, url.pathname)) {
    const { ROLE_HOME } = await import('@/lib/auth')
    return redirect(ROLE_HOME[profile.role])
  }

  return next()
})
