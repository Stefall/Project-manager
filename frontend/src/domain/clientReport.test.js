import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport } from './reports.js'
import { clientReportName, renderClientReport } from './clientReport.js'

const projects = [{ id: 'P-1', name: 'Site carrière', client: 'Eureden', situation: 'Hub en ligne <ok>', nextSteps: ['Recette'], watchpoints: ['Budget interne serré'] }]
const deliverables = [{ id: 'D-1', projectId: 'P-1', name: 'Hub', validatedAt: '2026-10-22' }]
const tasks = [
  { id: 'T-1', projectId: 'P-1', deliverableId: 'D-1', title: 'Template', status: 'Terminé', completedAt: '2026-10-12T09:00:00Z', poles: ['ux-ui'] },
  { id: 'T-2', projectId: 'P-1', deliverableId: 'D-1', title: 'SEO', status: 'Bloqué', note: 'Client en retard sur les textes', poles: ['seo'] },
]
const content = buildReport({ month: '2026-10', projectId: 'P-1', projects, deliverables, tasks, events: [], poles: [{ id: 'seo', label: 'SEO' }, { id: 'ux-ui', label: 'UX / UI' }], generatedAt: '2026-10-31T12:00:00Z' })
const meta = { number: 2, createdAt: '2026-10-31T12:00:00Z', comment: 'Merci pour vos retours' }
const html = renderClientReport(content, meta)

test('bilan client : nom du document', () => {
  assert.equal(clientReportName(content, meta), 'Bilan Eureden · Site carrière · Octobre 2026 (v2)')
})

test('bilan client : contenu attendu, texte échappé', () => {
  for (const s of ['Site carrière', 'Hub en ligne &lt;ok&gt;', 'Recette', '✓ Validé le 22 oct.', 'Template', '12 oct.', 'Bloqué', 'SEO', 'Merci pour vos retours']) assert.ok(html.includes(s), s)
})

test('bilan client : ni notes internes ni points de vigilance', () => {
  assert.ok(!html.includes('Client en retard'))
  assert.ok(!html.includes('Budget interne'))
})
