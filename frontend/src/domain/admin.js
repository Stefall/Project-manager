// Règles de l'écran Administration, communes aux deux backends (voir api/src/Controllers/AdminController.php).

export const ROLES = [
  { id: 'admin', label: 'Administrateur' },
  { id: 'member', label: 'Membre' },
]
export const USER_FIELDS = ['email', 'name', 'role', 'active']

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (s) => String(s ?? '').trim().toLowerCase()

/** Un compte autorisé : e-mail Google unique, nom affiché, rôle. */
export function validateUser(user, users) {
  const errors = {}
  if (!EMAIL.test(user.email ?? '')) errors.email = 'Adresse e-mail invalide.'
  else if (users.some((u) => u.id !== user.id && norm(u.email) === norm(user.email))) errors.email = 'Ce compte existe déjà.'
  if (!user.name?.trim()) errors.name = 'Champ obligatoire.'
  if (!ROLES.some((r) => r.id === user.role)) errors.role = 'Rôle inconnu.'
  return errors
}

/** Personne ne peut retirer ses propres droits : il reste toujours au moins un administrateur actif. */
export function selfChangeError(me, user, changes) {
  if (user.id !== me.id) return null
  if ('role' in changes && changes.role !== 'admin') return 'Vous ne pouvez pas retirer vos propres droits d\'administrateur.'
  if ('active' in changes && !changes.active) return 'Vous ne pouvez pas désactiver votre propre compte.'
  return null
}

/** Ne jamais renvoyer le hash de mot de passe (backend PHP) à l'interface. */
export function publicUser({ passwordHash, ...user }) {
  return user
}

export function validateClient(client, clients) {
  const errors = {}
  if (!client.name?.trim()) errors.name = 'Champ obligatoire.'
  else if (clients.some((c) => c.id !== client.id && norm(c.name) === norm(client.name))) errors.name = 'Ce client existe déjà.'
  return errors
}

/** Identifiant stable d'un pôle, tiré de son libellé (« UX / UI » → « ux-ui »). */
export function slug(label) {
  return String(label).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Valide une nouvelle liste de pôles ou de priorités. Une valeur encore utilisée par une tâche
 * (même archivée) ne peut pas être supprimée : on la masque, pour garder l'historique lisible.
 */
export function validateSetting(key, value, tasks) {
  if (key === 'poles') {
    if (!Array.isArray(value) || !value.length) return 'Au moins un pôle est nécessaire.'
    const ids = new Set()
    for (const p of value) {
      if (!p || !/^[a-z0-9-]+$/.test(p.id ?? '') || !p.label?.trim()) return 'Chaque pôle doit avoir un libellé.'
      if (ids.has(p.id)) return `Le pôle « ${p.label} » existe déjà.`
      ids.add(p.id)
    }
    const used = new Set(tasks.flatMap((t) => t.poles ?? []))
    const removed = [...used].find((id) => !ids.has(id) && !value.some((p) => p.legacy?.includes(id)))
    return removed ? `Le pôle « ${removed} » est utilisé par des tâches : masquez-le plutôt que de le supprimer.` : null
  }
  if (key === 'priorities') {
    if (!Array.isArray(value) || !value.length) return 'Au moins une priorité est nécessaire.'
    if (value.some((p) => typeof p !== 'string' || !p.trim())) return 'Chaque priorité doit avoir un libellé.'
    if (new Set(value.map(norm)).size !== value.length) return 'Deux priorités portent le même nom.'
    const removed = [...new Set(tasks.map((t) => t.priority).filter(Boolean))].find((p) => !value.includes(p))
    return removed ? `La priorité « ${removed} » est utilisée par des tâches et ne peut pas être supprimée.` : null
  }
  return 'Paramètre non modifiable.'
}

/** Priorité donnée par défaut à une nouvelle tâche. */
export const defaultPriority = (priorities) => (priorities.includes('Normale') ? 'Normale' : priorities[0])
