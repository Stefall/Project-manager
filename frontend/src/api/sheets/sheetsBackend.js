import { ApiError } from '@/api/client'
import { normalizeAll, withDefaults } from '@/domain/legacy'
import { DONE, settingsFrom } from '@/domain/settings'
import { nextId, pick, TASK_FIELDS, taskEvent, validateTask } from '@/domain/tasks'
import { DELIVERABLE_FIELDS, diff, MILESTONES, PROJECT_FIELDS, validateDeliverable, validateMilestone, validateProject } from '@/domain/projects'
import { nextNumber } from '@/domain/reports'
import { defaultPriority, publicUser, selfChangeError, USER_FIELDS, validateClient, validateSetting, validateUser } from '@/domain/admin'
import { googleAuth } from './googleAuth'
import { sheets } from './sheetsClient'

// Backend « sans serveur » de la démo : le navigateur lit et écrit le Google Sheet avec le compte Google
// de la personne connectée. Même contrat que le backend PHP, avec le même contrôle de version, mais
// sans verrou serveur : deux écritures exactement simultanées restent possibles (fenêtre de ~1 s).

const TABS = ['CLIENTS', 'PROJECTS', 'DELIVERABLES', 'TASKS', 'SETTINGS', 'USERS']
const now = () => new Date().toISOString()
let me = null
let cache = null // dernier instantané, pour la validation

function rowsOf(tab) {
  return Object.values(tab).map((r) => withDefaults(r.data))
}

async function revision() {
  const rows = await sheets.readRange('META!A1:E2')
  return Number(rows[1]?.[0] ?? 0)
}

async function bumpRevision() {
  const rows = await sheets.readRange('META!A1:E2')
  const header = rows[0] ?? ['revision', 'updated_at', 'updated_by']
  const current = rows[1] ?? []
  const next = [String(Number(current[0] ?? 0) + 1), now(), me.email, ...current.slice(3)]
  await sheets.writeRange('META!A1:E2', [header, next])
}

async function appendEvent(event) {
  const e = { id: `EV-${Date.now()}${Math.random().toString(36).slice(2, 6)}`, date: now(), author: me.email, ...event }
  await sheets.appendRow('EVENTS', e.id, e)
}

async function resolveUser(account) {
  const users = rowsOf(await sheets.readTab('USERS'))
  const user = users.find((u) => (u.email || '').toLowerCase() === account.email && u.active !== false && !u.archived)
  if (!user) throw new ApiError(403, { error: `Le compte ${account.email} n'est pas autorisé dans VLT Project Manager.` })
  return { id: user.id, email: account.email, name: user.name || account.name, role: user.role || 'member' }
}

/** Garde l'instantané local à jour après une écriture, pour les validations suivantes. */
function remember(collection, item) {
  if (!cache) return item
  const list = cache[collection]
  const i = list.findIndex((x) => x.id === item.id)
  if (item.archived) { if (i >= 0) list.splice(i, 1) } else if (i >= 0) list.splice(i, 1, item); else list.push(item)
  return item
}

function requireAdmin() {
  // Garde-fou d'interface : en démo, l'accès réel est donné par le partage du Sheet. Le backend PHP le vérifie côté serveur.
  if (me?.role !== 'admin') throw new ApiError(403, { error: 'Réservé aux administrateurs.' })
}

function invalid(errors) {
  return new ApiError(422, { error: 'Certains champs sont invalides.', fields: errors })
}

async function updateRow(tab, id, changes, expectedVersion, buildEvent) {
  const rows = await sheets.readTab(tab)
  const entry = rows[id]
  if (!entry) throw new ApiError(404, { error: 'Élément introuvable.' })
  const current = withDefaults(entry.data)
  if (current.version !== expectedVersion) {
    throw new ApiError(409, { error: 'Modifié entre-temps par quelqu\'un d\'autre.', code: 'conflict', current })
  }
  const next = { ...current, ...changes, id, version: current.version + 1, updatedAt: now(), updatedBy: me.email }
  await sheets.writeRow(tab, entry.row, id, next)
  const event = buildEvent?.(current, next)
  if (event) await appendEvent({ ...event, entity: id })
  await bumpRevision()
  return next
}

