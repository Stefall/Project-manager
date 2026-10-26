<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/components/useTaskStats'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import EmptyState from '@/design-system/components/EmptyState.vue'

const data = useDataStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const view = ref(route.query.view === 'kanban' ? 'kanban' : 'table')
const status = ref(route.query.status ?? '')
const pole = ref('')
const sortKey = ref('deadline')
watch([view, status], () => router.replace({ query: { ...route.query, view: view.value, status: status.value || undefined } }))

const tasks = computed(() => {
  const list = data.tasksFor(ui.currentProjectId).filter((t) => (!status.value || t.status === status.value) && (!pole.value || t.poles?.includes(pole.value)))
  // Les tâches sans deadline vont en fin de liste : on n'invente jamais de date.
  return [...list].sort((a, b) => (a[sortKey.value] || '￿').localeCompare(b[sortKey.value] || '￿'))
})
const columns = computed(() => data.settings.statuses.map((s) => ({ status: s.id, tasks: tasks.value.filter((t) => t.status === s.id) })))

// Glisser-déposer entre colonnes du Kanban ; au clavier, le statut se change dans la fiche de la tâche.
const dragged = ref(null)
const dragOver = ref(null)
function drop(status) {
  const task = dragged.value
  dragged.value = null
  dragOver.value = null
  if (task && task.status !== status) changeStatus(task, status)
}

async function changeStatus(task, next) {
  try {
    await data.updateTask(task, { status: next })
  } catch (e) {
    ui.toast(e.isConflict ? 'Cette tâche vient d\'être modifiée par quelqu\'un d\'autre : la version à jour est affichée.' : e.message, 'error')
  }
}
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>Tâches</h1>
        <p>{{ tasks.length }} tâches affichées</p>
      </div>
      <div class="toggle" role="group" aria-label="Affichage">
        <button type="button" :aria-pressed="view === 'table'" @click="view = 'table'">Tableau</button>
        <button type="button" :aria-pressed="view === 'kanban'" @click="view = 'kanban'">Kanban</button>
      </div>
    </header>

    <div class="filters">
      <label class="field"><span>Statut</span>
        <select v-model="status"><option value="">Tous</option><option v-for="s in data.settings.statuses" :key="s.id">{{ s.id }}</option></select>
      </label>
      <label class="field"><span>Pôle</span>
        <select v-model="pole"><option value="">Tous</option><option v-for="p in data.settings.poles" :key="p.id" :value="p.id">{{ p.label }}</option></select>
      </label>
      <label class="field"><span>Trier par</span>
        <select v-model="sortKey"><option value="deadline">Deadline</option><option value="title">Intitulé</option><option value="status">Statut</option></select>
      </label>
    </div>

    <EmptyState v-if="!tasks.length" title="Aucune tâche" text="Modifiez les filtres ou créez une tâche.">
      <button type="button" class="link" @click="ui.openQuickAdd({ projectId: ui.currentProjectId })">+ Nouvelle tâche</button>
    </EmptyState>

    <table v-else-if="view === 'table'" class="tasks-table">
      <thead>
        <tr><th scope="col">Intitulé</th><th scope="col">Livrable</th><th scope="col">Statut</th><th scope="col">Pôles</th><th scope="col">Deadline</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in tasks" :key="t.id" :class="{ pending: t.pending }">
          <td>
            <span class="id">{{ t.id.startsWith('tmp') ? '…' : t.id }}</span>
            <button type="button" class="task-link" :disabled="t.pending" @click="ui.openEditor('task', t.id)">{{ t.title }}</button>
          </td>
          <td class="muted">{{ t.deliverable }}</td>
          <td>
            <label class="sr-only" :for="`st-${t.id}`">Statut de {{ t.title }}</label>
            <select :id="`st-${t.id}`" class="status-select" :value="t.status" :disabled="t.pending" @change="changeStatus(t, $event.target.value)">
              <option v-for="s in data.settings.statuses" :key="s.id">{{ s.id }}</option>
            </select>
          </td>
          <td class="muted">{{ (t.poles || []).map(data.poleLabel).join(', ') }}</td>
          <td>{{ t.deadline ? formatDate(t.deadline) : '' }}<span v-if="!t.deadline && t.deadlineText" class="muted">{{ t.deadlineText }} (à préciser)</span></td>
        </tr>
      </tbody>
    </table>

    <div v-else class="kanban">
      <section
        v-for="col in columns"
        :key="col.status"
        class="kanban__col"
        :class="{ 'kanban__col--over': dragOver === col.status }"
        :aria-label="col.status"
        @dragover.prevent="dragOver = col.status"
        @dragleave="dragOver === col.status && (dragOver = null)"
        @drop.prevent="drop(col.status)"
      >
        <header><StatusBadge :status="col.status" /> <span class="muted">{{ col.tasks.length }}</span></header>
        <article
          v-for="t in col.tasks"
          :key="t.id"
          class="kanban__card"
          :class="{ 'kanban__card--dragging': dragged?.id === t.id }"
          :draggable="!t.pending"
          @dragstart="dragged = t"
          @dragend="dragged = null; dragOver = null"
        >
          <button type="button" class="task-link" @click="ui.openEditor('task', t.id)">{{ t.title }}</button>
          <p class="muted">{{ t.deliverable }}<template v-if="t.deadline"> · {{ formatDate(t.deadline) }}</template><template v-else-if="t.deadlineText"> · {{ t.deadlineText }}</template></p>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.toggle { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden;
  button { border: 0; background: var(--surface); padding: var(--space-2) var(--space-4); cursor: pointer; font-size: var(--text-sm); }
  button[aria-pressed='true'] { background: var(--ink); color: var(--surface); }
}
.filters { display: flex; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6); .field { min-width: 180px; } }
.tasks-table {
  width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); font-size: var(--text-sm);
  th { text-align: left; font-weight: var(--weight-strong); color: var(--ink-muted); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); }
  td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr:last-child td { border-bottom: 0; }
  .pending { opacity: 0.6; }
  .id { color: var(--ink-faint); font-size: var(--text-xs); margin-right: var(--space-2); }
}
.status-select { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); background: var(--surface); }
.kanban { display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr)); gap: var(--space-4); overflow-x: auto;
  &__col { background: var(--surface-sunken); border-radius: var(--radius-md); padding: var(--space-3); display: grid; gap: var(--space-2); align-content: start;
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); } }
  &__col--over { outline: 2px dashed var(--line-strong); outline-offset: -2px; }
  &__card--dragging { opacity: 0.4; }
  &__card { cursor: grab; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3); p { margin: var(--space-1) 0 0; } }
}
.task-link { border: 0; background: none; padding: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; &:hover { text-decoration: underline; } }
.link { border: 0; background: none; text-decoration: underline; cursor: pointer; }
@include below($bp-tablet) { .tasks-table th:nth-child(2), .tasks-table td:nth-child(2), .tasks-table th:nth-child(4), .tasks-table td:nth-child(4) { display: none; } }
</style>
