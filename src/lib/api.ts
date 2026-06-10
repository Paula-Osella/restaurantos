export function apiSuccess<T>(data: T, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function apiError(message: string, status = 400, details?: unknown) {
  return new Response(
    JSON.stringify({ success: false, error: message, details }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

export function apiUnauthorized(message = 'No autorizado') {
  return apiError(message, 401)
}

export function apiForbidden(message = 'Acceso denegado') {
  return apiError(message, 403)
}

export function apiNotFound(message = 'No encontrado') {
  return apiError(message, 404)
}

export function apiServerError(message = 'Error interno del servidor') {
  return apiError(message, 500)
}

export function redirect(url: string, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: url },
  })
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    },
  }
}
