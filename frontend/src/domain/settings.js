// Valeurs par défaut du brief, identiques à api/src/Domain/Settings.php.
export const DONE = 'Terminé'

export const DEFAULT_SETTINGS = {
  statuses: [
    { id: 'À faire', color: 'todo' },
    { id: 'En cours', color: 'progress' },
    { id: 'En attente', color: 'waiting' },
    { id: 'Bloqué', color: 'blocked' },
    { id: 'Terminé', color: 'done' },
  ],
  priorities: ['Basse', 'Normale', 'Haute', 'Urgente'],
  poles: [
    { id: 'pilotage', label: 'Pilotage / Gestion de projet', legacy: ['Pilotage'] },
    { id: 'ux-ui', label: 'UX / UI', legacy: ['UX/UI'] },
    { id: 'da', label: 'Direction artistique', legacy: ['DA / Graphisme'] },
    { id: 'graphisme', label: 'Graphisme', legacy: ['DA / Graphisme'] },
    { id: 'redaction', label: 'Rédaction / Contenu', legacy: ['Rédaction'] },
    { id: 'seo', label: 'SEO', legacy: ['SEO'] },
    { id: 'dev', label: 'Développement / Intégration', legacy: ['Développement'] },
    { id: 'social', label: 'Communication / Social media', legacy: [] },
    { id: 'print', label: 'Print / Édition', legacy: [] },
  ],
}

export function settingsFrom(rows) {
  const values = Object.fromEntries(rows.map((r) => [r.id, r.value]))
  return {
    statuses: values.statuses ?? DEFAULT_SETTINGS.statuses,
    priorities: values.priorities ?? DEFAULT_SETTINGS.priorities,
    poles: values.poles ?? DEFAULT_SETTINGS.poles,
  }
}
