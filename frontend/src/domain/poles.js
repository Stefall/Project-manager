// Couleur et libellé court de chaque pôle (compétence), pour les repérer d'un coup d'œil.
// Une couleur peut être fixée dans les paramètres (pole.color) ; sinon couleur par défaut du pôle,
// puis palette de secours selon sa position.

const DEFAULTS = {
  pilotage: { color: '#475569', short: 'Pilotage' },
  'ux-ui': { color: '#7c3aed', short: 'UX/UI' },
  da: { color: '#c026d3', short: 'DA' },
  graphisme: { color: '#ea580c', short: 'Graphisme' },
  redaction: { color: '#0d9488', short: 'Rédaction' },
  seo: { color: '#2563eb', short: 'SEO' },
  dev: { color: '#4d7c0f', short: 'Dev' },
  social: { color: '#b45309', short: 'Social' },
  print: { color: '#be123c', short: 'Print' },
}
const FALLBACK = ['#0369a1', '#a21caf', '#65a30d', '#c2410c', '#0f766e', '#6d28d9']

/** { id, label, short, color } d'un pôle, à partir des paramètres. */
export function poleInfo(id, poles = []) {
  const index = poles.findIndex((p) => p.id === id)
  const pole = poles[index]
  const label = pole?.label ?? id
  const base = DEFAULTS[id]
  return {
    id,
    label,
    short: pole?.short || base?.short || label.split(' / ')[0],
    color: pole?.color || base?.color || FALLBACK[Math.max(index, 0) % FALLBACK.length],
  }
}
