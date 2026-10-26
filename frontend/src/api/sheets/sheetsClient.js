import { ApiError } from '@/api/client'
import { googleAuth } from './googleAuth'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const id = () => import.meta.env.VITE_SPREADSHEET_ID

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}/${id()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await googleAuth.accessToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = {
      401: 'Session Google expirée, reconnectez-vous.',
      403: 'Votre compte Google n\'a pas accès au Google Sheet de VLT. Demandez à un administrateur de le partager avec vous.',
      404: 'Google Sheet introuvable : vérifiez l\'identifiant configuré.',
      429: 'Trop de requêtes vers Google, réessayez dans une minute.',
    }[response.status] ?? data.error?.message ?? `Erreur Google Sheets ${response.status}`
    if (response.status === 401) window.dispatchEvent(new CustomEvent('vltpm:unauthorized'))
    throw new ApiError(response.status, { error: message })
  }
  return data
}

const encode = (data) => JSON.stringify(data)

/** Lignes « id | json » d'un onglet, indexées par id, avec leur numéro de ligne (1-based). */
function parseTab(values = []) {
  const rows = {}
  values.forEach((row, i) => {
    if (i === 0 || !row[0]) return
    let data = {}
    try { data = JSON.parse(row[1] || '{}') } catch { data = { id: row[0], _invalid: true } }
    rows[row[0]] = { row: i + 1, data }
  })
  return rows
}

export const sheets = {
  async readTabs(tabs) {
    const query = tabs.map((t) => `ranges=${encodeURIComponent(`${t}!A:B`)}`).join('&')
    const data = await call(`/values:batchGet?${query}`)
    return Object.fromEntries(tabs.map((t, i) => [t, parseTab(data.valueRanges[i]?.values)]))
  },

  async readTab(tab) {
    return (await this.readTabs([tab]))[tab]
  },

  async readRange(range) {
    return (await call(`/values/${encodeURIComponent(range)}`)).values ?? []
  },

  writeRow(tab, row, rowId, data) {
    return call(`/values/${encodeURIComponent(`${tab}!A${row}:B${row}`)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: { values: [[rowId, encode(data)]] },
    })
  },

  appendRow(tab, rowId, data) {
    return call(`/values/${encodeURIComponent(`${tab}!A:B`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: { values: [[rowId, encode(data)]] },
    })
  },

  writeRange(range, values) {
    return call(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, { method: 'PUT', body: { values } })
  },
}
