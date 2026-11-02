import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, eventsOf, nextNumber, versionsOf } from './reports.js'

const projects = [{ id: 'P-1', name: 'Site carrière', client: 'Eureden', nextSteps: ['Caler la recette'] }, { id: 'P-2', name: 'Mobilité' }]
const deliverables = [
  { id: 'D-1', projectId: 'P-1', name: 'Landing TC', validatedAt: '2026-10-22' },
  { id: 'D-2', projectId: 'P-1', name: 'Hub', validatedAt: '' },
  { id: 'D-3', projectId: 'P-1', name: 'Page Corpo', deliveredAt: '2026-10-28' },
  { id: 'D-4', projectId: 'P-2', name: 'Site mobilité', publishedAt: '2026-10-05' },
]
const tasks = [
  { id: 'T-1', projectId: 'P-1', title: 'Texte', status: 'Terminé', completedAt: '2026-10-12T09:00:00Z' },
  { id: 'T-2', projectId: 'P-1', title: 'Photos', status: 'Bloqué', note: 'Attente shooting' },
  { id: 'T-3', projectId: 'P-1', title: 'Intégration', status: 'En cours', deadline: '2026-11-04' },
  { id: 'T-4', projectId: 'P-1', title: 'Reprise', status: 'En cours' },
  { id: 'T-5', projectId: 'P-2', title: 'Cadrage', status: 'Terminé', completedAt: '2026-09-30T10:00:00Z' },
  { id: 'T-6', projectId: 'P-1', title: 'Ancienne', status: 'Terminé', completedAt: '' },
]
const events = [
  { type: 'validation', projectId: 'P-1', deliverable: 'Hub', date: '2026-10-22T10:13:27Z' },
  { type: 'validation', projectId: 'P-1', deliverable: 'Page Corpo', date: '2026-10-22T10:16:10Z' },
  { type: 'deliverable.validated.cancelled', projectId: 'P-1', deliverableId: 'D-3', effectiveDate: '2026-10-22', date: '2026-11-02T14:09:44Z' },
  { type: 'deliverable.delivered', projectId: 'P-1', deliverableId: 'D-3', effectiveDate: '2026-10-28', date: '2026-10-29T08:00:00Z', author: 'a@vlt.fr' },
  { type: 'deliverable.published', projectId: 'P-1', deliverableId: 'D-1', effectiveDate: '2026-10-20', date: '2026-10-20T08:00:00Z' },
  { type: 'deliverable.published.cancelled', projectId: 'P-1', deliverableId: 'D-1', effectiveDate: '2026-10-20', date: '2026-10-21T08:00:00Z' },
  { type: 'task.completed', projectId: 'P-1', entity: 'T-4', date: '2026-10-15T08:00:00Z', description: 'Tâche terminée : Reprise' },
  { type: 'task.created', projectId: 'P-1', entity: 'T-3', date: '2026-10-02T08:00:00Z' },
  { type: 'task.updated', projectId: 'P-1', entity: 'T-3', date: '2026-10-03T08:00:00Z' },
  { type: 'task.created', projectId: 'P-1', entity: 'T-9', date: '2026-09-02T08:00:00Z' },
]

const report = buildReport({ month: '2026-10', projectId: 'P-1', projects, deliverables, tasks, events, generatedAt: '2026-10-30T12:00:00Z' })

test('jalons reconstitués depuis l\'historique, l\'ancien outil et la fiche', () => {
  assert.deepEqual(report.milestones.validated.map((m) => [m.id, m.date, m.source]), [['D-2', '2026-10-22', 'ancien outil'], ['D-1', '2026-10-22', 'fiche livrable']])
  assert.deepEqual(report.milestones.delivered.map((m) => [m.id, m.source]), [['D-3', 'historique']])
})

test('une validation de l\'ancien outil annulée depuis n\'apparaît plus', () => {
  assert.ok(!report.milestones.validated.some((m) => m.id === 'D-3'))
})

test('tâches terminées sans date comptées à part', () => {
  assert.equal(report.undatedCompleted, 1)
  assert.ok(!report.completedTasks.some((t) => t.id === 'T-6'))
})

