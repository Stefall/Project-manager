<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useDataStore } from '@/stores/data'
import { slug } from '@/domain/admin'
import VButton from '@/design-system/components/VButton.vue'
import StatusBadge from '@/design-system/components/StatusBadge.vue'

// Pôles et priorités modifiables ; statuts affichés (ils structurent le Kanban, les bilans et l'historique).
const props = defineProps({ admin: { type: Object, required: true } })
const write = inject('adminWrite')
const data = useDataStore()

const poles = ref([])
const priorities = ref([])
const reset = () => {
  poles.value = data.settings.poles.map((p) => ({ ...p }))
  priorities.value = [...data.settings.priorities]
}
watch(() => data.settings, reset, { immediate: true })

const usage = computed(() => {
  const count = {}
  for (const t of data.tasks) {
    for (const p of t.poles ?? []) count[p] = (count[p] ?? 0) + 1
    count[`prio:${t.priority}`] = (count[`prio:${t.priority}`] ?? 0) + 1
  }
  return count
})
const dirty = (key) => JSON.stringify(key === 'poles' ? poles.value : priorities.value) !== JSON.stringify(data.settings[key])

const newPole = ref('')
function addPole() {
  const label = newPole.value.trim()
  if (!label) return
  let id = slug(label) || 'pole'
  while (poles.value.some((p) => p.id === id)) id += '-2'
  poles.value.push({ id, label, legacy: [] })
  newPole.value = ''
}
const newPriority = ref('')
function addPriority() {
  const label = newPriority.value.trim()
  if (label && !priorities.value.includes(label)) priorities.value.push(label)
  newPriority.value = ''
}
function move(list, i, delta) {
  const j = i + delta
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
}

const saving = ref('')
async function save(key) {
  saving.value = key
  const value = key === 'poles' ? poles.value.map((p) => ({ ...p, label: p.label.trim() })) : priorities.value
  await write((b) => b.updateSetting(key, value, props.admin.settingVersions[key] ?? 0), key === 'poles' ? 'Pôles enregistrés.' : 'Priorités enregistrées.')
  saving.value = ''
}
</script>

<template>
  <div>
    <section class="admin-section" aria-labelledby="poles-title">
      <h2 id="poles-title">Pôles de compétences</h2>
      <p class="admin-hint">Un pôle encore utilisé par des tâches ne peut pas être supprimé : masquez-le pour qu'il ne soit plus proposé à la saisie. Les tâches existantes le gardent.</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th scope="col">Ordre</th><th scope="col">Libellé</th><th scope="col">Tâches</th><th scope="col">Proposé à la saisie</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="(p, i) in poles" :key="p.id" :class="{ 'is-off': p.hidden }">
              <td class="order">
                <button type="button" :aria-label="`Monter ${p.label}`" :disabled="i === 0" @click="move(poles, i, -1)">↑</button>
                <button type="button" :aria-label="`Descendre ${p.label}`" :disabled="i === poles.length - 1" @click="move(poles, i, 1)">↓</button>
              </td>
              <td><input v-model="p.label" type="text" maxlength="80" :aria-label="`Libellé du pôle ${p.id}`" /></td>
              <td>{{ usage[p.id] ?? 0 }}</td>
              <td><label class="check"><input type="checkbox" :checked="!p.hidden" @change="p.hidden = !$event.target.checked || undefined"> {{ p.hidden ? 'Masqué' : 'Oui' }}</label></td>
              <td class="actions"><VButton v-if="!usage[p.id]" size="sm" variant="ghost" @click="poles.splice(i, 1)">Supprimer</VButton></td>
            </tr>
          </tbody>
        </table>
      </div>
      <form class="admin-form" @submit.prevent="addPole">
        <label class="field"><span>Nouveau pôle</span><input v-model="newPole" type="text" maxlength="80" placeholder="Motion design" /></label>
        <VButton type="submit">Ajouter</VButton>
        <span class="spacer" />
        <VButton :disabled="!dirty('poles')" @click="reset">Annuler</VButton>
        <VButton variant="primary" :loading="saving === 'poles'" :disabled="!dirty('poles')" @click="save('poles')">Enregistrer les pôles</VButton>
      </form>
    </section>

    <section class="admin-section" aria-labelledby="priorities-title">
      <h2 id="priorities-title">Priorités</h2>
      <ol class="chips">
        <li v-for="(p, i) in priorities" :key="p">
          <button type="button" :aria-label="`Monter ${p}`" :disabled="i === 0" @click="move(priorities, i, -1)">↑</button>
          <span>{{ p }}</span><small>{{ usage[`prio:${p}`] ?? 0 }} tâche(s)</small>
          <button v-if="!usage[`prio:${p}`]" type="button" :aria-label="`Supprimer ${p}`" @click="priorities.splice(i, 1)">×</button>
        </li>
      </ol>
      <form class="admin-form" @submit.prevent="addPriority">
        <label class="field"><span>Nouvelle priorité</span><input v-model="newPriority" type="text" maxlength="40" /></label>
        <VButton type="submit">Ajouter</VButton>
        <span class="spacer" />
        <VButton :disabled="!dirty('priorities')" @click="reset">Annuler</VButton>
        <VButton variant="primary" :loading="saving === 'priorities'" :disabled="!dirty('priorities')" @click="save('priorities')">Enregistrer les priorités</VButton>
      </form>
    </section>

    <section class="admin-section" aria-labelledby="statuses-title">
      <h2 id="statuses-title">Statuts des tâches</h2>
      <p class="statuses"><StatusBadge v-for="s in data.settings.statuses" :key="s.id" :status="s.id" /></p>
      <p class="admin-hint">Les cinq statuts structurent le Kanban, le dashboard, le planning et les bilans (une tâche n'est réalisée qu'en passant à « Terminé »). Ils ne sont donc pas modifiables ici.</p>
    </section>
  </div>
</template>

<style lang="scss" src="./admin.scss"></style>
<style scoped lang="scss">
.order { white-space: nowrap; }
.order button, .chips button { border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius-sm); cursor: pointer; padding: 0 6px; }
button:disabled { opacity: 0.35; cursor: default; }
.check { display: inline-flex; align-items: center; gap: var(--space-2); }
.spacer { flex: 1 1 auto; }
.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2);
  li { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-pill); font-size: var(--text-sm); }
  small { color: var(--ink-muted); }
}
.statuses { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0; }
</style>
