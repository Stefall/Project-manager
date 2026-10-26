import { DONE } from './settings'

// Champs qu'un formulaire peut modifier ; identique à TasksController::FIELDS côté PHP.
export const TASK_FIELDS = [
  'projectId', 'deliverableId', 'title', 'description', 'status', 'priority', 'poles',
  'startDate', 'deadline', 'deadlineText', 'note', 'checklist', 'links',
]

const isDate = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)))

/** Renvoie { champ: message } ; vide si la tâche est valide. */
export function validateTask(task, { projects, deliverables, settings }) {
  const errors = {}
  if (!task.title?.trim()) errors.title = 'Champ obligatoire.'
  else if (task.title.length > 200) errors.title = '200 caractères maximum.'
  if (!projects.some((p) => p.id === task.projectId)) errors.projectId = 'Choisissez un projet.'
  if (!settings.statuses.some((s) => s.id === task.status)) errors.status = 'Statut inconnu.'
  if (!settings.priorities.includes(task.priority)) errors.priority = 'Priorité inconnue.'
  if ((task.poles ?? []).some((p) => !settings.poles.some((s) => s.id === p))) errors.poles = 'Pôle inconnu.'
  if (!isDate(task.startDate)) errors.startDate = 'Date invalide.'
  if (!isDate(task.deadline)) errors.deadline = 'Date invalide.'
  if (task.startDate && task.deadline && task.startDate > task.deadline) errors.startDate = 'La date de début doit précéder la deadline.'
  if (task.deliverableId && !deliverables.some((d) => d.id === task.deliverableId && d.projectId === task.projectId)) {
    errors.deliverableId = 'Ce livrable n\'appartient pas au projet.'
  }
  return errors
}

/** Événement à journaliser ; une tâche n'est « réalisée » que via task.completed. */
export function taskEvent(before, after) {
  const changes = {}
  for (const field of TASK_FIELDS) {
    if (JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null)) {
      changes[field] = { before: before[field] ?? null, after: after[field] ?? null }
    }
  }
  if (!Object.keys(changes).length) return null
  const base = { entityType: 'task', projectId: after.projectId ?? '', deliverableId: after.deliverableId ?? '', changes }
  if (changes.status) {
    if (after.status === DONE) return { ...base, type: 'task.completed', description: `Tâche terminée : ${after.title}` }
    return { ...base, type: 'task.status_changed', description: `${after.title} : ${before.status} → ${after.status}` }
  }
  return { ...base, type: 'task.updated', description: `Tâche modifiée : ${after.title}` }
}

export function nextId(prefix, existing, pad = 3) {
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  const max = existing.reduce((m, id) => Math.max(m, Number(re.exec(id)?.[1] ?? 0)), 0)
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`
}

export function pick(obj, fields) {
  return Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f]]))
}
