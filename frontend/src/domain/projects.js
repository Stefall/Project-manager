// Champs modifiables d'un projet et d'un livrable, et validation commune aux deux backends.

export const PROJECT_FIELDS = [
  'name', 'clientId', 'client', 'summary', 'situation', 'description', 'objectives', 'scope', 'status',
  'startDate', 'endDate', 'achievements', 'watchpoints', 'nextSteps', 'links',
]

export const PROJECT_STATUSES = ['En cadrage', 'En production', 'En pause', 'Terminé']

export const DELIVERABLE_FIELDS = ['projectId', 'name', 'description', 'dueDate', 'links']

/** Trois jalons distincts d'un livrable, chacun enregistré par une action explicite et son événement. */
export const MILESTONES = {
  validate: { field: 'validatedAt', type: 'deliverable.validated', label: 'Validé', verb: 'Marquer comme validé', description: 'Livrable validé' },
  deliver: { field: 'deliveredAt', type: 'deliverable.delivered', label: 'Livré', verb: 'Marquer comme livré', description: 'Livrable transmis' },
  publish: { field: 'publishedAt', type: 'deliverable.published', label: 'Publié', verb: 'Marquer comme publié', description: 'Livrable publié' },
}

const isDate = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)))
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v)
const isStringList = (v) => v === undefined || (Array.isArray(v) && v.every((s) => typeof s === 'string'))
const linksValid = (v) => v === undefined || (Array.isArray(v) && v.every((l) => l && isUrl(l.url)))

export function validateProject(project) {
  const errors = {}
  if (!project.name?.trim()) errors.name = 'Champ obligatoire.'
  if (project.status && !PROJECT_STATUSES.includes(project.status)) errors.status = 'Statut inconnu.'
  if (!isDate(project.startDate)) errors.startDate = 'Date invalide.'
  if (!isDate(project.endDate)) errors.endDate = 'Date invalide.'
  if (project.startDate && project.endDate && project.startDate > project.endDate) errors.endDate = 'La fin doit suivre le début.'
  for (const f of ['achievements', 'watchpoints', 'nextSteps']) if (!isStringList(project[f])) errors[f] = 'Liste invalide.'
  if (!linksValid(project.links)) errors.links = 'Lien invalide (http ou https attendu).'
  return errors
}

export function validateDeliverable(deliverable, { projects }) {
  const errors = {}
  if (!deliverable.name?.trim()) errors.name = 'Champ obligatoire.'
  if (!projects.some((p) => p.id === deliverable.projectId)) errors.projectId = 'Projet inconnu.'
  if (!isDate(deliverable.dueDate)) errors.dueDate = 'Date invalide.'
  if (!linksValid(deliverable.links)) errors.links = 'Lien invalide (http ou https attendu).'
  return errors
}

export function validateMilestone({ date, link }) {
  const errors = {}
  if (!date || !isDate(date)) errors.date = 'Date obligatoire.'
  if (link && !isUrl(link)) errors.link = 'Lien invalide (http ou https attendu).'
  return errors
}

/** Différences champ par champ, pour l'historique. */
export function diff(before, after, fields) {
  const changes = {}
  for (const f of fields) {
    if (JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null)) changes[f] = { before: before[f] ?? null, after: after[f] ?? null }
  }
  return changes
}
