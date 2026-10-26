// Client HTTP de l'API PHP : jeton CSRF sur chaque écriture, version dans If-Match, erreurs typées.
let csrfToken = null

export function setCsrfToken(token) {
  csrfToken = token
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error ?? `Erreur ${status}`)
    this.status = status
    this.code = body?.code ?? null
    this.fields = body?.fields ?? {}
    this.current = body?.current ?? null
  }

  get isConflict() {
    return this.status === 409
  }
}

async function request(method, path, { body, version } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken
  if (version !== undefined) headers['If-Match'] = `"${version}"`

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('vltpm:unauthorized'))
    throw new ApiError(response.status, data)
  }
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, version) => request('POST', path, { body, version }),
  patch: (path, body, version) => request('PATCH', path, { body, version }),
}
