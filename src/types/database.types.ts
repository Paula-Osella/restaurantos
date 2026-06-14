export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'superadmin' | 'admin' | 'employee' | 'cashier' | 'cook'
export type BusinessStatus = 'active' | 'suspended' | 'cancelled' | 'trial'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'paused'

export interface Database {
  public: {
    Tables: {
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          mp_plan_id: string | null
          price_monthly: number
          price_annual: number
          max_products: number | null
          max_employees: number | null
          max_branches: number | null
          features: Json
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
      }
      businesses: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string
          plan_id: string | null
          status: BusinessStatus
          mp_subscription_id: string | null
          mp_payer_id: string | null
          subscription_status: SubscriptionStatus | null
          current_period_end: string | null
          next_payment_date: string | null
          trial_ends_at: string | null
          logo_url: string | null
          currency: string
          timezone: string
          address: string | null
          phone: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['businesses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['businesses']['Insert']>
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          business_id: string
          role: UserRole
          full_name: string
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      branches: {
        Row: {
          id: string
          business_id: string
          name: string
          address: string | null
          phone: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      categories: {
        Row: {
          id: string
          business_id: string
          name: string
          description: string | null
          color: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      products: {
        Row: {
          id: string
          business_id: string
          category_id: string | null
          name: string
          description: string | null
          price: number
          cost: number | null
          sku: string | null
          image_url: string | null
          is_available: boolean
          track_inventory: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      inventory: {
        Row: {
          id: string
          business_id: string
          product_id: string
          branch_id: string | null
          quantity: number
          low_stock_threshold: number | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      customers: {
        Row: {
          id: string
          business_id: string
          full_name: string
          email: string | null
          phone: string | null
          address: string | null
          notes: string | null
          total_orders: number
          total_spent: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'total_orders' | 'total_spent'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      orders: {
        Row: {
          id: string
          business_id: string
          branch_id: string | null
          customer_id: string | null
          cashier_id: string | null
          order_number: number
          status: OrderStatus
          payment_method: PaymentMethod | null
          subtotal: number
          tax: number
          discount: number
          total: number
          notes: string | null
          table_number: string | null
          is_delivery: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at' | 'order_number'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      employees: {
        Row: {
          id: string
          business_id: string
          user_id: string | null
          full_name: string
          email: string
          role: UserRole
          branch_id: string | null
          hourly_rate: number | null
          is_active: boolean
          hired_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          business_id: string
          mp_payment_id: string | null
          mp_payment_url: string | null
          amount: number
          currency: string
          status: 'paid' | 'open' | 'void'
          description: string | null
          period_start: string | null
          period_end: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      settings: {
        Row: {
          id: string
          business_id: string
          key: string
          value: Json
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['settings']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_business_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<string, never>
        Returns: UserRole
      }
      is_superadmin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Plan = Tables<'plans'>
export type Business = Tables<'businesses'>
export type UserProfile = Tables<'user_profiles'>
export type Branch = Tables<'branches'>
export type Category = Tables<'categories'>
export type Product = Tables<'products'>
export type Inventory = Tables<'inventory'>
export type Customer = Tables<'customers'>
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type Employee = Tables<'employees'>
export type Invoice = Tables<'invoices'>
