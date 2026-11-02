// Équipe d'un projet : pour chaque pôle, les personnes de l'annuaire qui le tiennent.
// Les tâches restent rattachées à des pôles ; la personne concernée se déduit de l'équipe du projet.

export const PERSON_FIELDS = ['name', 'email', 'poles', 'external', 'digest']

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (s) => String(s ?? '').trim().toLowerCase()

export function validatePerson(person, { people, settings }) {
  const errors = {}
  if (!person.name?.trim()) errors.name = 'Champ obligatoire.'
  if (!EMAIL.test(person.email ?? '')) errors.email = 'Adresse e-mail invalide.'
  else if (people.some((p) => p.id !== person.id && !p.archived && norm(p.email) === norm(person.email))) errors.email = 'Cette personne existe déjà.'
  if ((person.poles ?? []).some((id) => !settings.poles.some((p) => p.id === id))) errors.poles = 'Pôle inconnu.'
  return errors
}

/** Équipe valide : des pôles connus, des personnes de l'annuaire, sans doublon. */
export function validateTeam(team, { people, settings }) {
  if (team === undefined) return null
  if (!team || typeof team !== 'object' || Array.isArray(team)) return 'Équipe invalide.'
  for (const [pole, ids] of Object.entries(team)) {
    if (!settings.poles.some((p) => p.id === pole)) return `Pôle inconnu : ${pole}.`
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return 'Équipe invalide.'
    if (ids.some((id) => !people.some((p) => p.id === id))) return 'Personne inconnue dans l\'équipe.'
  }
  return null
}

/** Retire les pôles vides, pour garder la cellule du Sheet courte. */
export function compactTeam(team) {
  return Object.fromEntries(Object.entries(team ?? {}).filter(([, ids]) => ids?.length))
}

/** Personnes de l'équipe d'un projet, chacune avec les pôles qu'elle y tient. */
export function teamMembers(project, people) {
  const byId = Object.fromEntries(people.map((p) => [p.id, p]))
  const members = new Map()
  for (const [pole, ids] of Object.entries(project?.team ?? {})) {
    for (const id of ids) {
      if (!byId[id]) continue
      if (!members.has(id)) members.set(id, { ...byId[id], projectPoles: [] })
      members.get(id).projectPoles.push(pole)
    }
  }
  return [...members.values()]
}

/** Personnes concernées par une tâche : celles qui tiennent un de ses pôles sur son projet. */
export function peopleOfTask(task, project) {
  const ids = new Set()
  for (const pole of task.poles ?? []) for (const id of project?.team?.[pole] ?? []) ids.add(id)
  return [...ids]
}

/** Tâches qui concernent une personne, sur tous les projets dont elle fait partie. */
export function tasksOfPerson(personId, tasks, projects) {
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]))
  return tasks.filter((t) => peopleOfTask(t, byId[t.projectId]).includes(personId))
}

/** Pôles utilisés par les tâches d'un projet mais tenus par personne : là où les tâches se perdent. */
export function orphanPoles(project, tasks) {
  const used = new Set(tasks.filter((t) => t.projectId === project.id).flatMap((t) => t.poles ?? []))
  return [...used].filter((pole) => !(project.team?.[pole]?.length))
}

export const initials = (name) => String(name ?? '').trim().split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
