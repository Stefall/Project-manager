import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compactTeam, initials, orphanPoles, peopleOfTask, tasksOfPerson, teamMembers, validatePerson, validateTeam } from './team.js'

const settings = { poles: [{ id: 'ux-ui' }, { id: 'seo' }, { id: 'dev' }] }
const people = [{ id: 'PE-001', name: 'Tanguy', email: 'tanguy@vlt.fr' }, { id: 'PE-002', name: 'Enapse', email: 'enapse@gmail.com' }]
const project = { id: 'P-1', team: { 'ux-ui': ['PE-001', 'PE-002'], seo: ['PE-002'] } }
const tasks = [
  { id: 'T-1', projectId: 'P-1', poles: ['ux-ui'] },
  { id: 'T-2', projectId: 'P-1', poles: ['seo'] },
  { id: 'T-3', projectId: 'P-1', poles: ['dev'] },
  { id: 'T-4', projectId: 'P-2', poles: ['ux-ui'] },
]

test('une tâche concerne toutes les personnes qui tiennent un de ses pôles sur son projet', () => {
  assert.deepEqual(peopleOfTask(tasks[0], project), ['PE-001', 'PE-002'])
  assert.deepEqual(peopleOfTask(tasks[2], project), [])
  assert.deepEqual(tasksOfPerson('PE-002', tasks, [project]).map((t) => t.id), ['T-1', 'T-2'])
  assert.deepEqual(tasksOfPerson('PE-001', tasks, [project, { id: 'P-2' }]).map((t) => t.id), ['T-1'])
})

test('membres du projet avec leurs pôles, et pôles orphelins', () => {
  assert.deepEqual(teamMembers(project, people).map((m) => `${m.name}:${m.projectPoles.join('+')}`), ['Tanguy:ux-ui', 'Enapse:ux-ui+seo'])
  assert.deepEqual(orphanPoles(project, tasks), ['dev'])
})

test('validation de l\'équipe et de l\'annuaire', () => {
  assert.equal(validateTeam(project.team, { people, settings }), null)
  assert.match(validateTeam({ print: ['PE-001'] }, { people, settings }), /Pôle inconnu/)
  assert.match(validateTeam({ seo: ['PE-404'] }, { people, settings }), /Personne inconnue/)
  assert.match(validateTeam({ seo: ['PE-001', 'PE-001'] }, { people, settings }), /invalide/)
  assert.equal(validatePerson({ name: 'T', email: 'TANGUY@vlt.fr' }, { people, settings }).email, 'Cette personne existe déjà.')
  assert.deepEqual(validatePerson({ name: 'Marie', email: 'marie@vlt.fr', poles: ['seo'] }, { people, settings }), {})
  assert.deepEqual(compactTeam({ seo: [], dev: ['PE-1'] }), { dev: ['PE-1'] })
  assert.equal(initials('Jean-Marc Dupont'), 'JM')
})
