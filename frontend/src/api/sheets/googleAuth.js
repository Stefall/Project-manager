// Connexion Google dans le navigateur (Google Identity Services, flux « token »).
// Aucun secret : l'identifiant client OAuth est public par nature. L'accès réel aux données
// dépend du partage du Google Sheet avec le compte de la personne connectée.

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets openid email profile'
const STORAGE_KEY = 'vltpm.google'

let tokenClient = null
let token = null // { access_token, expires_at, email, name }

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Impossible de charger la connexion Google.'))
    document.head.appendChild(s)
  })
}

function persist() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token)) } catch { /* navigation privée */ }
}

function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && saved.expires_at > Date.now() + 60_000) token = saved
  } catch { /* ignoré */ }
}

async function requestToken(prompt) {
  await loadScript()
  return new Promise((resolve, reject) => {
    tokenClient ??= window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    })
    tokenClient.callback = (response) => {
      if (response.error) return reject(new Error('Connexion Google refusée ou annulée.'))
      resolve(response)
    }
    tokenClient.error_callback = () => reject(new Error('Connexion Google interrompue.'))
    tokenClient.requestAccessToken({ prompt, hint: token?.email })
  })
}

export const googleAuth = {
  /** Reprend la session de l'onglet si le jeton est encore valide. */
  current() {
    if (!token) restore()
    return token
  },

  async signIn() {
    const response = await requestToken('select_account')
    const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${response.access_token}` },
    }).then((r) => r.json())
    token = {
      access_token: response.access_token,
      expires_at: Date.now() + response.expires_in * 1000,
      email: (profile.email || '').toLowerCase(),
      name: profile.name || '',
    }
    persist()
    return token
  },

  /** Jeton valide pour un appel API ; renouvelé sans fenêtre quand il expire (≈ 1 h). */
  async accessToken() {
    if (!token) restore()
    if (!token) throw Object.assign(new Error('Session expirée, reconnectez-vous.'), { status: 401 })
    if (token.expires_at < Date.now() + 60_000) {
      const response = await requestToken('')
      token = { ...token, access_token: response.access_token, expires_at: Date.now() + response.expires_in * 1000 }
      persist()
    }
    return token.access_token
  },

  signOut() {
    if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.access_token, () => {})
    token = null
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignoré */ }
  },
}
