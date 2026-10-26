import { computed } from 'vue'

const DAY = 86_400_000

/** Indicateurs calculés à partir d'une liste de tâches (avancement = tâches terminées / total). */
export function useTaskStats(tasks) {
  return computed(() => {
    const list = tasks.value
    const today = new Date().toISOString().slice(0, 10)
    const inAWeek = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10)
    const count = (status) => list.filter((t) => t.status === status).length
    const open = list.filter((t) => t.status !== 'Terminé')
    const done = count('Terminé')
    return {
      total: list.length,
      todo: count('À faire'),
      progress: count('En cours'),
      waiting: count('En attente'),
      blocked: count('Bloqué'),
      done,
      percent: list.length ? Math.round((done / list.length) * 100) : 0,
      late: open.filter((t) => t.deadline && t.deadline < today),
      soon: open.filter((t) => t.deadline && t.deadline >= today && t.deadline <= inAWeek).sort((a, b) => a.deadline.localeCompare(b.deadline)),
      undated: open.filter((t) => !t.deadline),
    }
  })
}

export function formatDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