test('une publication annulée n\'apparaît pas', () => {
  assert.deepEqual(report.milestones.published, [])
})

test('tâches terminées dans le mois, rouverture signalée', () => {
  assert.deepEqual(report.completedTasks.map((t) => [t.id, t.date, t.reopened]), [['T-1', '2026-10-12', false], ['T-4', '2026-10-15', true]])
})

test('périmètre projet et mois respectés', () => {
  assert.deepEqual(report.projects.map((p) => p.id), ['P-1'])
  assert.equal(report.activity.created, 1)
  assert.ok(!report.timeline.some((e) => e.type === 'task.updated'))
  const all = buildReport({ month: '2026-10', projects, deliverables, tasks, events, generatedAt: '2026-10-30T12:00:00Z' })
  assert.deepEqual(all.milestones.published.map((m) => m.id), ['D-4'])
})

test('situation figée et échéances à venir', () => {
  assert.deepEqual(report.snapshot.blocked.map((t) => t.id), ['T-2'])
  assert.equal(report.snapshot.inProgress, 2)
  assert.deepEqual(report.upcoming.map((t) => t.id), ['T-3'])
})

test('historique du mois et versions', () => {
  assert.equal(eventsOf(events, { month: '2026-09' }).length, 1)
  const reports = [{ month: '2026-10', projectId: 'P-1', number: 1 }, { month: '2026-10', projectId: 'P-1', number: 2 }, { month: '2026-10', projectId: '', number: 1 }]
  assert.deepEqual(versionsOf(reports, { month: '2026-10', projectId: 'P-1' }).map((r) => r.number), [2, 1])
  assert.equal(nextNumber(reports, { month: '2026-10', projectId: 'P-1' }), 3)
  assert.equal(nextNumber(reports, { month: '2026-11' }), 1)
})

test('bilan par livrable : jalons du mois et tâches terminées, ancien outil sans date', () => {
  const tasks2 = [
    ...tasks.map((t) => ({ ...t, deliverableId: t.id === 'T-1' ? 'D-3' : '' })),
    { id: 'T-7', projectId: 'P-1', title: 'Cadrage hub', status: 'Terminé', completedAt: '', deliverable: 'Hub' },
  ]
  const r = buildReport({ month: '2026-10', projectId: 'P-1', projects, deliverables, tasks: tasks2, events, generatedAt: '2026-10-30T12:00:00Z' })
  const byId = Object.fromEntries(r.byDeliverable.map((d) => [d.id, d]))
  assert.deepEqual(byId['D-3'].milestones, [{ key: 'delivered', date: '2026-10-28' }])
  assert.deepEqual(byId['D-3'].tasks.map((t) => [t.id, t.date]), [['T-1', '2026-10-12']])
  assert.deepEqual(byId['D-2'].tasks.map((t) => [t.id, t.date]), [['T-7', '']])
  assert.deepEqual([byId['D-2'].done, byId['D-2'].total], [1, 1])
  assert.deepEqual(byId[''].tasks.map((t) => t.id), ['T-4'])
  assert.equal(r.byDeliverable.at(-1).id, '')
})

test('situation : tâches ouvertes par livrable, bloquées d\'abord, pôles en couleur', () => {
  const poles = [{ id: 'seo', label: 'SEO' }, { id: 'x', label: 'Autre / pôle' }]
  const tasks3 = tasks.map((t) => ({ ...t, deliverableId: t.id === 'T-3' || t.id === 'T-2' ? 'D-2' : '', poles: t.id === 'T-2' ? ['seo', 'x'] : [] }))
  const r = buildReport({ month: '2026-10', projectId: 'P-1', projects, deliverables, tasks: tasks3, events, poles, generatedAt: '2026-10-30T12:00:00Z' })
  const [hub, hors] = r.snapshot.byDeliverable
  assert.equal(hub.name, 'Hub')
  assert.deepEqual(hub.tasks.map((t) => [t.id, t.status]), [['T-2', 'Bloqué'], ['T-3', 'En cours']])
  assert.deepEqual(hub.tasks[0].poles.map((p) => [p.short, p.color]), [['SEO', '#2563eb'], ['Autre', '#a21caf']])
  assert.equal(hors.id, '')
})
