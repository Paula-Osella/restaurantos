/**
 * Componente de Facturación con Mercado Pago
 * Ruta: /billing
 *
 * Muestra:
 * - Plan actual y estado de suscripción
 * - Fecha de próximo cobro
 * - Historial de pagos
 * - Opciones de upgrade / downgrade / cancelación
 */

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  name: string
  price_monthly: number
  price_annual: number
  max_products: number | null
  max_employees: number | null
  max_branches: number | null
  features: Record<string, boolean>
}

interface BillingInfo {
  status: string
  subscription_status: string | null
  mp_subscription_id: string | null
  next_payment_date: string | null
  trial_ends_at: string | null
  plan: Plan | null
}

interface Invoice {
  id: string
  mp_payment_id: string
  mp_payment_url: string | null
  amount: number
  currency: string
  status: string
  description: string | null
  period_start: string | null
  created_at: string
}

type BillingCycle = 'monthly' | 'annual'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_KEYS: Record<string, 'basic' | 'professional' | 'premium'> = {
  'Básico': 'basic',
  'Profesional': 'professional',
  'Premium': 'premium',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'text-emerald-600 bg-emerald-50' },
  past_due: { label: 'Pago vencido', color: 'text-amber-600 bg-amber-50' },
  cancelled: { label: 'Cancelada', color: 'text-red-600 bg-red-50' },
  paused: { label: 'Pausada', color: 'text-slate-600 bg-slate-100' },
  pending: { label: 'Pendiente', color: 'text-blue-600 bg-blue-50' },
  trialing: { label: 'Período de prueba', color: 'text-violet-600 bg-violet-50' },
}

