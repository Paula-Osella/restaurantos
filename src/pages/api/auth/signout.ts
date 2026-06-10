import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '@/lib/supabase'

export const GET: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createSupabaseServerClient(cookies, request)
  await supabase.auth.signOut()
  return redirect('/login')
}