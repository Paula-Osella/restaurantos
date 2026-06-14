import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
    try {
        const { planId, userEmail } = await request.json()

        const planMap: Record<string, { title: string; envKey: string }> = {
        basico:       { title: 'RestaurantOS — Plan Básico',        envKey: 'MP_PLAN_BASIC_ID'   },
        profesional:  { title: 'RestaurantOS — Plan Profesional',   envKey: 'MP_PLAN_PRO_ID'     },
        premium:      { title: 'RestaurantOS — Plan Premium',       envKey: 'MP_PLAN_PREMIUM_ID' },
        }

        const planMeta = planMap[planId]
        if (!planMeta) {
        return json({ error: 'Plan inválido' }, 400)
        }

        const mpAccessToken = import.meta.env.MP_ACCESS_TOKEN
        const siteUrl       = import.meta.env.PUBLIC_APP_URL ?? 'http://localhost:4321'

        const preapprovalPlanId =
        planId === 'basico'      ? import.meta.env.MP_PLAN_BASIC_ID   :
        planId === 'profesional' ? import.meta.env.MP_PLAN_PRO_ID     :
                                    import.meta.env.MP_PLAN_PREMIUM_ID

        if (!mpAccessToken || !preapprovalPlanId) {
        console.error('Faltan variables de entorno MP')
        return json({ error: 'Configuración incompleta' }, 500)
        }

        const res = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify({
            preapproval_plan_id: preapprovalPlanId,
            reason: planMeta.title,
            payer_email: userEmail ?? undefined,
<<<<<<< HEAD
            back_url: `${siteUrl}/restaurantos/dashboard?checkout=success&plan=${planId}`,
=======
            back_url: `${siteUrl}/dashboard?checkout=success&plan=${planId}`,
>>>>>>> 94cdb9875810697bd9a7c4debdb08e95988df769
            status: 'pending',
        }),
        })

        if (!res.ok) {
        const err = await res.text()
        console.error('Error Mercado Pago:', err)
        return json({ error: 'Error al crear suscripción en MP' }, 500)
        }

        const data = await res.json()

        if (!data.init_point) {
        console.error('MP no devolvió init_point:', data)
        return json({ error: 'Respuesta inesperada de MP' }, 500)
        }

        return json({ init_point: data.init_point }, 200)

    } catch (err) {
        console.error('Error interno:', err)
        return json({ error: 'Error interno del servidor' }, 500)
    }
}

function json(data: unknown, status: number) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
<<<<<<< HEAD
}
=======
}
>>>>>>> 94cdb9875810697bd9a7c4debdb08e95988df769
