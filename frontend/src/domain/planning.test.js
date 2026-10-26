import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGantt, calendarEvents, isoWeek, monthGrid, shiftMonth, taskSchedule, timelineRange, undatedItems } from './planning.js'

const project = { id: 'P-1', name: 'Site carrière' }
const deliverables = [
  { id: 'D-1', projectId: 'P-1', name: 'Landing', validatedAt: '2026-10-22' },
  { id: 'D-2', projectId: 'P-1', name: 'Page Corpo' },
]
const tasks = [
  { id: 'T-1', projectId: 'P-1', deliverableId: 'D-1', title: 'Texte', startDate: '2026-10-19', deadline: '2026-10-23' },
  { id: 'T-2', projectId: 'P-1', deliverableId: 'D-1', title: 'Photos', deadline: '2026-11-03' },
  { id: 'T-3', projectId: 'P-1', deliverableId: 'D-2', title: 'Template', startDate: '2026-10-22', deadlineText: 'Fin octobre' },
  { id: 'T-4', projectId: 'P-1', deliverableId: 'D-2', title: 'SEO', deadlineText: 'A définir' },
]

test('une tâche sans début n\'a pas de barre, seulement son échéance', () => {
  assert.deepEqual(taskSchedule(tasks[0]), { kind: 'range', start: '2026-10-19', end: '2026-10-23' })
  assert.deepEqual(taskSchedule(tasks[1]), { kind: 'deadline', start: '2026-11-03', end: '2026-11-03' })
  assert.equal(taskSchedule(tasks[2]).kind, 'start')
  assert.equal(taskSchedule(tasks[3]).kind, 'none')
})

test('le Gantt ne contient que les éléments datés, et l\'étendue vient des dates réelles', () => {
  const [group] = buildGantt({ projects: [project], deliverables, tasks })
  assert.equal(group.children.length, 2)
  assert.deepEqual(group.children[0].rows.map((r) => r.task.id), ['T-1', 'T-2'])
  assert.deepEqual(group.children[0].span, { start: '2026-10-19', end: '2026-11-03' })
  assert.deepEqual(group.children[1].rows.map((r) => r.task.id), ['T-3'])
  assert.deepEqual(group.span, { start: '2026-10-19', end: '2026-11-03' })
})

test('un projet sans aucune date n\'apparaît pas dans le Gantt', () => {
  assert.deepEqual(buildGantt({ projects: [{ id: 'P-2' }], deliverables: [], tasks: [{ id: 'T-9', projectId: 'P-2', title: 'x' }] }), [])
})

test('« Dates à préciser » reprend l\'indication libre sauf « A définir »', () => {
  const { tasks: undated, deliverables: undatedDeliverables } = undatedItems({ deliverables, tasks })
  assert.deepEqual(undated.map((u) => [u.task.id, u.hint, u.hasStart]), [['T-3', 'Fin octobre', true], ['T-4', '', false]])
  assert.deepEqual(undatedDeliverables.map((d) => d.id), ['D-2'])
})

test('la période commence un lundi et inclut aujourd\'hui', () => {
  const range = timelineRange(buildGantt({ projects: [project], deliverables, tasks }), '2026-10-26')
  assert.equal(new Date(`${range.start}T00:00:00Z`).getUTCDay(), 1)
  assert.ok(range.start <= '2026-10-12' && range.end >= '2026-11-10')
})

test('calendrier : événements et grille du mois', () => {
  const kinds = calendarEvents({ projects: [project], deliverables, tasks }).map((e) => `${e.date} ${e.kind}`)
  assert.ok(kinds.includes('2026-10-22 deliverable-validatedAt'))
  assert.ok(kinds.includes('2026-10-22 task-start'))
  const grid = monthGrid('2026-10')
  assert.equal(grid[0][0].iso, '2026-09-28')
  assert.ok(grid.flat().filter((d) => d.inMonth).length === 31)
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(isoWeek('2026-10-26'), 44)
})
