// Bilan mensuel reconstitué à partir de l'historique (onglet EVENTS), puis figé tel quel dans REPORTS.
// Une tâche terminée, un livrable validé, livré ou publié sont trois faits distincts, chacun daté.

const DONE = 'Terminé'

const MILESTONES = [
  { key: 'validated', type: 'deliverable.validated', field: 'validatedAt', legacy: 'validation', label: 'Livrables validés' },
  { key: 'delivered', type: 'deliverable.delivered', field: 'deliveredAt', label: 'Livrables livrés' },
  { key: 'published', type: 'deliverable.published', field: 'publishedAt', label: 'Livrables publiés' },
]
export const MILESTONE_LABELS = Object.fromEntries(MILESTONES.map((m) => [m.key, m.label]))

const day = (iso) => (iso || '').slice(0, 10)
const inMonth = (iso, month) => Boolean(iso) && iso.startsWith(month)

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

/** Libellés lisibles des types d'événements, y compris ceux de l'ancien outil. */
export const EVENT_LABELS = {
  'task.created': 'Tâche créée',
  'task.updated': 'Tâche modifiée',
  'task.status_changed': 'Statut modifié',
  'task.completed': 'Tâche terminée',
  'task.archived': 'Tâche archivée',
  'deliverable.created': 'Livrable créé',
  'deliverable.updated': 'Livrable modifié',
  'deliverable.archived': 'Livrable archivé',
  'deliverable.validated': 'Livrable validé',
  'deliverable.delivered': 'Livrable livré',
  'deliverable.published': 'Livrable publié',
  'deliverable.validated.cancelled': 'Validation annulée',
  'deliverable.delivered.cancelled': 'Livraison annulée',
  'deliverable.published.cancelled': 'Publication annulée',
  'project.updated': 'Projet modifié',
  'project.situation_updated': 'Situation mise à jour',
  'report.frozen': 'Bilan figé',
  validation: 'Validation (ancien outil)',
  modification: 'Modification (ancien outil)',
  archive: 'Archivage (ancien outil)',
}

/** Événements d'un mois, du plus récent au plus ancien, éventuellement limités à un projet. */
export function eventsOf(events, { month, projectId = '' }) {
  return events
    .filter((e) => inMonth(e.date, month) && (!projectId || e.projectId === projectId))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Jalons de livrables atteints dans le mois. Sources, dans l'ordre :
 * événements du nouvel outil (date effective, sauf s'ils ont été annulés ensuite),
 * événements « validation » de l'ancien outil, puis date enregistrée sur le livrable (import).
 */
function milestonesOf(m, { month, events, deliverables }) {
  const byId = Object.fromEntries(deliverables.map((d) => [d.id, d]))
  const byName = (projectId, name) => deliverables.find((d) => d.projectId === projectId && d.name === name)
  const found = new Map()
  const add = (deliverable, date, source) => {
    if (!deliverable || found.has(deliverable.id) || !inMonth(date, month)) return
    found.set(deliverable.id, { id: deliverable.id, name: deliverable.name, projectId: deliverable.projectId, date: day(date), source })
  }
  const cancelled = new Set(events.filter((e) => e.type === `${m.type}.cancelled`).map((e) => `${e.deliverableId}|${day(e.effectiveDate)}`))
  for (const e of events) {
    if (e.type === m.type && !cancelled.has(`${e.deliverableId}|${day(e.effectiveDate)}`)) add(byId[e.deliverableId], e.effectiveDate || e.date, 'historique')
    if (m.legacy && e.type === m.legacy) add(byName(e.projectId, e.deliverable), e.date, 'ancien outil')
  }
  // Un jalon annulé par la suite ne figure plus sur le livrable : seule la date actuelle compte ici.
  for (const d of deliverables) if (d[m.field]) add(d, d[m.field], 'fiche livrable')
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}

function completedTasksOf({ month, events, tasks }) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]))
  const found = new Map()
  const add = (id, date) => {
    const t = byId[id]
    if (!t || found.has(id) || !inMonth(date, month)) return
    found.set(id, { id, title: t.title, projectId: t.projectId, deliverable: t.deliverable || '', date: day(date), reopened: t.status !== DONE })
  }
  for (const e of events) if (e.type === 'task.completed') add(e.entity, e.date)
  for (const t of tasks) if (t.completedAt) add(t.id, t.completedAt)
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Contenu complet d'un bilan, autonome : il ne référence rien qui pourrait changer ensuite,
 * de sorte qu'une version figée se relit à l'identique.
 */
