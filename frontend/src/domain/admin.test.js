import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicUser, selfChangeError, slug, validateClient, validateSetting, validateUser } from './admin.js'

const users = [{ id: 'U-001', email: 'Stephane@vlt.fr', name: 'Stéphane', role: 'admin' }]

test('un compte a un e-mail unique (sans tenir compte de la casse), un nom et un rôle', () => {
  assert.deepEqual(validateUser({ email: 'tanguy@vlt.fr', name: 'Tanguy', role: 'member' }, users), {})
  assert.equal(validateUser({ email: 'stephane@VLT.fr', name: 'X', role: 'member' }, users).email, 'Ce compte existe déjà.')
  assert.deepEqual(Object.keys(validateUser({ email: 'nope', name: ' ', role: 'boss' }, users)).sort(), ['email', 'name', 'role'])
  assert.deepEqual(validateUser({ ...users[0], name: 'Stéphane A.' }, users), {})
})

test('on ne peut ni se rétrograder ni se désactiver soi-même', () => {
  const me = users[0]
  assert.match(selfChangeError(me, me, { role: 'member' }), /propres droits/)
  assert.match(selfChangeError(me, me, { active: false }), /propre compte/)
  assert.equal(selfChangeError(me, me, { name: 'S.' }), null)
  assert.equal(selfChangeError(me, { id: 'U-002' }, { active: false }), null)
})

test('le hash de mot de passe ne sort jamais', () => {
  assert.deepEqual(publicUser({ id: 'U-1', passwordHash: 'x' }), { id: 'U-1' })
})

test('clients sans doublon', () => {
  const clients = [{ id: 'C-EUR', name: 'Eureden' }]
  assert.equal(validateClient({ name: ' eureden ' }, clients).name, 'Ce client existe déjà.')
  assert.deepEqual(validateClient({ id: 'C-EUR', name: 'Eureden' }, clients), {})
})

test('identifiant de pôle tiré du libellé', () => {
  assert.equal(slug('Motion design / Vidéo'), 'motion-design-video')
})

test('un pôle ou une priorité utilisé par une tâche ne peut pas disparaître', () => {
  const tasks = [{ poles: ['seo'], priority: 'Haute' }]
  const poles = [{ id: 'seo', label: 'SEO' }, { id: 'dev', label: 'Dev' }]
  assert.equal(validateSetting('poles', poles, tasks), null)
  assert.equal(validateSetting('poles', [{ id: 'seo', label: 'SEO', hidden: true }], tasks), null)
  assert.match(validateSetting('poles', [{ id: 'dev', label: 'Dev' }], tasks), /utilisé par des tâches/)
  assert.match(validateSetting('poles', [...poles, { id: 'dev', label: 'Dev 2' }], tasks), /existe déjà/)
  assert.equal(validateSetting('priorities', ['Basse', 'Haute'], tasks), null)
  assert.match(validateSetting('priorities', ['Basse'], tasks), /Haute/)
  assert.match(validateSetting('statuses', [], tasks), /non modifiable/)
})
