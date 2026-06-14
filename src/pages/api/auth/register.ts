import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError } from '@/lib/api'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
})

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { data, error } = await locals.supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  })

  if (error) {
    console.error('Supabase error:', JSON.stringify(error))  // ← acá
    if (error.message.includes('already registered')) {
      return apiError('Ya existe una cuenta con ese email.', 409)
    }
    return apiError('Error al crear la cuenta. Intentá de nuevo.', 500)
  }

  return apiSuccess({ userId: data.user?.id }, 201)
}