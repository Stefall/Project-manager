<script setup>
import { computed, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/components/useTaskStats'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import MilestoneActions from './MilestoneActions.vue'

const props = defineProps({ deliverable: { type: Object, required: true } })
const data = useDataStore()
const ui = useUiStore()
const expanded = ref(false)

const tasks = computed(() => data.tasksOfDeliverable(props.deliverable.id))
const done = computed(() => tasks.value.filter((t) => t.status === 'Terminé').length)
const percent = computed(() => (tasks.value.length ? Math.round((done.value / tasks.value.length) * 100) : 0))
// Tâches ouvertes toujours visibles, bloquées et en attente d'abord ; les terminées sur demande.
const ORDER = ['Bloqué', 'En attente', 'En cours', 'À faire']
const open = computed(() => tasks.value.filter((t) => t.status !== 'Terminé').sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)))
const closed = computed(() => tasks.value.filter((t) => t.status === 'Terminé'))
const visible = computed(() => (expanded.value ? [...open.value, ...closed.value] : open.value))

async function changeStatus(task, status) {
  try {
    await data.updateTask(task, { status })
  } catch (e) {
    ui.toast(e.isConflict ? 'Cette tâche vient d\'être modifiée par quelqu\'un d\'autre : la version à jour est affichée.' : e.message, 'error')
  }
}
</script>

<template>
  <article class="deliverable">
    <header class="deliverable__header">
      <div>
        <h3>{{ deliverable.name }}</h3>
        <p class="deliverable__meta">
          {{ done }}/{{ tasks.length }} tâche(s) terminée(s)
          <template v-if="deliverable.dueDate"> · échéance {{ formatDate(deliverable.dueDate) }}</template>
        </p>
      </div>
      <button type="button" class="link" @click="ui.openEditor('deliverable', deliverable.id)">Modifier</button>
    </header>

    <div class="progress" role="img" :aria-label="`Avancement ${percent} %`"><span :style="{ width: `${percent}%` }" /></div>

    <p v-if="deliverable.importNote" class="deliverable__note">{{ deliverable.importNote }}</p>
    <MilestoneActions :deliverable="deliverable" />

    <ul class="deliverable__tasks">
      <li v-for="t in visible" :key="t.id" :class="{ pending: t.pending }">
        <label class="sr-only" :for="`ds-${t.id}`">Statut de {{ t.title }}</label>
        <select :id="`ds-${t.id}`" class="status-select" :value="t.status" :disabled="t.pending" @change="changeStatus(t, $event.target.value)">
          <option v-for="st in data.settings.statuses" :key="st.id">{{ st.id }}</option>
        </select>
        <StatusBadge :status="t.status" class="badge" />
        <button type="button" class="task" :disabled="t.pending" :title="'Modifier la tâche'" @click="ui.openEditor('task', t.id)">{{ t.title }}</button>
        <span class="deliverable__date">{{ t.deadline ? formatDate(t.deadline) : t.deadlineText }}</span>
      </li>
      <li v-if="!tasks.length" class="muted">Aucune tâche pour ce livrable.</li>
    </ul>
    <div class="deliverable__footer">
      <button type="button" class="link" @click="ui.openQuickAdd({ projectId: deliverable.projectId, deliverableId: deliverable.id })">+ Ajouter une tâche</button>
      <button v-if="closed.length" type="button" class="deliverable__toggle" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? 'Masquer les tâches terminées' : `Afficher les ${closed.length} tâche(s) terminée(s)` }}
      </button>
    </div>
  </article>
</template>

<style scoped lang="scss">
.deliverable {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);

  &__header { display: flex; justify-content: space-between; gap: var(--space-4); h3 { font-size: var(--text-md); } }
  &__meta { margin: var(--space-1) 0 0; font-size: var(--text-xs); color: var(--ink-muted); }
  &__note { margin: 0; font-size: var(--text-xs); color: var(--status-waiting); }
  &__toggle { border: 0; background: none; padding: 0; font-size: var(--text-sm); color: var(--ink-muted); cursor: pointer; text-decoration: underline; }
  &__footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-3); }
  &__tasks {
    list-style: none; margin: 0; padding: 0; display: grid; font-size: var(--text-sm);
    li { position: relative; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); min-width: 0; &:hover { background: var(--surface-sunken); } }
    li.pending { opacity: 0.6; }
    .task { flex: 1 1 auto; min-width: 0; border: 0; background: none; padding: var(--space-1) 0; text-align: left; cursor: pointer; font: inherit; color: inherit; &:hover { text-decoration: underline; } }
  }
  &__date { margin-left: auto; color: var(--ink-muted); font-size: var(--text-xs); white-space: nowrap; }
}
.progress { height: 4px; background: var(--surface-sunken); border-radius: var(--radius-pill); overflow: hidden; span { display: block; height: 100%; background: var(--ink); } }
// Le badge de statut est un sélecteur : le vrai <select> transparent est posé dessus et reçoit le clic.
.status-select { position: absolute; left: var(--space-2); width: 112px; height: 28px; opacity: 0; cursor: pointer; }
.status-select:focus-visible + .badge { @include focus-ring; }
.badge { flex: none; width: 112px; justify-content: flex-start; pointer-events: none; &::after { content: '▾'; margin-left: auto; } }
.muted { color: var(--ink-muted); }
.link { border: 0; background: none; padding: 0; font-size: var(--text-sm); text-decoration: underline; cursor: pointer; }
</style>
