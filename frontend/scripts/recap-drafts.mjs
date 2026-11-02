#!/usr/bin/env node
// Prépare les récaps du lundi à partir d'un export du Google Sheet, sans rien envoyer.
// Usage : node scripts/recap-drafts.mjs export.json [AAAA-MM-JJ] > brouillons.json
//
// export.json = { "PROJECTS": [["id","json"], ["P-001","{…}"], …], "TASKS": […], … } : les valeurs des onglets
// PROJECTS, DELIVERABLES, TASKS, CLIENTS, SETTINGS, PEOPLE et USERS telles que l'API Sheets les renvoie.
// Sortie : [{ to, subject, html, text, personId, count }] — un élément par personne qui a quelque chose cette semaine
// et qui reçoit le récap. Les brouillons Gmail sont créés à partir de cette liste ; l'envoi reste manuel.
import { readFileSync } from 'node:fs'
import { normalizeAll, withDefaults } from '../src/domain/legacy.js'
import { settingsFrom } from '../src/domain/settings.js'
import { buildOverview, buildRecap, renderRecap } from '../src/domain/recap.js'

const APP_URL = process.env.APP_URL ?? 'https://stefall.github.io/Project-manager/'
const [file, today = new Date().toISOString().slice(0, 10)] = process.argv.slice(2)
if (!file) {
  console.error('Usage : node scripts/recap-drafts.mjs export.json [AAAA-MM-JJ]')
  process.exit(1)
}
const sheet = JSON.parse(readFileSync(file, 'utf8'))
const rows = (tab) => (sheet[tab] ?? []).slice(1).filter((r) => r[0]).map((r) => withDefaults(JSON.parse(r[1] || '{}')))
const active = (list) => list.filter((x) => !x.archived)

const settings = settingsFrom(rows('SETTINGS'))
const raw = { clients: active(rows('CLIENTS')), projects: active(rows('PROJECTS')), deliverables: rows('DELIVERABLES'), tasks: active(rows('TASKS')) }
const { projects, tasks } = normalizeAll(raw, settings)
const people = active(rows('PEOPLE')).filter((p) => p.digest !== false)
const admins = new Set(active(rows('USERS')).filter((u) => u.role === 'admin' && u.active !== false).map((u) => String(u.email).toLowerCase()))
const overview = buildOverview({ projects, tasks, settings, today })

const drafts = []
for (const person of people) {
  const recap = buildRecap({ person, projects, deliverables: raw.deliverables, tasks, settings, today })
  const isAdmin = admins.has(String(person.email).toLowerCase())
  // Pas d'e-mail pour une semaine vide ; un administrateur le reçoit quand même s'il y a une vue d'ensemble à lire.
  if (recap.empty && !(isAdmin && overview.length)) continue
  const mail = renderRecap(recap, { appUrl: APP_URL, overview: isAdmin ? overview : null })
  drafts.push({ personId: person.id, to: person.email, subject: mail.subject, html: mail.html, text: mail.text, count: recap.count })
}
process.stdout.write(JSON.stringify(drafts, null, 2))
