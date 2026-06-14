import type { UserRole, BusinessStatus } from './database.types'

declare global {
  namespace App {
    interface Locals {
      supabase: import('@supabase/supabase-js').SupabaseClient<import('./database.types').Database>
      session: import('@supabase/supabase-js').Session | null
      user: import('@supabase/supabase-js').User | null
      businessId: string | null
      userRole: UserRole | null
      businessStatus: BusinessStatus | null
    }
  }
}

export {}
