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
const attention = computed(() => tasks.value.filter((t) => t.status === 'Bloqué' || t.status === 'En attente'))
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
    <ul v-if="attention.length" class="deliverable__attention">
      <li v-for="t in attention" :key="t.id"><StatusBadge :status="t.status" /> {{ t.title }}</li>
    </ul>

    <MilestoneActions :deliverable="deliverable" />

    <button type="button" class="deliverable__toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      {{ expanded ? 'Masquer les tâches' : `Voir les ${tasks.length} tâche(s)` }}
    </button>
    <ul v-if="expanded" class="deliverable__tasks">
      <li v-for="t in tasks" :key="t.id">
        <button type="button" @click="ui.openEditor('task', t.id)">
          <StatusBadge :status="t.status" />
          <span>{{ t.title }}</span>
          <span class="deliverable__date">{{ t.deadline ? formatDate(t.deadline) : t.deadlineText }}</span>
        </button>
      </li>
      <li>
        <button type="button" class="link" @click="ui.openQuickAdd({ projectId: deliverable.projectId, deliverableId: deliverable.id })">+ Ajouter une tâche</button>
      </li>
    </ul>
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
  &__attention { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); font-size: var(--text-sm); }
  &__toggle { justify-self: start; border: 0; background: none; padding: 0; font-size: var(--text-sm); color: var(--ink-muted); cursor: pointer; text-decoration: underline; }
  &__tasks {
    list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); border-top: 1px solid var(--line); padding-top: var(--space-3);
    button:not(.link) { display: flex; align-items: center; gap: var(--space-3); width: 100%; text-align: left; border: 0; background: none; padding: var(--space-2); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); &:hover { background: var(--surface-sunken); } }
  }
  &__date { margin-left: auto; color: var(--ink-muted); font-size: var(--text-xs); white-space: nowrap; }
}
.progress { height: 4px; background: var(--surface-sunken); border-radius: var(--radius-pill); overflow: hidden; span { display: block; height: 100%; background: var(--ink); } }
.link { border: 0; background: none; padding: 0; font-size: var(--text-sm); text-decoration: underline; cursor: pointer; }
</style>
