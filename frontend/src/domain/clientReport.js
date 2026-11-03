// Bilan client : version d'un bilan figé destinée au client, importée dans Google Docs.
// Uniquement ce que le client doit voir : pas de notes internes ni de points de vigilance.
// HTML simple (tableaux, styles en ligne) : c'est ce que l'import de Google Docs conserve le mieux.
import { shortDate } from './recap.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const monthLabel = (month) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
const STEP = { validated: 'Validé', delivered: 'Livré', published: 'Publié' }
const STATUS_COLOR = { Bloqué: '#b91c1c', 'En attente': '#b45309', 'En cours': '#1d4ed8', 'À faire': '#475569', Terminé: '#15803d' }

const INK = '#1c1917'
const MUTED = '#78716c'
const LINE = '#e7e5e4'
const font = `font-family:Arial,sans-serif;color:${INK};`

const h2 = (text) => `<h2 style="${font}font-size:15pt;margin:20pt 0 6pt;">${esc(text)}</h2>`
const h3 = (text, extra = '') => `<h3 style="${font}font-size:12pt;margin:12pt 0 3pt;">${esc(text)}${extra}</h3>`
const muted = (text) => `<p style="${font}color:${MUTED};font-size:10pt;margin:0 0 4pt;">${esc(text)}</p>`
const poles = (list = []) => list.map((p) => `<span style="color:${p.color};font-weight:bold;">${esc(p.short)}</span>`).join(' · ')

/** Nom du document Drive : « Bilan Eureden · Site carrière · Octobre 2026 (v2) ». */
export function clientReportName(content, meta) {
  const p = content.projects[0] ?? {}
  const month = monthLabel(content.month)
  return `Bilan ${[p.client, p.name].filter(Boolean).join(' · ')} · ${month[0].toUpperCase()}${month.slice(1)}${meta?.number ? ` (v${meta.number})` : ''}`
}

/** Document HTML du bilan client, à partir du contenu d'un bilan figé (un seul projet). */
export function renderClientReport(content, meta = null) {
  const p = content.projects[0] ?? {}
  const month = monthLabel(content.month)
  const figures = [
    ['Tâches terminées', content.completedTasks.length],
    ['Livrables validés', content.milestones.validated?.length ?? 0],
    ['Livrables livrés', content.milestones.delivered?.length ?? 0],
    ['Livrables publiés', content.milestones.published?.length ?? 0],
  ]
  const s = content.snapshot
  const percent = s.total ? Math.round((s.done / s.total) * 100) : 0
  const out = []

  out.push(`<p style="${font}color:${MUTED};font-size:9pt;letter-spacing:1pt;margin:0;">BILAN MENSUEL · ${esc(month.toUpperCase())}</p>`)
  out.push(`<h1 style="${font}font-size:22pt;margin:4pt 0 2pt;">${esc(p.name)}</h1>`)
  if (p.client) out.push(muted(p.client))
  if (meta?.createdAt) out.push(muted(`Version ${meta.number} du ${shortDate(meta.createdAt.slice(0, 10))} ${meta.createdAt.slice(0, 4)}`))
  if (meta?.comment) out.push(`<p style="${font}font-size:11pt;background-color:#f5f5f4;padding:6pt;">${esc(meta.comment)}</p>`)

  // Chiffres du mois, en une ligne de cases.
  out.push(`<table style="border-collapse:collapse;width:100%;margin:12pt 0;"><tr>${figures.map(([label, value]) =>
    `<td style="border:1px solid ${LINE};padding:8pt;width:25%;"><p style="${font}font-size:20pt;font-weight:bold;margin:0;">${value}</p><p style="${font}color:${MUTED};font-size:9pt;margin:0;">${esc(label)}</p></td>`).join('')}</tr></table>`)

  if (p.situation || p.nextSteps?.length) {
    out.push(h2('Où en est le projet'))
    if (p.situation) out.push(`<p style="${font}font-size:11pt;">${esc(p.situation)}</p>`)
    out.push(muted(`Avancement global : ${percent} % (${s.done} tâche(s) terminée(s) sur ${s.total}).`))
    if (p.nextSteps?.length) {
      out.push(h3('Prochaines étapes'))
      out.push(`<ul>${p.nextSteps.map((x) => `<li style="${font}font-size:11pt;">${esc(x)}</li>`).join('')}</ul>`)
    }
  }

  if (content.byDeliverable?.length) {
    out.push(h2('Réalisé ce mois-ci'))
    for (const d of content.byDeliverable) {
      const count = d.id ? `<span style="color:${MUTED};font-weight:normal;font-size:10pt;">  ·  ${d.done}/${d.total} tâche(s) terminée(s)</span>` : ''
      out.push(h3(d.id ? d.name : 'Autres tâches', count))
      if (d.milestones.length) out.push(`<p style="${font}font-size:10pt;margin:0 0 4pt;">${d.milestones.map((m) => `<span style="color:#15803d;font-weight:bold;">✓ ${STEP[m.key]} le ${esc(shortDate(m.date))}</span>`).join('   ')}</p>`)
      const done = d.tasks.filter((t) => t.date)
      if (done.length) out.push(`<ul>${done.map((t) => `<li style="${font}font-size:11pt;">${esc(t.title)} <span style="color:${MUTED};">— ${esc(shortDate(t.date))}</span></li>`).join('')}</ul>`)
    }
  }

  if (s.byDeliverable?.length) {
    out.push(h2('En cours et à venir'))
    out.push(`<table style="border-collapse:collapse;width:100%;">${s.byDeliverable.map((g) => [
      `<tr><td colspan="3" style="${font}font-weight:bold;font-size:11pt;padding:8pt 0 3pt;border-bottom:1px solid ${LINE};">${esc(g.id ? g.name : 'Autres tâches')}</td></tr>`,
      ...g.tasks.map((t) => `<tr><td style="${font}font-size:10pt;padding:3pt 6pt 3pt 0;width:22%;color:${STATUS_COLOR[t.status] ?? MUTED};font-weight:bold;">${esc(t.status)}</td><td style="${font}font-size:11pt;padding:3pt 6pt;">${esc(t.title)}</td><td style="${font}font-size:9pt;padding:3pt 0;width:28%;">${poles(t.poles)}</td></tr>`),
    ].join('')).join('')}</table>`)
  }

  if (content.upcoming?.length) {
    out.push(h2('Prochaines échéances'))
    out.push(`<ul>${content.upcoming.map((t) => `<li style="${font}font-size:11pt;"><b>${esc(shortDate(t.deadline))}</b> — ${esc(t.title)}</li>`).join('')}</ul>`)
  }

  out.push(`<p style="${font}color:${MUTED};font-size:8pt;margin-top:24pt;">Document établi par VLT à partir du suivi de projet. Il reflète la situation à la date de la version.</p>`)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(clientReportName(content, meta))}</title></head><body>${out.join('\n')}</body></html>`
}
