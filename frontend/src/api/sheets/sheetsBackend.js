import { ApiError } from '@/api/client'
import { normalizeAll, withDefaults } from '@/domain/legacy'
import { DONE, settingsFrom } from '@/domain/settings'
import { nextId, pick, TASK_FIELDS, taskEvent, validateTask } from '@/domain/tasks'
import { DELIVERABLE_FIELDS, diff, MILESTONES, PROJECT_FIELDS, validateDeliverable, validateMilestone, validateProject } from '@/domain/projects'
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
    const data = { status: 'À faire', priority: 'Normale', poles: [], checklist: [], links: [], ...pick(input, TASK_FIELDS) }
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
}
