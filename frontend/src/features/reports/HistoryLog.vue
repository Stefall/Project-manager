<script setup>
import { computed, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { EVENT_LABELS, eventsOf } from '@/domain/reports'

// Journal des événements (ajout seul) : qui a fait quoi, quand. Les lignes ne sont jamais modifiées.
const props = defineProps({
  month: { type: String, required: true },
  projectId: { type: String, default: '' },
})

const data = useDataStore()
const ui = useUiStore()
const family = ref('')
const FAMILIES = [
  { id: '', label: 'Tous les événements' },
  { id: 'task', label: 'Tâches' },
  { id: 'deliverable', label: 'Livrables' },
  { id: 'project', label: 'Projets' },
  { id: 'report', label: 'Bilans' },
  { id: 'legacy', label: 'Ancien outil' },
]
const LEGACY = ['validation', 'modification', 'archive']
const familyOf = (e) => (LEGACY.includes(e.type) ? 'legacy' : (e.type || '').split('.')[0])

const rows = computed(() => eventsOf(data.events, { month: props.month, projectId: props.projectId })
  .filter((e) => !family.value || familyOf(e) === family.value))

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const label = (e) => EVENT_LABELS[e.type] ?? e.type
const firstLine = (s) => (s || '').split('\n')[0]

function open(e) {
  const id = e.entity
  if (data.taskById[id]) ui.openEditor('task', id)
  else if (data.deliverableById[id]) ui.openEditor('deliverable', id)
  else if (data.projectById[id]) ui.openEditor('project', id)
}
const canOpen = (e) => Boolean(data.taskById[e.entity] || data.deliverableById[e.entity] || data.projectById[e.entity])

const changeSummary = (e) => Object.entries(e.changes ?? {})
  .filter(([field]) => !['poles', 'checklist', 'links', 'deliverableId'].includes(field) || e.type !== 'task.status_changed')
  .map(([field, { before, after }]) => `${field} : ${fmt(before)} → ${fmt(after)}`)
  .join(' · ')
const fmt = (v) => (v === null || v === undefined || v === '' ? '∅' : Array.isArray(v) ? `${v.length} élément(s)` : String(v).slice(0, 60))
</script>

<template>
  <section aria-label="Historique">
    <div class="filters">
      <label class="field"><span>Type</span>
        <select v-model="family"><option v-for="f in FAMILIES" :key="f.id" :value="f.id">{{ f.label }}</option></select>
      </label>
      <p class="muted">{{ rows.length }} événement(s)</p>
    </div>

    <p v-if="!rows.length" class="empty">Aucun événement pour cette période.</p>
    <div v-else class="history-wrap"><table class="history">
      <thead><tr><th scope="col">Date</th><th scope="col">Événement</th><th scope="col">Détail</th><th scope="col">Projet</th><th scope="col">Par</th></tr></thead>
      <tbody>
        <tr v-for="e in rows" :key="e.id">
          <td class="nowrap">{{ DATE.format(new Date(e.date)) }}</td>
          <td class="nowrap"><span class="type" :class="`type--${familyOf(e)}`">{{ label(e) }}</span></td>
          <td>
            <button v-if="canOpen(e)" type="button" class="link" @click="open(e)">{{ firstLine(e.description) }}</button>
            <span v-else>{{ firstLine(e.description) }}</span>
            <details v-if="e.changes && Object.keys(e.changes).length"><summary>Modifications</summary><p>{{ changeSummary(e) }}</p></details>
            <p v-if="e.note" class="muted">{{ e.note }}</p>
          </td>
          <td class="muted">{{ data.projectById[e.projectId]?.name ?? '' }}</td>
          <td class="muted">{{ e.author || 'ancien outil' }}</td>
        </tr>
      </tbody>
    </table></div>
  </section>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-xs); margin: 0; }
.empty { color: var(--ink-muted); }
.filters { display: flex; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-4); .field { min-width: 200px; } p { padding-bottom: var(--space-2); } }
.history {
  width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); font-size: var(--text-sm);
  th { text-align: left; color: var(--ink-muted); font-weight: var(--weight-strong); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--line); }
  td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--line); vertical-align: top; }
  details { margin-top: var(--space-1); font-size: var(--text-xs); color: var(--ink-muted); p { margin: var(--space-1) 0 0; word-break: break-word; } }
}
.history-wrap { overflow-x: auto; }
.nowrap { white-space: nowrap; }
.type { display: inline-block; padding: 1px 8px; border-radius: var(--radius-pill); font-size: var(--text-xs); background: var(--surface-sunken); }
.type--deliverable { background: var(--status-done-bg); color: var(--status-done); }
.type--report { background: var(--ink); color: var(--surface); }
.link { border: 0; background: none; padding: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; text-decoration: underline; text-decoration-color: var(--line-strong); }
@include below($bp-tablet) {
  .history th:nth-child(4), .history td:nth-child(4), .history th:nth-child(5), .history td:nth-child(5) { display: none; }
  .nowrap { white-space: normal; }
}
</style>
