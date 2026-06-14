# RestaurantOS — SaaS Multi-Tenant para Restaurantes

Plataforma SaaS completa para hamburgueserías, restaurantes y franquicias. Construida con Astro, Supabase y Mercado Pago.

---

## Stack tecnológico

| Capa        | Tecnología                              |
|-------------|-----------------------------------------|
| Frontend    | Astro 4 (SSR) + React 18 Islands        |
| Estilos     | Tailwind CSS 4                          |
| Base de datos | Supabase (PostgreSQL + RLS)           |
| Auth        | Supabase Auth                           |
| Pagos       | Mercado Pago (Preapproval / Suscripciones) |
| Tipado      | TypeScript 5 estricto                   |
| Deploy      | Vercel (Edge) + Supabase Cloud          |

---

## Estructura del proyecto

```
src/
├── middleware.ts              ← Auth + business_id injection
├── layouts/
│   ├── Base.astro
│   ├── Dashboard.astro        ← Layout con sidebar
│   └── SuperAdmin.astro       ← Layout panel SA
├── pages/
│   ├── index.astro            ← Landing page
│   ├── login.astro
│   ├── register.astro
│   ├── onboarding.astro
│   ├── pos.astro              ← Punto de venta
│   ├── kitchen.astro          ← Pantalla de cocina (realtime)
│   ├── billing/
│   ├── dashboard/
│   │   ├── index.astro        ← Dashboard principal
│   │   ├── orders/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── customers/
│   │   ├── employees/
│   │   ├── reports/
│   │   └── settings/
│   ├── superadmin/
│   │   ├── index.astro        ← Panel global
│   │   ├── businesses/
│   │   └── plans/
│   └── api/
│       ├── auth/              ← login, register, signout
│       ├── businesses/        ← CRUD + onboard
│       ├── products/          ← CRUD + plan limits
│       ├── orders/            ← CRUD + status machine
│       ├── customers/
│       ├── employees/
│       ├── inventory/
│       ├── categories/
│       ├── branches/
│       ├── reports/
│       ├── plans/             ← Solo superadmin
│       ├── billing/           ← info, plans, invoices
│       └── mercadopago/       ← checkout, webhook, cancel, change-plan
├── components/
│   └── billing/
│       └── BillingPage.tsx    ← Página de facturación (React)
├── lib/
│   ├── supabase.ts
│   ├── mercadopago.ts         ← Cliente MP + helpers
│   ├── plan-limits.ts         ← Validación de límites
│   ├── auth.ts                ← Roles y helpers
│   └── api.ts                 ← Respuestas API estandarizadas
├── types/
│   ├── database.types.ts      ← Tipos generados de Supabase
│   └── app.d.ts               ← Locals de Astro
└── styles/
    └── global.css
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   └── 003_mercadopago.sql
└── seed/
    └── 001_plans.sql
```

---

## Setup inicial

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/restaurantos.git
cd restaurantos
npm install
cp .env.example .env
```

### 2. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Copiar `Project URL` y `anon key` al `.env`
3. Copiar `service_role key` al `.env`
4. Ejecutar las migraciones en orden:

```bash
# En el SQL Editor de Supabase, ejecutar:
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_mercadopago.sql
supabase/seed/001_plans.sql
```

O con la CLI de Supabase:

```bash
supabase db push
```

### 3. Configurar Mercado Pago

#### Crear aplicación en MP
1. Ir a [mercadopago.com.ar/developers/panel](https://www.mercadopago.com.ar/developers/panel)
2. Crear una nueva aplicación
3. Copiar `Access Token`, `Public Key`, `Client ID` y `Client Secret` al `.env`

#### Crear planes de suscripción (Preapproval Plans)
Ejecutar para cada plan via la API de MP o con `curl`:

```bash
# Plan Básico
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "RestaurantOS — Plan Básico",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 29000,
      "currency_id": "ARS"
    },
    "back_url": "https://tu-dominio.com/billing",
    "status": "active"
  }'
```

Repetir para Plan Profesional (`79000 ARS`) y Plan Premium (`149000 ARS`).  
Copiar el `id` de cada respuesta al `.env` como `MP_PLAN_BASIC_ID`, `MP_PLAN_PRO_ID`, `MP_PLAN_PREMIUM_ID`.

#### Configurar webhook de MP
1. Ir a [mercadopago.com.ar/developers/panel/webhooks](https://www.mercadopago.com.ar/developers/panel/webhooks)
2. URL: `https://tu-dominio.com/api/mercadopago/webhook`
3. Eventos a activar:
   - `preapproval`
   - `subscription_authorized_payment`
4. Copiar el `secret` generado como `MP_WEBHOOK_SECRET` en `.env`

Para desarrollo local, usar **ngrok**:

```bash
npm run mp:ngrok
# Copiar la URL https de ngrok al panel de MP como webhook
```

### 4. Crear Super Admin

Después de registrar el primer usuario, ejecutar en el **SQL Editor de Supabase**:

```sql
-- Reemplazar con el UUID del usuario creado
UPDATE user_profiles
SET role = 'superadmin'
WHERE user_id = 'UUID-DEL-USUARIO';
```

### 5. Levantar en desarrollo

```bash
npm run dev
# → http://localhost:4321
```

---

## Flujo de usuario

```
Registro → /register
    ↓
Onboarding → /onboarding  (configura nombre, moneda, zona horaria)
    ↓
Dashboard → /dashboard  (14 días de prueba gratuita)
    ↓
Billing → /billing  (suscribirse con Mercado Pago)
    ↓
Sistema completo desbloqueado
```

---

## Roles y accesos

| Rol         | Dashboard | POS | Cocina | Empleados | Reportes | Facturación |
|-------------|:---------:|:---:|:------:|:---------:|:--------:|:-----------:|
| superadmin  | ✅ global  | ✅  | ✅     | ✅         | ✅        | ✅           |
| admin       | ✅         | ✅  | ✅     | ✅         | ✅        | ✅           |
| employee    | ✅ parcial | ✅  | ✅     | ❌         | ❌        | ❌           |
| cashier     | ❌         | ✅  | ❌     | ❌         | ❌        | ❌           |
| cook        | ❌         | ❌  | ✅     | ❌         | ❌        | ❌           |

---

## Planes

| Plan          | Precio mensual | Productos | Empleados | Sucursales |
|---------------|:--------------:|:---------:|:---------:|:----------:|
| Básico        | ARS 29.000     | 50        | 2         | 1          |
| Profesional   | ARS 79.000     | ∞         | 10        | 3          |
| Premium       | ARS 149.000    | ∞         | ∞         | ∞          |

> Ajustar precios en la tabla `plans` de Supabase y en los Preapproval Plans de MP.

---

## Deploy en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Variables de entorno: configurar en dashboard.vercel.com
# todas las variables del .env.example
```

---

## Seguridad

- **Row Level Security** activo en todas las tablas — separación total de datos entre empresas
- **Middleware de Astro** verifica sesión, role y estado de suscripción en cada request
- **Verificación de firma HMAC-SHA256** en todos los webhooks de Mercado Pago
- **Validación Zod** en todos los endpoints de la API
- **Control de límites de plan** antes de crear productos, empleados o sucursales

---

## Variables de entorno requeridas

```env
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

MP_ACCESS_TOKEN=
MP_CLIENT_ID=
MP_CLIENT_SECRET=
PUBLIC_MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=

MP_PLAN_BASIC_ID=
MP_PLAN_PRO_ID=
MP_PLAN_PREMIUM_ID=

PUBLIC_APP_URL=
NODE_ENV=production
```
