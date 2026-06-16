import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError } from '@/lib/api'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getUserProfile, ROLE_HOME } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return apiError('Email o contraseña inválidos', 400)

  const supabase = createSupabaseServerClient(cookies, request)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.session) {
    console.error('Login error:', JSON.stringify(error))
    return apiError('Credenciales incorrectas. Verificá tu email y contraseña.', 401)
  }

  const profile = await getUserProfile(supabase, data.user.id)
  const redirectTo = profile ? ROLE_HOME[profile.role] : '/restaurantos/dashboard'

  return apiSuccess({ user: data.user?.id, redirectTo })
}