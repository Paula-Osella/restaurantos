-- =====================================================
-- Seed: Plans
-- =====================================================
INSERT INTO plans (name, description, price_monthly, price_annual, max_products, max_employees, max_branches, features, sort_order)
VALUES
  (
    'Básico',
    'Ideal para emprendimientos y negocios pequeños',
    29.00,
    290.00,
    50,
    2,
    1,
    '{"basic_reports": true, "pos": true, "kitchen_display": true, "inventory": false, "advanced_reports": false, "api_access": false}',
    1
  ),
  (
    'Profesional',
    'Para negocios en crecimiento con múltiples empleados',
    79.00,
    790.00,
    NULL,
    10,
    3,
    '{"basic_reports": true, "pos": true, "kitchen_display": true, "inventory": true, "advanced_reports": true, "api_access": false, "stock_alerts": true}',
    2
  ),
  (
    'Premium',
    'Para cadenas y franquicias con múltiples sucursales',
    149.00,
    1490.00,
    NULL,
    NULL,
    NULL,
    '{"basic_reports": true, "pos": true, "kitchen_display": true, "inventory": true, "advanced_reports": true, "api_access": true, "stock_alerts": true, "white_label": true, "priority_support": true, "multi_branch": true}',
    3
  );
