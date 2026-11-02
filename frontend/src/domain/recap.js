// Récap du lundi : pour une personne, ce qui l'attend cette semaine sur les projets dont elle fait partie.
// Même calcul pour l'écran « Ma semaine », l'aperçu de l'administration et les brouillons Gmail.
// Aucune date n'est inventée : une échéance « à préciser » reste écrite telle quelle.
import { addDays } from './planning.js'
import { DONE } from './settings.js'
import { orphanPoles, peopleOfTask, teamMembers } from './team.js'

const WAITING = ['Bloqué', 'En attente']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** « 9 nov. », calculé sans fuseau horaire pour que le navigateur et le script donnent la même chose. */
export const shortDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
export const dayName = (iso) => DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]
export const mondayOf = (iso) => addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7))

function line(task, { projectById, deliverableById, poleLabel }) {
  const project = projectById[task.projectId]
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    deadline: task.deadline || '',
    deadlineText: task.deadlineText || '',
    note: task.note || '',
    projectId: task.projectId,
    project: project ? `${project.client ? `${project.client} · ` : ''}${project.name}` : '',
    deliverable: deliverableById[task.deliverableId]?.name ?? task.deliverable ?? '',
    poles: (task.poles ?? []).map(poleLabel),
  }
}

const byDeadline = (a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title)

/**
 * Récap d'une personne pour la semaine qui contient `today` (lundi → dimanche).
 * Une tâche n'apparaît qu'une fois, dans la première rubrique qui la concerne.
 */
