// Lecture des lignes écrites par l'ancien Apps Script : elles sont complétées à la lecture,
// sans réécrire le Sheet. La forme complète n'est enregistrée qu'à la prochaine modification.

export function withDefaults(data) {
  return { ...data, version: Number(data.version ?? 1), archived: Boolean(data.archived) }
}

/** Pôles de l'ancien outil (« DA / Graphisme ») vers les identifiants actuels (« da », « graphisme »). */
export function normalizePoles(poles, settings) {
  const out = new Set()
  for (const value of poles ?? []) {
    const byId = settings.poles.find((p) => p.id === value)
    if (byId) { out.add(byId.id); continue }
    settings.poles.filter((p) => p.legacy?.includes(value) || p.label === value).forEach((p) => out.add(p.id))
  }
  return [...out]
}

export function normalizeAll({ clients, projects, deliverables, tasks }, settings) {
  const clientByName = Object.fromEntries(clients.map((c) => [c.name, c.id]))
  const deliverableByKey = Object.fromEntries(deliverables.map((d) => [`${d.projectId}|${d.name}`, d.id]))
  return {
    projects: projects.map((p) => ({ ...p, clientId: p.clientId || clientByName[p.client] || '' })),
    tasks: tasks.map((t) => ({
      ...t,
      deliverableId: t.deliverableId || deliverableByKey[`${t.projectId}|${t.deliverable}`] || '',
      poles: normalizePoles(t.poles, settings),
      checklist: t.checklist ?? [],
      links: t.links ?? (t.source ? [{ label: 'Source', url: t.source }] : []),
    })),
  }
}