function formatARS(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: es })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setSuccessMsg('¡Suscripción activada correctamente! Bienvenido a RestaurantOS.')
    }
    if (params.get('suspended') === 'true') {
      setError('Tu cuenta está suspendida por falta de pago. Suscribite para continuar.')
    }
    if (params.get('cancelled') === 'true') {
      setError('Tu suscripción fue cancelada. Podés volver a suscribirte en cualquier momento.')
    }
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [billingRes, plansRes, invoicesRes] = await Promise.all([
        fetch('/api/billing/info'),
        fetch('/api/billing/plans'),
        fetch('/api/billing/invoices'),
      ])
      const [b, p, i] = await Promise.all([
        billingRes.json(),
        plansRes.json(),
        invoicesRes.json(),
      ])
      if (b.success) setBilling(b.data)
      if (p.success) setPlans(p.data)
      if (i.success) setInvoices(i.data)
    } catch {
      setError('Error al cargar información de facturación.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubscribe(planName: string) {
    const planKey = PLAN_KEYS[planName]
    if (!planKey) return

    const isChange = billing?.mp_subscription_id != null
    const endpoint = isChange
      ? '/api/mercadopago/change-plan'
      : '/api/mercadopago/checkout'

    setActionLoading(planName)
    setError(null)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Error al procesar el pago.')
        return
      }

      // Redirigir al checkout de Mercado Pago
      window.location.href = data.data.url
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancel() {
    setActionLoading('cancel')
    setError(null)
    try {
      const res = await fetch('/api/mercadopago/cancel', { method: 'POST' })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? 'Error al cancelar la suscripción.')
        return
      }
      setSuccessMsg('Suscripción cancelada. Podés volver a suscribirte en cualquier momento.')
      setCancelConfirm(false)
      loadAll()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Cargando facturación…</span>
        </div>
      </div>
    )
  }

  const subStatus = billing?.subscription_status ?? (billing?.trial_ends_at ? 'trialing' : null)
  const statusInfo = subStatus ? STATUS_LABELS[subStatus] : null
  const currentPlanName = billing?.plan?.name ?? null
  const isSubscribed = billing?.mp_subscription_id != null
  const isTrial = billing?.status === 'trial'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Facturación</h1>
        <p className="text-sm text-slate-500 mt-1">Gestioná tu plan y suscripción de RestaurantOS.</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Estado actual */}
      {(isSubscribed || isTrial) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">Estado actual</h2>
          <div className="flex flex-wrap gap-6 items-start">
            <div>
              <div className="text-xs text-slate-400 mb-1">Plan</div>
              <div className="text-lg font-semibold text-slate-900">{currentPlanName ?? 'Sin plan'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Estado</div>
              {statusInfo ? (
                <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
            {billing?.next_payment_date && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Próximo cobro</div>
                <div className="text-sm font-medium text-slate-700">{formatDate(billing.next_payment_date)}</div>
              </div>
            )}
            {isTrial && billing?.trial_ends_at && (
              <div>
                <div className="text-xs text-slate-400 mb-1">Prueba gratuita hasta</div>
                <div className="text-sm font-medium text-slate-700">{formatDate(billing.trial_ends_at)}</div>
              </div>
            )}
          </div>

          {/* Cancelar suscripción */}
          {isSubscribed && !cancelConfirm && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setCancelConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Cancelar suscripción
              </button>
            </div>
          )}

          {cancelConfirm && (
            <div className="mt-6 pt-4 border-t border-red-100 bg-red-50 rounded-xl p-4">
              <p className="text-sm text-red-700 mb-3">
                ¿Estás seguro? Tu cuenta se suspenderá al final del período actual.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={actionLoading === 'cancel'}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'cancel' ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  No, mantener
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selector de ciclo */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {isSubscribed ? 'Cambiar plan' : 'Elegí tu plan'}
        </h2>
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              cycle === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
              cycle === 'annual'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Anual
            <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
              2 meses gratis
            </span>
          </button>
        </div>
      </div>

      {/* Planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const planKey = PLAN_KEYS[plan.name]
          const isCurrent = plan.name === currentPlanName
          const price = cycle === 'monthly' ? plan.price_monthly : plan.price_annual / 12
          const isLoading = actionLoading === plan.name

          const featureList = [
            plan.max_products === null
              ? 'Productos ilimitados'
              : `Hasta ${plan.max_products} productos`,
            plan.max_employees === null
              ? 'Empleados ilimitados'
              : `Hasta ${plan.max_employees} empleados`,
            plan.max_branches === null
              ? 'Sucursales ilimitadas'
              : plan.max_branches === 1
              ? '1 sucursal'
              : `Hasta ${plan.max_branches} sucursales`,
            plan.features?.advanced_reports && 'Reportes avanzados',
            plan.features?.inventory && 'Inventario completo',
            plan.features?.stock_alerts && 'Alertas de stock',
            plan.features?.api_access && 'Acceso a API',
            plan.features?.white_label && 'White-label',
            plan.features?.priority_support && 'Soporte prioritario',
          ].filter(Boolean) as string[]

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col transition-shadow hover:shadow-md ${
                isCurrent
                  ? 'border-violet-500 shadow-violet-100 shadow-md'
                  : plan.name === 'Profesional'
                  ? 'border-slate-200'
                  : 'border-slate-200'
              }`}
            >
              {plan.name === 'Profesional' && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Más popular
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Plan actual
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">{formatARS(price)}</span>
                  <span className="text-sm text-slate-400">/mes</span>
                </div>
                {cycle === 'annual' && (
                  <p className="text-xs text-emerald-600 mt-1">
                    {formatARS(plan.price_annual)}/año — 2 meses gratis
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {featureList.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.name)}
                disabled={isCurrent || isLoading || !planKey}
                className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-violet-600 text-white hover:bg-violet-700 active:scale-95 disabled:opacity-50'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Redirigiendo…
                  </span>
                ) : isCurrent ? (
                  'Plan actual'
                ) : isSubscribed ? (
                  'Cambiar a este plan'
                ) : (
                  'Suscribirme con Mercado Pago'
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Info Mercado Pago */}
      <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="10" fill="#009EE3" />
          <text x="50%" y="60%" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">MP</text>
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-800">Pagos procesados por Mercado Pago</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Podés pagar con tarjeta de crédito, débito, Mercado Pago saldo o transferencia bancaria.
            Tu información financiera nunca es almacenada en nuestros servidores.
          </p>
        </div>
      </div>

      {/* Historial de pagos */}
      {invoices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Historial de pagos</h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Monto</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 text-slate-600">{formatDate(inv.created_at)}</td>
                    <td className="px-5 py-4 text-slate-700">{inv.description ?? 'Suscripción RestaurantOS'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${
                        inv.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : inv.status === 'open'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {inv.status === 'paid' ? 'Pagado' : inv.status === 'open' ? 'Pendiente' : 'Anulado'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-900">
                      {formatARS(inv.amount)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {inv.mp_payment_url && (
                        <a
                          href={inv.mp_payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 hover:text-violet-800 text-xs font-medium transition-colors"
                        >
                          Ver comprobante →
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
