import { defineStore } from 'pinia'
import { api } from '@/api/client'

const POLL_MS = 30_000

/**
 * Données métier chargées en un appel (/bootstrap) puis rafraîchies quand la révision du Sheet change.
 * Les créations sont optimistes : la tâche apparaît tout de suite, puis est remplacée par la réponse du serveur.
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
    deliverablesFor: (s) => (projectId) => s.deliverables.filter((d) => d.projectId === projectId && !d.archived),
    tasksFor: (s) => (projectId) => (projectId ? s.tasks.filter((t) => t.projectId === projectId) : s.tasks),
    poleLabel: (s) => (id) => s.settings.poles.find((p) => p.id === id)?.label ?? id,
  },

  actions: {
    async load({ force = false } = {}) {
      this.loading = this.revision === null
      try {
        const query = !force && this.revision !== null ? `?since=${this.revision}` : ''
        const data = await api.get(`/bootstrap${query}`)
        if (!data.unchanged) Object.assign(this, data)
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

    async createTask(input) {
      const tempId = `tmp-${crypto.randomUUID()}`
      this.tasks.unshift({ ...input, id: tempId, version: 0, pending: true })
      this.pendingWrites++
      try {
        const { task } = await api.post('/tasks', input)
        this.tasks.splice(this.tasks.findIndex((t) => t.id === tempId), 1, task)
        return task
      } catch (e) {
        this.tasks = this.tasks.filter((t) => t.id !== tempId)
        throw e
      } finally {
        this.pendingWrites--
      }
    },

    /** Lève une ApiError 409 si quelqu'un a modifié la tâche entre-temps ; e.current contient sa version actuelle. */
    async updateTask(task, changes) {
      const index = this.tasks.findIndex((t) => t.id === task.id)
      const previous = this.tasks[index]
      this.tasks.splice(index, 1, { ...previous, ...changes })
      this.pendingWrites++
      try {
        const { task: saved } = await api.patch(`/tasks/${task.id}`, changes, previous.version)
        this.tasks.splice(index, 1, saved)
        return saved
      } catch (e) {
        this.tasks.splice(index, 1, e.isConflict && e.current ? e.current : previous)
        throw e
      } finally {
        this.pendingWrites--
      }
    },
  },
})
