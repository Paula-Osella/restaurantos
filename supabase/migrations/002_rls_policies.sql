-- =====================================================
-- RestaurantOS SaaS - Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PLANS POLICIES (public read)
-- =====================================================
CREATE POLICY "plans_public_read"
  ON plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "plans_superadmin_all"
  ON plans FOR ALL
  USING (is_superadmin());

-- =====================================================
-- BUSINESSES POLICIES
-- =====================================================
CREATE POLICY "businesses_owner_read"
  ON businesses FOR SELECT
  USING (
    owner_id = auth.uid()
    OR get_user_business_id() = id
    OR is_superadmin()
  );

CREATE POLICY "businesses_owner_update"
  ON businesses FOR UPDATE
  USING (
    (owner_id = auth.uid() AND get_user_role() = 'admin')
    OR is_superadmin()
  );

CREATE POLICY "businesses_insert"
  ON businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "businesses_superadmin_all"
  ON businesses FOR ALL
  USING (is_superadmin());

-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================
CREATE POLICY "profiles_own_read"
  ON user_profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR get_user_business_id() = business_id
    OR is_superadmin()
  );

CREATE POLICY "profiles_own_update"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid() OR is_superadmin());

CREATE POLICY "profiles_admin_manage"
  ON user_profiles FOR ALL
  USING (
    (get_user_business_id() = business_id AND get_user_role() = 'admin')
    OR is_superadmin()
  );

CREATE POLICY "profiles_insert"
  ON user_profiles FOR INSERT
  WITH CHECK (
    get_user_business_id() = business_id
    OR is_superadmin()
  );

-- =====================================================
-- BRANCHES POLICIES
-- =====================================================
CREATE POLICY "branches_business_read"
  ON branches FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "branches_admin_manage"
  ON branches FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() IN ('admin'))
    OR is_superadmin()
  );

-- =====================================================
-- CATEGORIES POLICIES
-- =====================================================
CREATE POLICY "categories_business_read"
  ON categories FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "categories_admin_manage"
  ON categories FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() IN ('admin'))
    OR is_superadmin()
  );

-- =====================================================
-- PRODUCTS POLICIES
-- =====================================================
CREATE POLICY "products_business_read"
  ON products FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "products_admin_manage"
  ON products FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() IN ('admin'))
    OR is_superadmin()
  );

-- =====================================================
-- INVENTORY POLICIES
-- =====================================================
CREATE POLICY "inventory_business_read"
  ON inventory FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "inventory_admin_manage"
  ON inventory FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() IN ('admin', 'employee'))
    OR is_superadmin()
  );

-- =====================================================
-- CUSTOMERS POLICIES
-- =====================================================
CREATE POLICY "customers_business_read"
  ON customers FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "customers_staff_manage"
  ON customers FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() IN ('admin', 'employee', 'cashier'))
    OR is_superadmin()
  );

-- =====================================================
-- ORDERS POLICIES
-- =====================================================
CREATE POLICY "orders_business_read"
  ON orders FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "orders_staff_insert"
  ON orders FOR INSERT
  WITH CHECK (
    business_id = get_user_business_id()
    AND get_user_role() IN ('admin', 'employee', 'cashier')
  );

CREATE POLICY "orders_staff_update"
  ON orders FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND get_user_role() IN ('admin', 'employee', 'cashier', 'cook')
  );

CREATE POLICY "orders_admin_delete"
  ON orders FOR DELETE
  USING (
    (business_id = get_user_business_id() AND get_user_role() = 'admin')
    OR is_superadmin()
  );

-- =====================================================
-- ORDER ITEMS POLICIES
-- =====================================================
CREATE POLICY "order_items_business_read"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.business_id = get_user_business_id()
    )
    OR is_superadmin()
  );

CREATE POLICY "order_items_staff_manage"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.business_id = get_user_business_id()
        AND get_user_role() IN ('admin', 'employee', 'cashier')
    )
    OR is_superadmin()
  );

-- =====================================================
-- EMPLOYEES POLICIES
-- =====================================================
CREATE POLICY "employees_own_read"
  ON employees FOR SELECT
  USING (
    (business_id = get_user_business_id())
    OR is_superadmin()
  );

CREATE POLICY "employees_admin_manage"
  ON employees FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() = 'admin')
    OR is_superadmin()
  );

-- =====================================================
-- INVOICES POLICIES
-- =====================================================
CREATE POLICY "invoices_business_read"
  ON invoices FOR SELECT
  USING (
    (business_id = get_user_business_id() AND get_user_role() IN ('admin'))
    OR is_superadmin()
  );

CREATE POLICY "invoices_system_insert"
  ON invoices FOR INSERT
  WITH CHECK (is_superadmin());

-- =====================================================
-- SETTINGS POLICIES
-- =====================================================
CREATE POLICY "settings_business_read"
  ON settings FOR SELECT
  USING (business_id = get_user_business_id() OR is_superadmin());

CREATE POLICY "settings_admin_manage"
  ON settings FOR ALL
  USING (
    (business_id = get_user_business_id() AND get_user_role() = 'admin')
    OR is_superadmin()
  );
