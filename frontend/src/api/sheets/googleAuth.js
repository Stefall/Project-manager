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

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

// Messages des erreurs renvoyées par Google Identity Services (error_callback).
const POPUP_ERRORS = {
  popup_failed_to_open: 'La fenêtre de connexion Google a été bloquée par le navigateur. Autorisez les fenêtres pop-up pour ce site, puis réessayez.',
  popup_closed: 'La fenêtre de connexion Google a été fermée avant la fin. Réessayez.',
}

function client() {
  tokenClient ??= window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  })
  return tokenClient
}

/**
 * Ouvre la fenêtre Google. Si la bibliothèque est déjà chargée, la fenêtre s'ouvre dans le même tour
 * que le clic : sinon certains navigateurs (Safari, Firefox) la bloquent sans prévenir.
 */
function requestToken(prompt) {
  const open = () => new Promise((resolve, reject) => {
    const tc = client()
    tc.callback = (response) => {
      if (response.error) {
        console.error('[VLT] Connexion Google refusée :', response)
        return reject(new Error(response.error === 'access_denied'
          ? 'Connexion Google refusée. Si Google indique « Accès bloqué », votre compte doit être ajouté comme utilisateur test de l\'application.'
          : `Connexion Google refusée (${response.error_description || response.error}).`))
      }
      if (!window.google.accounts.oauth2.hasGrantedAllScopes(response, SHEETS_SCOPE)) {
        return reject(new Error('L\'accès à Google Sheets n\'a pas été autorisé. Reconnectez-vous et cochez la case « Afficher, modifier, créer et supprimer vos feuilles de calcul Google Sheets ».'))
      }
      resolve(response)
    }
    tc.error_callback = (error) => {
      console.error('[VLT] Fenêtre Google :', error)
      reject(new Error(POPUP_ERRORS[error?.type] ?? `Connexion Google interrompue (${error?.type || error?.message || 'erreur inconnue'}).`))
    }
    tc.requestAccessToken({ prompt, hint: token?.email })
  })
  if (window.google?.accounts?.oauth2) return open()
  return loadScript().then(open)
}

export const googleAuth = {
  /** Charge la bibliothèque Google à l'avance, pour que le clic ouvre la fenêtre sans délai. */
  prepare() {
    return loadScript().then(client)
  },

  /** Reprend la session de l'onglet si le jeton est encore valide. */
  current() {
    if (!token) restore()
    return token
  },

  async signIn() {
    const response = await requestToken('select_account')
    const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${response.access_token}` },
    }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    if (!profile.email) throw new Error('Google n\'a pas transmis l\'adresse e-mail du compte. Reconnectez-vous en acceptant le partage de l\'adresse e-mail.')
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
