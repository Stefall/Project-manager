import { defineStore } from 'pinia'
import { backend } from '@/api/backend'
import { normalizeAll } from '@/domain/legacy'

const POLL_MS = 30_000

/**
 * Données métier chargées en un appel (bootstrap) puis rafraîchies quand la révision du Sheet change.
 * Les écritures sont optimistes : l'interface change tout de suite, puis prend la réponse du serveur,
 * ou revient en arrière (ou affiche la version d'un collègue en cas de conflit).
 */
export const useDataStore = defineStore('data', {
  state: () => ({
    revision: null,
    clients: [],
    projects: [],
    deliverables: [],
    tasks: [],
    settings: { statuses: [], priorities: [], poles: [] },
    loading: false,
    error: null,
    pendingWrites: 0,
  }),

  getters: {
    projectById: (s) => Object.fromEntries(s.projects.map((p) => [p.id, p])),
    deliverableById: (s) => Object.fromEntries(s.deliverables.map((d) => [d.id, d])),
    taskById: (s) => Object.fromEntries(s.tasks.map((t) => [t.id, t])),
    deliverablesFor: (s) => (projectId) => s.deliverables.filter((d) => d.projectId === projectId && !d.archived),
    tasksFor: (s) => (projectId) => (projectId ? s.tasks.filter((t) => t.projectId === projectId) : s.tasks),
    tasksOfDeliverable: (s) => (deliverableId) => s.tasks.filter((t) => t.deliverableId === deliverableId),
    poleLabel: (s) => (id) => s.settings.poles.find((p) => p.id === id)?.label ?? id,
  },

  actions: {
    async load({ force = false } = {}) {
      this.loading = this.revision === null
      try {
        const data = await backend.bootstrap(!force ? this.revision : null)
        if (!data.unchanged) {
          // Les lignes de l'ancien Apps Script sont complétées à la lecture, quel que soit le backend.
          const { projects, tasks } = normalizeAll(data, data.settings)
          Object.assign(this, data, { projects, tasks })
        }
        this.revision = data.revision
        this.error = null
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    startPolling() {
      const refresh = () => document.visibilityState === 'visible' && this.pendingWrites === 0 && this.load()
      setInterval(refresh, POLL_MS)
      document.addEventListener('visibilitychange', refresh)
    },

    /** Écriture optimiste d'une entité existante ; lève l'ApiError (409 si conflit) après avoir rétabli l'état. */
    async save(collection, item, changes, call) {
      const list = this[collection]
      const index = list.findIndex((x) => x.id === item.id)
      const previous = list[index]
      list.splice(index, 1, { ...previous, ...changes })
      this.pendingWrites++
      try {
        const saved = await call(previous.version)
        const i = list.findIndex((x) => x.id === item.id)
        if (saved.archived) list.splice(i, 1)
        else list.splice(i, 1, saved)
        return saved
      } catch (e) {
        const i = list.findIndex((x) => x.id === item.id)
        list.splice(i, 1, e.isConflict && e.current ? e.current : previous)
        throw e
      } finally {
        this.pendingWrites--
      }
    },

    async create(collection, input, call) {
      const tempId = `tmp-${crypto.randomUUID()}`
      this[collection].unshift({ ...input, id: tempId, version: 0, pending: true })
      this.pendingWrites++
      try {
        const created = await call()
        this[collection].splice(this[collection].findIndex((x) => x.id === tempId), 1, created)
        return created
      } catch (e) {
        this[collection] = this[collection].filter((x) => x.id !== tempId)
        throw e
      } finally {
        this.pendingWrites--
      }
    },

    createTask(input) {
      return this.create('tasks', input, async () => (await backend.createTask(input)).task)
    },
    updateTask(task, changes) {
      return this.save('tasks', task, changes, async (v) => (await backend.updateTask(task.id, changes, v)).task)
    },
    archiveTask(task) {
      return this.save('tasks', task, {}, async (v) => (await backend.archiveTask(task.id, v)).task)
    },
    updateProject(project, changes) {
      return this.save('projects', project, changes, async (v) => (await backend.updateProject(project.id, changes, v)).project)
    },
    createDeliverable(input) {
      return this.create('deliverables', input, async () => (await backend.createDeliverable(input)).deliverable)
    },
    updateDeliverable(deliverable, changes) {
      return this.save('deliverables', deliverable, changes, async (v) => (await backend.updateDeliverable(deliverable.id, changes, v)).deliverable)
    },
    setMilestone(deliverable, action, field, body) {
      const changes = { [field]: body.undo ? '' : body.date }
      return this.save('deliverables', deliverable, changes, async (v) => (await backend.deliverableMilestone(deliverable.id, action, body, v)).deliverable)
    },
  },
})
