<script setup>
import { reactive, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { MILESTONES } from '@/domain/projects'
import { formatDate } from '@/components/useTaskStats'
import VButton from '@/design-system/components/VButton.vue'

// Validé, livré et publié : trois jalons distincts, jamais déduits du statut des tâches.
const props = defineProps({ deliverable: { type: Object, required: true } })
const data = useDataStore()
const ui = useUiStore()

const today = () => new Date().toISOString().slice(0, 10)
const open = ref(null) // action en cours de saisie
const form = reactive({ date: today(), note: '', link: '' })
const errors = ref({})
const saving = ref(false)

function start(action) {
  open.value = action
  Object.assign(form, { date: today(), note: '', link: '' })
  errors.value = {}
}

async function submit(action, undo = false) {
  const m = MILESTONES[action]
  if (undo && !confirm(`Annuler « ${m.label} » pour ce livrable ? L'annulation sera gardée dans l'historique.`)) return
  saving.value = true
  try {
    await data.setMilestone(props.deliverable, action, m.field, undo ? { undo: true } : { ...form })
    ui.toast(undo ? `${m.label} annulé` : `Livrable marqué « ${m.label.toLowerCase()} »`)
    open.value = null
  } catch (e) {
    errors.value = e.fields ?? {}
    ui.toast(e.message, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="milestones">
    <ul class="milestones__list">
      <li v-for="(m, action) in MILESTONES" :key="action">
        <span v-if="deliverable[m.field]" class="milestone milestone--done">
          ✓ {{ m.label }} le {{ formatDate(deliverable[m.field]) }}
          <button type="button" class="milestone__undo" :aria-label="`Annuler ${m.label}`" @click="submit(action, true)">annuler</button>
        </span>
        <button v-else type="button" class="milestone" :aria-expanded="open === action" @click="open === action ? (open = null) : start(action)">
          {{ m.verb }}
        </button>
      </li>
    </ul>

    <form v-if="open" class="milestones__form" @submit.prevent="submit(open)">
      <p class="milestones__title">{{ MILESTONES[open].verb }}</p>
      <div class="field-row">
        <label class="field" :class="{ 'field--invalid': errors.date }">
          <span>Date</span>
          <input v-model="form.date" type="date" required />
          <span v-if="errors.date" class="field__error">{{ errors.date }}</span>
        </label>
        <label class="field" :class="{ 'field--invalid': errors.link }">
          <span>Lien <span class="field__hint">facultatif</span></span>
          <input v-model="form.link" type="url" placeholder="https://…" />
          <span v-if="errors.link" class="field__error">{{ errors.link }}</span>
        </label>
      </div>
      <label class="field">
        <span>Note <span class="field__hint">facultative, reprise dans le bilan</span></span>
        <input v-model="form.note" type="text" />
      </label>
      <div class="milestones__actions">
        <VButton size="sm" variant="ghost" @click="open = null">Annuler</VButton>
        <VButton size="sm" type="submit" variant="primary" :loading="saving">Confirmer</VButton>
      </div>
    </form>
  </div>
</template>

<style scoped lang="scss">
.milestones {
  &__list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  &__form { margin-top: var(--space-3); padding: var(--space-4); background: var(--surface-sunken); border-radius: var(--radius-sm); display: grid; gap: var(--space-3); }
  &__title { margin: 0; font-weight: var(--weight-strong); font-size: var(--text-sm); }
  &__actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
}
.milestone {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 28px;
  padding: 0 var(--space-3);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-pill);
  background: none;
  font-size: var(--text-xs);
  cursor: pointer;
  &--done { border-style: solid; border-color: var(--status-done); color: var(--status-done); background: var(--status-done-bg); cursor: default; font-weight: var(--weight-strong); }
  &__undo { border: 0; background: none; padding: 0; font-size: var(--text-xs); color: var(--ink-muted); text-decoration: underline; cursor: pointer; font-weight: var(--weight-regular); }
}
</style>