export function buildReport({ month, projectId = '', projects, deliverables, tasks, events, generatedAt = new Date().toISOString() }) {
  const scope = projects.filter((p) => !p.archived && (!projectId || p.id === projectId))
  const ids = new Set(scope.map((p) => p.id))
  const scoped = (list) => list.filter((x) => ids.has(x.projectId))
  const monthEvents = eventsOf(scoped(events), { month })
  const scopeDeliverables = scoped(deliverables)
  const scopeTasks = scoped(tasks)
  const nextMonth = shiftMonth(month, 1)
  const open = scopeTasks.filter((t) => t.status !== DONE)
  const light = (t) => ({ id: t.id, title: t.title, projectId: t.projectId, deliverable: t.deliverable || '', note: t.note || '' })

  return {
    month,
    projectId,
    generatedAt,
    projects: scope.map((p) => ({
      id: p.id, name: p.name, client: p.client || '', situation: p.situation || '',
      nextSteps: p.nextSteps ?? [], watchpoints: p.watchpoints ?? [],
    })),
    milestones: Object.fromEntries(MILESTONES.map((m) => [m.key, milestonesOf(m, { month, events: scoped(events), deliverables: scopeDeliverables })])),
    completedTasks: completedTasksOf({ month, events: scoped(events), tasks: scopeTasks }),
    activity: {
      created: monthEvents.filter((e) => e.type === 'task.created').length,
      statusChanges: monthEvents.filter((e) => e.type === 'task.status_changed' || e.type === 'task.completed').length,
      total: monthEvents.length,
    },
    // Situation au moment de la génération : figée avec le bilan.
    snapshot: {
      blocked: open.filter((t) => t.status === 'Bloqué').map(light),
      waiting: open.filter((t) => t.status === 'En attente').map(light),
      inProgress: open.filter((t) => t.status === 'En cours').length,
      todo: open.filter((t) => t.status === 'À faire').length,
      done: scopeTasks.length - open.length,
      total: scopeTasks.length,
    },
    upcoming: open
      // Échéances à venir, de la date de génération à la fin du mois suivant.
      .filter((t) => t.deadline && t.deadline >= day(generatedAt) && t.deadline.slice(0, 7) <= nextMonth)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map((t) => ({ ...light(t), deadline: t.deadline })),
    // Faits marquants du mois (les simples modifications restent dans l'historique), bornés pour tenir dans une cellule du Sheet.
    timeline: monthEvents
      .filter((e) => e.type !== 'task.updated' && e.type !== 'modification' && e.type !== 'report.frozen')
      .slice(0, 150)
      .map((e) => ({ date: e.date, type: e.type, description: (e.description || EVENT_LABELS[e.type] || e.type).split('\n')[0].slice(0, 160), author: e.author || '', projectId: e.projectId || '' })),
  }
}

/** Versions figées d'un mois et d'un périmètre, la plus récente d'abord. */
export function versionsOf(reports, { month, projectId = '' }) {
  return reports.filter((r) => r.month === month && (r.projectId || '') === projectId).sort((a, b) => (b.number || 0) - (a.number || 0))
}

/** Numéro de la prochaine version figée (« number » : « version » sert au contrôle des modifications concurrentes). */
export function nextNumber(reports, scope) {
  return (versionsOf(reports, scope)[0]?.number || 0) + 1
}
