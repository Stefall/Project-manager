import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildOverview, buildRecap, mondayOf, renderRecap, shortDate } from './recap.js'

const settings = { poles: [{ id: 'ux-ui', label: 'UX / UI' }, { id: 'seo', label: 'SEO' }, { id: 'dev', label: 'Dev' }] }
const tanguy = { id: 'PE-1', name: 'Tanguy Martin', email: 'tanguy@vlt.fr' }
const projects = [
  { id: 'P-1', name: 'Site carrière', client: 'Eureden', team: { 'ux-ui': ['PE-1'], seo: ['PE-2'] } },
  { id: 'P-2', name: 'Mobilité', client: 'Eureden', team: { seo: ['PE-1'] }, status: 'Terminé' },
  { id: 'P-3', name: 'Rapport', client: 'X', team: {} },
]
const deliverables = [{ id: 'D-1', projectId: 'P-1', name: 'Landing', dueDate: '2026-11-13' }, { id: 'D-2', projectId: 'P-1', name: 'Hub', dueDate: '2026-11-20' }]
const T = (id, extra) => ({ id, projectId: 'P-1', poles: ['ux-ui'], status: 'À faire', title: id, ...extra })
const tasks = [
  T('late', { deadline: '2026-11-05', status: 'Bloqué' }),
  T('tue', { deadline: '2026-11-10', deliverableId: 'D-1' }),
  T('mon', { deadline: '2026-11-09' }),
  T('next-week', { deadline: '2026-11-17' }),
  T('waiting', { status: 'En attente', note: 'Retour client', deadlineText: 'Semaine 46' }),
  T('ongoing', { status: 'En cours' }),
  T('done', { status: 'Terminé', deadline: '2026-11-10' }),
  T('seo-only', { poles: ['seo'], deadline: '2026-11-10' }),
  T('closed-project', { projectId: 'P-2', poles: ['seo'], deadline: '2026-11-10' }),
]
const today = '2026-11-09'

test('semaine du lundi au dimanche, dates sans fuseau', () => {
  assert.equal(mondayOf('2026-11-12'), '2026-11-09')
  assert.equal(mondayOf('2026-11-09'), '2026-11-09')
  assert.equal(mondayOf('2026-11-15'), '2026-11-09')
  assert.equal(shortDate('2026-02-01'), '1 févr.')
})

test('récap : seulement les tâches de ses pôles, sur ses projets en cours, chacune une fois', () => {
  const r = buildRecap({ person: tanguy, projects, deliverables, tasks, settings, today })
  assert.deepEqual(r.late.map((t) => t.id), ['late'])
  assert.deepEqual(r.days.map((d) => [d.label, d.tasks.map((t) => t.id)]), [['lundi 9 nov.', ['mon']], ['mardi 10 nov.', ['tue']]])
  assert.deepEqual(r.waiting.map((t) => t.id), ['waiting'])
  assert.deepEqual(r.ongoing.map((t) => t.id), ['ongoing'])
  assert.deepEqual(r.milestones.map((m) => m.id), ['D-1'])
  assert.equal(r.days[1].tasks[0].deliverable, 'Landing')
  assert.deepEqual(r.projects.map((p) => p.id), ['P-1'])
  assert.equal(r.subject, 'VLT · Ta semaine du 9 nov. : 1 en retard, 2 à rendre, 1 bloquée(s) ou en attente')
  assert.equal(r.empty, false)
})

test('personne sans tâche : récap vide, pas d\'e-mail', () => {
  const r = buildRecap({ person: { id: 'PE-9', name: 'Zoé' }, projects, deliverables, tasks, settings, today })
  assert.equal(r.empty, true)
})

test('vue d\'ensemble : retards, blocages et pôles sans personne', () => {
  const o = buildOverview({ projects, tasks, settings, today })
  assert.deepEqual(o.map((p) => [p.id, p.late, p.blocked, p.waiting, p.orphans]), [['P-1', 1, 1, 1, []]])
  const o2 = buildOverview({ projects, tasks: [...tasks, T('dev', { poles: ['dev'] })], settings, today })
  assert.deepEqual(o2[0].orphans, ['Dev'])
})

test('e-mail : liens vers chaque tâche, texte échappé, version texte', () => {
  const r = buildRecap({ person: tanguy, projects, deliverables, tasks: [...tasks, T('<script>', { deadline: '2026-11-11' })], settings, today })
  const mail = renderRecap(r, { appUrl: 'https://stefall.github.io/Project-manager/' })
  assert.match(mail.html, /Bonjour Tanguy,/)
  assert.match(mail.html, /#\/projets\/P-1\?tache=mon/)
  assert.ok(!mail.html.includes('<script>'))
  assert.match(mail.html, /&lt;script&gt;/)
  assert.match(mail.text, /EN RETARD \(1\)/)
  assert.match(mail.text, /Retour client|Semaine 46|waiting/)
})