export const sheetsBackend = {
  kind: 'sheets',

  async me() {
    const account = googleAuth.current()
    if (!account) return { user: null }
    me ??= await resolveUser(account)
    return { user: me }
  },

  prepare() {
    return googleAuth.prepare()
  },

  async login() {
    const account = await googleAuth.signIn()
    try {
      me = await resolveUser(account)
    } catch (e) {
      googleAuth.signOut()
      throw e
    }
    return { user: me }
  },

  async logout() {
    googleAuth.signOut()
    me = null
  },

  async bootstrap(since) {
    const rev = await revision()
    if (since !== null && since === rev) return { revision: rev, unchanged: true }
    const tabs = await sheets.readTabs(TABS)
    const settings = settingsFrom(rowsOf(tabs.SETTINGS))
    const raw = {
      clients: rowsOf(tabs.CLIENTS).filter((c) => !c.archived),
      projects: rowsOf(tabs.PROJECTS).filter((p) => !p.archived),
      deliverables: rowsOf(tabs.DELIVERABLES),
      tasks: rowsOf(tabs.TASKS).filter((t) => !t.archived),
    }
    const { projects, tasks } = normalizeAll(raw, settings)
    cache = { ...raw, projects, tasks, settings }
    return { revision: rev, clients: raw.clients, projects, deliverables: raw.deliverables, tasks, settings }
  },

  async createTask(input) {
    const data = { status: 'À faire', priority: defaultPriority(cache.settings.priorities), poles: [], checklist: [], links: [], ...pick(input, TASK_FIELDS) }
    const errors = validateTask(data, cache)
    if (Object.keys(errors).length) throw invalid(errors)
    data.deliverable = cache.deliverables.find((d) => d.id === data.deliverableId)?.name ?? ''

    const ids = Object.keys(await sheets.readTab('TASKS'))
    const stamp = now()
    const task = {
      ...data,
      id: nextId('T', ids),
      version: 1,
      archived: false,
      createdAt: stamp,
      updatedAt: stamp,
      updatedBy: me.email,
      completedAt: data.status === DONE ? stamp : '',
    }
    await sheets.appendRow('TASKS', task.id, task)
    await appendEvent({ type: 'task.created', entityType: 'task', entity: task.id, projectId: task.projectId, deliverableId: task.deliverableId, description: `Tâche créée : ${task.title}` })
    await bumpRevision()
    return { task: remember('tasks', task) }
  },

  async updateTask(id, changes, version) {
    const current = cache.tasks.find((t) => t.id === id) ?? {}
    const patch = pick(changes, TASK_FIELDS)
    const errors = validateTask({ ...current, ...patch }, cache)
    if (Object.keys(errors).length) throw invalid(errors)
    if ('deliverableId' in patch) patch.deliverable = cache.deliverables.find((d) => d.id === patch.deliverableId)?.name ?? ''
    if ('status' in patch && patch.status !== current.status) {
      patch.completedAt = patch.status === DONE ? now() : ''
      patch.closedAt = patch.completedAt
    }
    // Les champs normalisés à la lecture (pôles, livrable) sont enregistrés sous leur forme actuelle.
    const normalized = pick(current, ['poles', 'deliverableId', 'links', 'checklist'])
    try {
      return { task: remember('tasks', await updateRow('TASKS', id, { ...normalized, ...patch }, version, taskEvent)) }
    } catch (e) {
      // La version renvoyée en cas de conflit est lue telle quelle : on la normalise comme au chargement.
      if (e.current) e.current = normalizeAll({ ...cache, tasks: [e.current] }, cache.settings).tasks[0]
      throw e
    }
  },

  async archiveTask(id, version) {
    const task = await updateRow('TASKS', id, { archived: true }, version, (before) => ({
      type: 'task.archived', entityType: 'task', projectId: before.projectId, description: `Tâche archivée : ${before.title}`,
    }))
    return { task: remember('tasks', task) }
  },
  async updateProject(id, changes, version) {
    const current = cache.projects.find((p) => p.id === id) ?? {}
    const patch = pick(changes, PROJECT_FIELDS)
    const errors = validateProject({ ...current, ...patch })
    if (Object.keys(errors).length) throw invalid(errors)
    if ('clientId' in patch) patch.client = cache.clients.find((c) => c.id === patch.clientId)?.name ?? current.client
    const project = await updateRow('PROJECTS', id, patch, version, (before, after) => {
      const changes = diff(before, after, PROJECT_FIELDS)
      if (!Object.keys(changes).length) return null
      // Une nouvelle synthèse de situation est un événement à part : elle alimente le bilan mensuel.
      const type = changes.situation ? 'project.situation_updated' : 'project.updated'
      return { type, entityType: 'project', projectId: id, changes, description: `Projet modifié : ${after.name}` }
    })
    return { project: remember('projects', project) }
  },

  async createDeliverable(input) {
    const data = { links: [], description: '', dueDate: '', ...pick(input, DELIVERABLE_FIELDS) }
    const errors = validateDeliverable(data, cache)
    if (Object.keys(errors).length) throw invalid(errors)
    const ids = Object.keys(await sheets.readTab('DELIVERABLES'))
    const stamp = now()
    const deliverable = {
      ...data, id: nextId('D', ids), validatedAt: '', deliveredAt: '', publishedAt: '',
      version: 1, archived: false, createdAt: stamp, updatedAt: stamp, updatedBy: me.email,
    }
    await sheets.appendRow('DELIVERABLES', deliverable.id, deliverable)
    await appendEvent({ type: 'deliverable.created', entityType: 'deliverable', entity: deliverable.id, projectId: deliverable.projectId, deliverableId: deliverable.id, description: `Livrable créé : ${deliverable.name}` })
    await bumpRevision()
    return { deliverable: remember('deliverables', deliverable) }
  },

  async updateDeliverable(id, changes, version) {
    const current = cache.deliverables.find((d) => d.id === id) ?? {}
    const patch = pick(changes, [...DELIVERABLE_FIELDS, 'archived'])
    delete patch.projectId
    const errors = validateDeliverable({ ...current, ...patch }, cache)
    if (Object.keys(errors).length) throw invalid(errors)
    const deliverable = await updateRow('DELIVERABLES', id, patch, version, (before, after) => {
      const changes = diff(before, after, [...DELIVERABLE_FIELDS, 'archived'])
      if (!Object.keys(changes).length) return null
      const type = changes.archived ? 'deliverable.archived' : 'deliverable.updated'
      return { type, entityType: 'deliverable', projectId: after.projectId, deliverableId: id, changes, description: `Livrable modifié : ${after.name}` }
    })
    return { deliverable: remember('deliverables', deliverable) }
  },

  /** action = validate | deliver | publish ; undo = true pour annuler un jalon saisi par erreur. */
  async deliverableMilestone(id, action, { date, note = '', link = '', undo = false }, version) {
    const milestone = MILESTONES[action]
    if (!milestone) throw new ApiError(404, { error: 'Action inconnue.' })
    if (!undo) {
      const errors = validateMilestone({ date, link })
      if (Object.keys(errors).length) throw invalid(errors)
    }
    const deliverable = await updateRow('DELIVERABLES', id, { [milestone.field]: undo ? '' : date }, version, (before, after) => ({
      type: undo ? `${milestone.type}.cancelled` : milestone.type,
      entityType: 'deliverable',
      projectId: after.projectId,
      deliverableId: id,
      effectiveDate: undo ? before[milestone.field] : date,
      note,
      link,
      description: `${undo ? 'Annulé : ' : ''}${milestone.description} : ${after.name}`,
    }))
    return { deliverable: remember('deliverables', deliverable) }
  },

  async listEvents() {
    return { events: rowsOf(await sheets.readTab('EVENTS')) }
  },

  async listReports() {
    return { reports: rowsOf(await sheets.readTab('REPORTS')) }
  },

  /** Fige un bilan : la ligne n'est plus jamais modifiée, une nouvelle génération crée une nouvelle version. */
  async createReport({ month, projectId = '', comment = '', content }) {
    if (!/^\d{4}-\d{2}$/.test(month || '')) throw invalid({ month: 'Mois invalide.' })
    if (projectId && !cache?.projects.some((p) => p.id === projectId)) throw invalid({ projectId: 'Projet inconnu.' })
    const rows = rowsOf(await sheets.readTab('REPORTS'))
    const stamp = now()
    const report = {
      id: nextId('R', rows.map((r) => r.id), 4),
      month,
      projectId,
      number: nextNumber(rows, { month, projectId }),
      comment: String(comment).slice(0, 2000),
      content,
      version: 1,
      archived: false,
      createdAt: stamp,
      createdBy: me.email,
    }
    // Une cellule Google Sheets contient au plus 50 000 caractères.
    if (JSON.stringify(report).length > 48_000) throw new ApiError(413, { error: 'Bilan trop volumineux pour être figé : limitez-le à un projet.' })
    await sheets.appendRow('REPORTS', report.id, report)
    const scope = projectId ? cache.projects.find((p) => p.id === projectId)?.name : 'tous les projets'
    await appendEvent({ type: 'report.frozen', entityType: 'report', entity: report.id, projectId, description: `Bilan ${month} figé (version ${report.number}, ${scope})` })
    await bumpRevision()
    return { report }
  },

  // --- Administration (réservée aux administrateurs) ---

  /** Comptes, clients (archivés compris), éléments archivés et versions des paramètres. */
  async adminData() {
    requireAdmin()
    const tabs = await sheets.readTabs(['USERS', 'CLIENTS', 'PROJECTS', 'DELIVERABLES', 'TASKS', 'SETTINGS'])
    const archived = (tab) => rowsOf(tabs[tab]).filter((x) => x.archived)
    return {
      users: rowsOf(tabs.USERS).map(publicUser),
      clients: rowsOf(tabs.CLIENTS),
      archived: { projects: archived('PROJECTS'), deliverables: archived('DELIVERABLES'), tasks: archived('TASKS') },
      settingVersions: Object.fromEntries(rowsOf(tabs.SETTINGS).map((r) => [r.id, r.version])),
    }
  },

  async createUser(input) {
    requireAdmin()
    const users = rowsOf(await sheets.readTab('USERS'))
    const data = { role: 'member', active: true, ...pick(input, USER_FIELDS) }
    data.email = String(data.email ?? '').trim().toLowerCase()
    const errors = validateUser(data, users)
    if (Object.keys(errors).length) throw invalid(errors)
    const stamp = now()
    const user = { ...data, name: data.name.trim(), id: nextId('U', users.map((u) => u.id)), version: 1, archived: false, createdAt: stamp, updatedAt: stamp, updatedBy: me.email }
    await sheets.appendRow('USERS', user.id, user)
    await appendEvent({ type: 'user.created', entityType: 'user', entity: user.id, description: `Compte autorisé : ${user.email} (${user.role})` })
    await bumpRevision()
    return { user }
  },

  async updateUser(id, changes, version) {
    requireAdmin()
    const users = rowsOf(await sheets.readTab('USERS'))
    const current = users.find((u) => u.id === id)
    if (!current) throw new ApiError(404, { error: 'Compte introuvable.' })
    const patch = pick(changes, ['name', 'role', 'active'])
    const refused = selfChangeError(me, current, patch)
    if (refused) throw new ApiError(422, { error: refused })
    const errors = validateUser({ ...current, ...patch }, users)
    if (Object.keys(errors).length) throw invalid(errors)
    const user = await updateRow('USERS', id, patch, version, (before, after) => {
      const changed = diff(before, after, ['name', 'role', 'active'])
      if (!Object.keys(changed).length) return null
      const what = changed.active ? (after.active ? 'réactivé' : 'désactivé') : 'modifié'
      return { type: 'user.updated', entityType: 'user', changes: changed, description: `Compte ${what} : ${after.email}` }
    })
    if (id === me.id) me = { ...me, name: user.name }
    return { user: publicUser(user) }
  },

  async createClient(input) {
    requireAdmin()
    const clients = rowsOf(await sheets.readTab('CLIENTS'))
    const name = String(input.name ?? '').trim()
    const errors = validateClient({ name }, clients)
    if (Object.keys(errors).length) throw invalid(errors)
    const stamp = now()
    const client = { id: nextId('C', clients.map((c) => c.id)), name, version: 1, archived: false, createdAt: stamp, updatedAt: stamp, updatedBy: me.email }
    await sheets.appendRow('CLIENTS', client.id, client)
    await appendEvent({ type: 'client.created', entityType: 'client', entity: client.id, description: `Client créé : ${name}` })
    await bumpRevision()
    return { client: remember('clients', client) }
  },

  async updateClient(id, changes, version) {
    requireAdmin()
    const tabs = await sheets.readTabs(['CLIENTS', 'PROJECTS'])
    const clients = rowsOf(tabs.CLIENTS)
    const patch = pick(changes, ['name', 'archived'])
    if ('name' in patch) patch.name = String(patch.name).trim()
    const current = clients.find((c) => c.id === id) ?? {}
    const errors = validateClient({ ...current, ...patch }, clients)
    if (Object.keys(errors).length) throw invalid(errors)
    if (patch.archived && rowsOf(tabs.PROJECTS).some((p) => p.clientId === id && !p.archived)) {
      throw new ApiError(422, { error: 'Archivez d\'abord les projets de ce client.' })
    }
    const client = await updateRow('CLIENTS', id, patch, version, (before, after) => {
      const changed = diff(before, after, ['name', 'archived'])
      if (!Object.keys(changed).length) return null
      const type = changed.archived ? (after.archived ? 'client.archived' : 'client.restored') : 'client.updated'
      return { type, entityType: 'client', changes: changed, description: `Client ${changed.archived ? (after.archived ? 'archivé' : 'restauré') : 'modifié'} : ${after.name}` }
    })
    return { client: remember('clients', client) }
  },

  async createProject(input) {
    requireAdmin()
    const data = { status: 'En cadrage', achievements: [], watchpoints: [], nextSteps: [], links: [], ...pick(input, PROJECT_FIELDS) }
    const errors = validateProject(data)
    if (!cache.clients.some((c) => c.id === data.clientId)) errors.clientId = 'Choisissez un client.'
    if (Object.keys(errors).length) throw invalid(errors)
    data.client = cache.clients.find((c) => c.id === data.clientId).name
    const ids = Object.keys(await sheets.readTab('PROJECTS'))
    const stamp = now()
    const project = { ...data, name: data.name.trim(), id: nextId('P', ids), version: 1, archived: false, createdAt: stamp, updatedAt: stamp, updatedBy: me.email }
    await sheets.appendRow('PROJECTS', project.id, project)
    await appendEvent({ type: 'project.created', entityType: 'project', entity: project.id, projectId: project.id, description: `Projet créé : ${project.name}` })
    await bumpRevision()
    return { project: remember('projects', project) }
  },

  /** Archive ou restaure un projet, une tâche ou un livrable (kind = project | task | deliverable). */
  async setArchived(kind, id, archived, version) {
    requireAdmin()
    const { tab, label, name } = ARCHIVABLE[kind]
    const item = await updateRow(tab, id, { archived }, version, (before) => ({
      type: `${kind}.${archived ? 'archived' : 'restored'}`,
      entityType: kind,
      projectId: kind === 'project' ? id : before.projectId ?? '',
      ...(kind === 'deliverable' ? { deliverableId: id } : {}),
      description: `${label} ${archived ? 'archivé' : 'restauré'}${kind === 'task' ? 'e' : ''} : ${before[name]}`,
    }))
    return { item }
  },

  /** Remplace la liste des pôles ou des priorités (ligne de l'onglet SETTINGS, versionnée). */
  async updateSetting(key, value, version) {
    requireAdmin()
    const tabs = await sheets.readTabs(['SETTINGS', 'TASKS'])
    const refused = validateSetting(key, value, normalizeAll({ ...cache, tasks: rowsOf(tabs.TASKS) }, cache.settings).tasks)
    if (refused) throw new ApiError(422, { error: refused })
    const event = { type: 'settings.updated', entityType: 'settings', description: `Paramètres modifiés : ${key === 'poles' ? 'pôles' : 'priorités'}` }
    if (!tabs.SETTINGS[key]) {
      if (version !== 0) throw new ApiError(409, { error: 'Modifié entre-temps par quelqu\'un d\'autre.', code: 'conflict' })
      const stamp = now()
      await sheets.appendRow('SETTINGS', key, { id: key, value, version: 1, archived: false, createdAt: stamp, updatedAt: stamp, updatedBy: me.email })
      await appendEvent({ ...event, entity: key })
      await bumpRevision()
      return { version: 1 }
    }
    const row = await updateRow('SETTINGS', key, { value }, version, () => event)
    return { version: row.version }
  },
}

const ARCHIVABLE = {
  project: { tab: 'PROJECTS', label: 'Projet', name: 'name' },
  task: { tab: 'TASKS', label: 'Tâche', name: 'title' },
  deliverable: { tab: 'DELIVERABLES', label: 'Livrable', name: 'name' },
}
