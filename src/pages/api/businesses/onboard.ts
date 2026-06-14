import type { APIRoute } from 'astro'
import { z } from 'zod'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api'

const onboardingSchema = z.object({
  businessName: z.string().min(2).max(100),
  currency: z.string().length(3).default('ARS'),
  timezone: z.string().default('America/Argentina/Buenos_Aires'),
  phone: z.string().optional(),
  address: z.string().optional(),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.session) return apiUnauthorized()

  // Check if user already has a business
  const { data: existing } = await locals.supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', locals.session.user.id)
    .single()

  if (existing) {
    return apiError('Ya tienes un negocio registrado', 409)
  }

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }

  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) return apiError('Datos inválidos', 400, parsed.error.flatten())

  const { businessName, currency, timezone, phone, address } = parsed.data

  // Generate unique slug
  let slug = slugify(businessName)
  let attempt = 0

  while (true) {
    const candidateSlug = attempt === 0 ? slug : `${slug}-${attempt}`
    const { data: slugExists } = await locals.supabase
      .from('businesses')
      .select('id')
      .eq('slug', candidateSlug)
      .single()

    if (!slugExists) {
      slug = candidateSlug
      break
    }
    attempt++
    if (attempt > 10) {
      slug = `${slug}-${Date.now()}`
      break
    }
  }

  // Get basic plan for trial
  const { data: basicPlan } = await locals.supabase
    .from('plans')
    .select('id')
    .eq('name', 'Básico')
    .single()

  // Create business
  const { data: business, error: bizError } = await locals.supabase
    .from('businesses')
    .insert({
      name: businessName,
      slug,
      owner_id: locals.session.user.id,
      plan_id: basicPlan?.id ?? null,
      status: 'trial',
      currency,
      timezone,
      phone: phone ?? null,
      address: address ?? null,
      email: locals.session.user.email ?? null,
    })
    .select()
    .single()

  if (bizError || !business) {
    console.error('Business creation error:', bizError)
    return apiError('Error al crear el negocio', 500)
  }

  // Create user profile as admin
  const { error: profileError } = await locals.supabase
    .from('user_profiles')
    .insert({
      user_id: locals.session.user.id,
      business_id: business.id,
      role: 'admin',
      full_name: locals.session.user.user_metadata?.full_name ?? businessName,
    })

  if (profileError) {
    console.error('Profile creation error:', profileError)
    await locals.supabase.from('businesses').delete().eq('id', business.id)
    return apiError('Error al crear perfil de usuario', 500)
  }

  // Create default branch
  await locals.supabase.from('branches').insert({
    business_id: business.id,
    name: 'Principal',
    is_active: true,
  })

  // Create default categories
  const defaultCategories = [
    { name: 'Hamburguesas', color: '#ef4444', sort_order: 1 },
    { name: 'Bebidas', color: '#3b82f6', sort_order: 2 },
    { name: 'Acompañamientos', color: '#f59e0b', sort_order: 3 },
    { name: 'Postres', color: '#ec4899', sort_order: 4 },
  ]

  await locals.supabase.from('categories').insert(
    defaultCategories.map((c) => ({ ...c, business_id: business.id }))
  )

  return apiSuccess({ businessId: business.id, slug }, 201)
}
