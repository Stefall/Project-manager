<script setup>
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import StatusBadge from '@/design-system/components/StatusBadge.vue'

// « Dates à préciser » : ce qui n'a pas d'échéance. L'indication libre de l'ancien outil
// (« Semaine 42 ») est affichée telle quelle ; l'échéance se fixe ici d'un geste, jamais automatiquement.
defineProps({
  tasks: { type: Array, required: true },
  deliverables: { type: Array, required: true },
})

const data = useDataStore()
const ui = useUiStore()

async function setDate(save, label, value) {
  if (!value) return
  try {
    await save()
    ui.toast(`Échéance enregistrée pour « ${label} ».`, 'success')
  } catch (e) {
    ui.toast(e.isConflict ? 'Cet élément vient d\'être modifié par quelqu\'un d\'autre : la version à jour est affichée.' : e.fields ? Object.values(e.fields).join(' ') : e.message, 'error')
  }
}
const setTaskDeadline = (task, value) => setDate(() => data.updateTask(task, { deadline: value }), task.title, value)
const setDeliverableDue = (d, value) => setDate(() => data.updateDeliverable(d, { dueDate: value }), d.name, value)
</script>

<template>
  <section class="undated" aria-labelledby="undated-title">
    <header>
      <h2 id="undated-title">Dates à préciser</h2>
      <p class="muted">{{ tasks.length }} tâche(s) et {{ deliverables.length }} livrable(s) sans échéance. Ils ne sont pas placés sur le planning tant qu'une date n'est pas saisie.</p>
    </header>

    <table v-if="tasks.length" class="undated__table">
      <thead><tr><th scope="col">Tâche</th><th scope="col">Livrable</th><th scope="col">Statut</th><th scope="col">Indication</th><th scope="col">Échéance</th></tr></thead>
      <tbody>
        <tr v-for="u in tasks" :key="u.task.id">
          <td><button type="button" class="link" @click="ui.openEditor('task', u.task.id)">{{ u.task.title }}</button></td>
          <td class="muted">{{ data.deliverableById[u.task.deliverableId]?.name ?? u.task.deliverable }}</td>
          <td><StatusBadge :status="u.task.status" /></td>
          <td class="muted">
            {{ u.hint || '—' }}
            <span v-if="u.hasStart" class="tag">début connu</span>
          </td>
          <td>
            <label class="sr-only" :for="`dl-${u.task.id}`">Échéance de {{ u.task.title }}</label>
            <input :id="`dl-${u.task.id}`" type="date" :disabled="u.task.pending" :min="u.task.startDate || undefined" @change="setTaskDeadline(u.task, $event.target.value)">
          </td>
        </tr>
      </tbody>
    </table>

    <template v-if="deliverables.length">
      <h3>Livrables sans échéance ni jalon</h3>
      <ul class="undated__deliverables">
        <li v-for="d in deliverables" :key="d.id">
          <button type="button" class="link" @click="ui.openEditor('deliverable', d.id)">{{ d.name }}</button>
          <span class="muted">{{ data.projectById[d.projectId]?.name }}</span>
          <label class="sr-only" :for="`dd-${d.id}`">Échéance de {{ d.name }}</label>
          <input :id="`dd-${d.id}`" type="date" :disabled="d.pending" @change="setDeliverableDue(d, $event.target.value)">
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.undated {
  margin-top: var(--space-8);
  h2 { margin: 0; font-size: var(--text-lg); }
  h3 { margin: var(--space-6) 0 var(--space-3); font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); }
  header p { margin: var(--space-1) 0 var(--space-4); }
  input[type='date'] { border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); background: var(--surface); font: inherit; }
}
.undated__table {
  width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); font-size: var(--text-sm);
  th { text-align: left; font-weight: var(--weight-strong); color: var(--ink-muted); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--line); }
  td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr:last-child td { border-bottom: 0; }
}
.undated__deliverables { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2);
  li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); }
  input { margin-left: auto; }
}
.tag { display: inline-block; margin-left: var(--space-2); padding: 0 6px; border-radius: var(--radius-pill); background: var(--surface-sunken); font-size: var(--text-xs); }
.link { border: 0; background: none; padding: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; &:hover { text-decoration: underline; } }
@include below($bp-tablet) {
  .undated__table th:nth-child(2), .undated__table td:nth-child(2), .undated__table th:nth-child(3), .undated__table td:nth-child(3) { display: none; }
}
</style>
