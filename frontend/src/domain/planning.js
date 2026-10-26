// Calcul du planning (Gantt et calendrier) à partir des dates réellement saisies.
// Règle : aucune date n'est déduite ni inventée. Une tâche sans début n'a pas de barre,
// seulement son échéance ; une tâche sans aucune date va dans « Dates à préciser ».

const DAY = 86_400_000

/** Date ISO (AAAA-MM-JJ) vers un nombre de jours depuis l'époque, en UTC pour éviter les décalages d'heure d'été. */
export const toDay = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY)
export const fromDay = (n) => new Date(n * DAY).toISOString().slice(0, 10)
export const addDays = (iso, n) => fromDay(toDay(iso) + n)
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Place d'une tâche sur le planning :
 * - range : début et échéance saisis, une barre ;
 * - deadline : échéance seule, un repère (le début n'est pas connu) ;
 * - start : début seul, un repère de démarrage (l'échéance est à préciser) ;
 * - none : aucune date.
 */
export function taskSchedule(task) {
  const { startDate: start, deadline: end } = task
  if (start && end) return { kind: 'range', start, end }
  if (end) return { kind: 'deadline', start: end, end }
  if (start) return { kind: 'start', start, end: start }
  return { kind: 'none' }
}

const MILESTONE_FIELDS = [
  ['validatedAt', 'Validé'],
  ['deliveredAt', 'Livré'],
  ['publishedAt', 'Publié'],
]

/** Repères d'un livrable : échéance prévue et jalons atteints, chacun avec sa date réelle. */
export function deliverableMarks(deliverable) {
  const marks = []
  if (deliverable.dueDate) marks.push({ type: 'due', date: deliverable.dueDate, label: 'Échéance' })
  for (const [field, label] of MILESTONE_FIELDS) {
    if (deliverable[field]) marks.push({ type: field, date: deliverable[field], label })
  }
  return marks
}

/** Étendue réelle d'un ensemble de tâches et de repères ; null si rien n'est daté. */
function span(schedules, marks = []) {
  const dates = [
    ...schedules.filter((s) => s.kind !== 'none').flatMap((s) => [s.start, s.end]),
    ...marks.map((m) => m.date),
  ].sort()
  return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null
}

/**
 * Lignes du Gantt, regroupées projet → livrable → tâches.
 * Seuls les éléments ayant au moins une date apparaissent ; les autres sont listés par undatedItems().
 * L'étendue d'un livrable ou d'un projet est celle de ses éléments datés : elle n'est jamais extrapolée.
 */
export function buildGantt({ projects, deliverables, tasks }) {
  const groups = []
  for (const project of projects) {
    const projectTasks = tasks.filter((t) => t.projectId === project.id)
    const children = []
    const lots = [
      ...deliverables.filter((d) => d.projectId === project.id && !d.archived).map((d) => ({ deliverable: d, tasks: projectTasks.filter((t) => t.deliverableId === d.id) })),
      { deliverable: null, tasks: projectTasks.filter((t) => !t.deliverableId) },
    ]
    for (const { deliverable, tasks: lotTasks } of lots) {
      const rows = lotTasks.map((task) => ({ task, schedule: taskSchedule(task) })).filter((r) => r.schedule.kind !== 'none')
      rows.sort((a, b) => a.schedule.start.localeCompare(b.schedule.start) || a.task.title.localeCompare(b.task.title))
      const marks = deliverable ? deliverableMarks(deliverable) : []
      if (!rows.length && !marks.length) continue
      children.push({ deliverable, marks, rows, span: span(rows.map((r) => r.schedule), marks) })
    }
    const projectSpan = project.startDate && project.endDate
      ? { start: project.startDate, end: project.endDate, declared: true }
      : span(children.map((c) => ({ kind: 'range', ...c.span })), [project.startDate, project.endDate].filter(Boolean).map((date) => ({ date })))
    if (!children.length && !projectSpan) continue
    groups.push({ project, children, span: projectSpan })
  }
  return groups
}

/** Période affichée : toutes les dates du planning et aujourd'hui, avec une marge, alignée sur des lundis. */
export function timelineRange(groups, today = todayIso(), margin = 7) {
  const dates = [today, ...groups.flatMap((g) => (g.span ? [g.span.start, g.span.end] : []))].sort()
  const monday = (iso) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7))
  const start = monday(addDays(dates[0], -margin))
  const end = addDays(monday(addDays(dates[dates.length - 1], margin)), 6)
  return { start, end, days: toDay(end) - toDay(start) + 1 }
}

/** Semaines (lundi) et mois de la période, pour les en-têtes du Gantt. */
export function timelineScale({ start, days }) {
  const weeks = []
  const months = []
  for (let i = 0; i < days; i++) {
    const iso = addDays(start, i)
    const d = new Date(`${iso}T00:00:00Z`)
    if (d.getUTCDay() === 1) weeks.push({ iso, offset: i, number: isoWeek(iso) })
    const key = iso.slice(0, 7)
    if (!months.length || months[months.length - 1].key !== key) months.push({ key, offset: i, days: 0 })
    months[months.length - 1].days++
  }
  return { weeks, months }
}

export function isoWeek(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d - firstThursday) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

/** Éléments sans date utilisable, avec l'indication libre de l'ancien outil (« Semaine 42 », « Fin octobre »). */
export function undatedItems({ deliverables, tasks }) {
  return {
    tasks: tasks.filter((t) => !t.deadline).map((t) => ({ task: t, hint: t.deadlineText && !/^a d[ée]finir$/i.test(t.deadlineText.trim()) ? t.deadlineText : '', hasStart: Boolean(t.startDate) })),
    deliverables: deliverables.filter((d) => !d.archived && !d.dueDate && !d.validatedAt && !d.deliveredAt && !d.publishedAt),
  }
}

/** Événements datés d'un mois pour le calendrier : échéances de tâches, débuts, repères de livrables et de projets. */
export function calendarEvents({ projects, deliverables, tasks }) {
  const events = []
  for (const task of tasks) {
    if (task.deadline) events.push({ date: task.deadline, kind: 'task-deadline', task, projectId: task.projectId })
    if (task.startDate) events.push({ date: task.startDate, kind: 'task-start', task, projectId: task.projectId })
  }
  for (const deliverable of deliverables.filter((d) => !d.archived)) {
    for (const mark of deliverableMarks(deliverable)) events.push({ date: mark.date, kind: `deliverable-${mark.type}`, label: mark.label, deliverable, projectId: deliverable.projectId })
  }
  for (const project of projects) {
    if (project.startDate) events.push({ date: project.startDate, kind: 'project-start', project, projectId: project.id })
    if (project.endDate) events.push({ date: project.endDate, kind: 'project-end', project, projectId: project.id })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}

/** Grille d'un mois (semaines du lundi au dimanche), month au format AAAA-MM. */
export function monthGrid(month) {
  const first = `${month}-01`
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const start = addDays(first, -offset)
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(start, w * 7 + i)
      return { iso, inMonth: iso.startsWith(month) }
    })
    if (w > 3 && !days.some((d) => d.inMonth)) break
    weeks.push(days)
  }
  return weeks
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
