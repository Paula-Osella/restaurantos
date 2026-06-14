import { createServerClient, createBrowserClient, parseCookieHeader } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { AstroCookies } from 'astro'
import type { Database } from '@/types/database.types'

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string

export function createSupabaseServerClient(cookies: AstroCookies, request?: Request) {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request?.headers.get('cookie') ?? cookies.toString() ?? '')
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options as any)
        })
      },
    },
  })
}

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export function createSupabaseAdminClient() {
  return createClient<Database>(
    SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}