export function buildRecap({ person, projects, deliverables, tasks, settings, today }) {
  const weekStart = mondayOf(today)
  const weekEnd = addDays(weekStart, 6)
  const ctx = {
    projectById: Object.fromEntries(projects.map((p) => [p.id, p])),
    deliverableById: Object.fromEntries(deliverables.map((d) => [d.id, d])),
    poleLabel: (id) => settings.poles.find((p) => p.id === id)?.label ?? id,
  }
  const myProjects = projects.filter((p) => !p.archived && p.status !== DONE && teamMembers(p, [person]).length)
  const mine = tasks.filter((t) => t.status !== DONE && !t.archived && myProjects.some((p) => p.id === t.projectId)
    && peopleOfTask(t, ctx.projectById[t.projectId]).includes(person.id))

  const seen = new Set()
  const take = (filter) => mine.filter((t) => !seen.has(t.id) && filter(t)).map((t) => { seen.add(t.id); return line(t, ctx) })
  const late = take((t) => t.deadline && t.deadline < today).sort(byDeadline)
  const thisWeek = take((t) => t.deadline && t.deadline >= today && t.deadline <= weekEnd).sort(byDeadline)
  const waiting = take((t) => WAITING.includes(t.status)).sort((a, b) => a.status.localeCompare(b.status) || a.title.localeCompare(b.title))
  const ongoing = take((t) => t.status === 'En cours' && !t.deadline).sort((a, b) => a.title.localeCompare(b.title))

  const days = []
  for (const t of thisWeek) {
    if (days.at(-1)?.date !== t.deadline) days.push({ date: t.deadline, label: `${dayName(t.deadline)} ${shortDate(t.deadline)}`, tasks: [] })
    days.at(-1).tasks.push(t)
  }
  const milestones = deliverables
    .filter((d) => !d.archived && myProjects.some((p) => p.id === d.projectId) && d.dueDate && d.dueDate >= weekStart && d.dueDate <= weekEnd && !d.deliveredAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((d) => ({ id: d.id, name: d.name, dueDate: d.dueDate, projectId: d.projectId, project: ctx.projectById[d.projectId]?.name ?? '', validated: Boolean(d.validatedAt) }))

  const count = late.length + thisWeek.length + waiting.length + ongoing.length + milestones.length
  const parts = [late.length && `${late.length} en retard`, thisWeek.length && `${thisWeek.length} à rendre`, waiting.length && `${waiting.length} bloquée(s) ou en attente`].filter(Boolean)
  return {
    person: { id: person.id, name: person.name, email: person.email, external: Boolean(person.external) },
    today, weekStart, weekEnd,
    projects: myProjects.map((p) => ({ id: p.id, name: p.name })),
    late, days, waiting, ongoing, milestones, count,
    empty: count === 0,
    subject: `VLT · Ta semaine du ${shortDate(weekStart)}${parts.length ? ` : ${parts.join(', ')}` : ''}`,
  }
}

/** Vue d'ensemble pour les administrateurs : retards, blocages et pôles sans personne, projet par projet. */
export function buildOverview({ projects, tasks, settings, today }) {
  const poleLabel = (id) => settings.poles.find((p) => p.id === id)?.label ?? id
  return projects
    .filter((p) => !p.archived && p.status !== DONE)
    .map((p) => {
      const open = tasks.filter((t) => t.projectId === p.id && t.status !== DONE && !t.archived)
      return {
        id: p.id,
        name: p.name,
        client: p.client || '',
        late: open.filter((t) => t.deadline && t.deadline < today).length,
        blocked: open.filter((t) => t.status === 'Bloqué').length,
        waiting: open.filter((t) => t.status === 'En attente').length,
        orphans: orphanPoles(p, open).map(poleLabel),
      }
    })
    .filter((p) => p.late || p.blocked || p.waiting || p.orphans.length)
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * E-mail du récap en HTML compatible messageries (tableaux, styles en ligne) et en texte brut.
 * `appUrl` = adresse de l'application (ex. https://stefall.github.io/Project-manager/).
 */
export function renderRecap(recap, { appUrl, overview = null }) {
  const link = (t) => `${appUrl}#/projets/${encodeURIComponent(t.projectId)}?tache=${encodeURIComponent(t.id)}`
  const meta = (t) => [t.project, t.deliverable, t.poles.join(', ')].filter(Boolean).join(' · ')
  const C = { ink: '#1c1b19', muted: '#6b6760', line: '#e7e3dc', late: '#b42318', wait: '#b54708' }
  const row = (t, right = '') => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line}"><a href="${esc(link(t))}" style="color:${C.ink};font-weight:600;text-decoration:none">${esc(t.title)}</a><div style="color:${C.muted};font-size:13px;margin-top:2px">${esc(meta(t))}${t.note ? ` — ${esc(t.note)}` : ''}</div></td><td style="padding:8px 0 8px 12px;border-bottom:1px solid ${C.line};white-space:nowrap;text-align:right;color:${C.muted};font-size:13px;vertical-align:top">${right}</td></tr>`
  const section = (title, rows, color = C.ink) => (rows ? `<h2 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${color};margin:28px 0 4px">${title}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>` : '')

  const html = [
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${C.ink};font-size:15px;line-height:1.45;max-width:640px;margin:0 auto;padding:24px">`,
    `<p style="margin:0 0 4px;color:${C.muted};font-size:13px">VLT Project Manager · semaine du ${shortDate(recap.weekStart)} au ${shortDate(recap.weekEnd)}</p>`,
    `<h1 style="font-size:22px;margin:0 0 12px">Bonjour ${esc(recap.person.name.split(' ')[0])},</h1>`,
    `<p style="margin:0">${recap.empty ? 'Rien de prévu pour toi cette semaine sur tes projets.' : `Voici ce qui t'attend cette semaine sur ${recap.projects.map((p) => esc(p.name)).join(', ')}.`}</p>`,
    section(`En retard (${recap.late.length})`, recap.late.map((t) => row(t, `<span style="color:${C.late};font-weight:600">${shortDate(t.deadline)}</span>`)).join(''), C.late),
    recap.days.map((d) => section(d.label, d.tasks.map((t) => row(t, esc(t.status))).join(''))).join(''),
    section(`Bloquées ou en attente (${recap.waiting.length})`, recap.waiting.map((t) => row(t, `<span style="color:${C.wait}">${esc(t.status)}</span>${t.deadlineText ? `<br>${esc(t.deadlineText)}` : ''}`)).join(''), C.wait),
    section(`En cours, sans échéance (${recap.ongoing.length})`, recap.ongoing.map((t) => row(t, esc(t.deadlineText || 'date à préciser'))).join('')),
    section('Livrables attendus cette semaine', recap.milestones.map((m) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line}"><strong>${esc(m.name)}</strong><div style="color:${C.muted};font-size:13px">${esc(m.project)}${m.validated ? ' · déjà validé' : ''}</div></td><td style="padding:8px 0 8px 12px;border-bottom:1px solid ${C.line};text-align:right;color:${C.muted};font-size:13px;vertical-align:top">${dayName(m.dueDate)} ${shortDate(m.dueDate)}</td></tr>`).join('')),
    overview?.length ? section('Vue d\'ensemble (administration)', overview.map((p) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line}"><strong>${esc(p.name)}</strong> <span style="color:${C.muted};font-size:13px">${esc(p.client)}</span><div style="color:${C.muted};font-size:13px">${[p.late && `<span style="color:${C.late}">${p.late} en retard</span>`, p.blocked && `${p.blocked} bloquée(s)`, p.waiting && `${p.waiting} en attente`, p.orphans.length && `pôles sans personne : ${esc(p.orphans.join(', '))}`].filter(Boolean).join(' · ')}</div></td></tr>`).join('')) : '',
    `<p style="margin:32px 0 0;font-size:13px;color:${C.muted}"><a href="${esc(appUrl)}#/semaine" style="color:${C.ink}">Ouvrir ma semaine dans VLT Project Manager</a><br>Tu reçois ce récap parce que tu fais partie de l'équipe de ces projets.</p>`,
    '</div>',
  ].join('')

  const textLines = (title, items, right) => (items.length ? [``, title.toUpperCase(), ...items.map((t) => `- ${t.title}${right ? ` (${right(t)})` : ''} — ${meta(t)}\n  ${link(t)}`)] : [])
  const text = [
    `Bonjour ${recap.person.name.split(' ')[0]},`,
    recap.empty ? 'Rien de prévu pour toi cette semaine.' : `Voici ta semaine du ${shortDate(recap.weekStart)} au ${shortDate(recap.weekEnd)}.`,
    ...textLines(`En retard (${recap.late.length})`, recap.late, (t) => shortDate(t.deadline)),
    ...recap.days.flatMap((d) => textLines(d.label, d.tasks, (t) => t.status)),
    ...textLines(`Bloquées ou en attente (${recap.waiting.length})`, recap.waiting, (t) => t.status),
    ...textLines(`En cours, sans échéance (${recap.ongoing.length})`, recap.ongoing),
    ...(recap.milestones.length ? ['', 'LIVRABLES ATTENDUS CETTE SEMAINE', ...recap.milestones.map((m) => `- ${m.name} (${m.project}) : ${dayName(m.dueDate)} ${shortDate(m.dueDate)}`)] : []),
    '', `${appUrl}#/semaine`,
  ].join('\n')

  return { subject: recap.subject, html, text }
}
