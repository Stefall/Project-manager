<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import VDrawer from '@/design-system/components/VDrawer.vue'
import VButton from '@/design-system/components/VButton.vue'
import PolePicker from '@/components/PolePicker.vue'

// Mode réunion : le minimum de champs, le titre en premier, et « Enregistrer et créer une autre »
// qui garde le projet et le livrable pour enchaîner les tâches.
const data = useDataStore()
const ui = useUiStore()

const empty = () => ({ projectId: '', deliverableId: '', title: '', deadline: '', startDate: '', priority: 'Normale', poles: [], note: '' })
const form = reactive(empty())
const errors = ref({})
const saving = ref(false)
const titleInput = ref(null)

const deliverables = computed(() => (form.projectId ? data.deliverablesFor(form.projectId) : []))

watch(() => ui.quickAdd.open, (open) => {
  if (!open) return
  Object.assign(form, empty(), ui.quickAdd.defaults)
  errors.value = {}
})
watch(() => form.projectId, () => {
  if (!deliverables.value.some((d) => d.id === form.deliverableId)) form.deliverableId = ''
})

async function save(another) {
  errors.value = {}
  if (!form.projectId) errors.value.projectId = 'Choisissez un projet.'
  if (!form.title.trim()) errors.value.title = 'Donnez un titre à la tâche.'
  if (Object.keys(errors.value).length) return

  saving.value = true
  try {
    await data.createTask({ ...form, title: form.title.trim(), status: 'À faire' })
    ui.toast('Tâche enregistrée')
    if (another) {
      Object.assign(form, { title: '', deadline: '', startDate: '', note: '' })
      await nextTick()
      titleInput.value?.focus()
    } else {
      ui.closeQuickAdd()
    }
  } catch (e) {
    errors.value = e.fields ?? {}
    ui.toast(e.message, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <VDrawer :open="ui.quickAdd.open" title="Nouvelle tâche" @close="ui.closeQuickAdd()">
    <form id="quick-add" class="quick-add" novalidate @submit.prevent="save(false)" @keydown.ctrl.enter.prevent="save(true)" @keydown.meta.enter.prevent="save(true)">
      <div class="field-row">
        <label class="field" :class="{ 'field--invalid': errors.projectId }">
          <span>Projet</span>
          <select v-model="form.projectId" required :aria-invalid="!!errors.projectId">
            <option value="" disabled>Choisir…</option>
            <option v-for="p in data.projects" :key="p.id" :value="p.id">{{ p.client }} · {{ p.name }}</option>
          </select>
          <span v-if="errors.projectId" class="field__error">{{ errors.projectId }}</span>
        </label>
        <label class="field">
          <span>Livrable <span class="field__hint">facultatif</span></span>
          <select v-model="form.deliverableId" :disabled="!deliverables.length">
            <option value="">Aucun</option>
            <option v-for="d in deliverables" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>
      </div>

      <label class="field" :class="{ 'field--invalid': errors.title }">
        <span>Titre de la tâche</span>
        <input ref="titleInput" v-model="form.title" type="text" maxlength="200" required :aria-invalid="!!errors.title" />
        <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
      </label>

      <div class="field-row">
        <label class="field" :class="{ 'field--invalid': errors.deadline }">
          <span>Deadline</span>
          <input v-model="form.deadline" type="date" />
          <span v-if="errors.deadline" class="field__error">{{ errors.deadline }}</span>
        </label>
        <label class="field" :class="{ 'field--invalid': errors.startDate }">
          <span>Date de début <span class="field__hint">facultative</span></span>
          <input v-model="form.startDate" type="date" :max="form.deadline || undefined" />
          <span v-if="errors.startDate" class="field__error">{{ errors.startDate }}</span>
        </label>
      </div>

      <fieldset class="quick-add__group">
        <legend>Priorité</legend>
        <div class="quick-add__segmented">
          <label v-for="p in data.settings.priorities" :key="p">
            <input v-model="form.priority" type="radio" name="priority" :value="p" />
            <span>{{ p }}</span>
          </label>
        </div>
      </fieldset>

      <PolePicker v-model="form.poles" />

      <label class="field">
        <span>Notes de réunion</span>
        <textarea v-model="form.note" rows="4" />
      </label>
    </form>

    <template #footer>
      <VButton variant="ghost" @click="ui.closeQuickAdd()">Annuler</VButton>
      <VButton form="quick-add" :loading="saving" aria-keyshortcuts="Control+Enter" @click="save(true)">Enregistrer et créer une autre</VButton>
      <VButton form="quick-add" type="submit" variant="primary" :loading="saving">Enregistrer</VButton>
    </template>
  </VDrawer>
</template>

<style scoped lang="scss">
.quick-add {
  display: grid;
  gap: var(--space-6);

  &__group {
    margin: 0;
    padding: 0;
    border: 0;
    legend { font-size: var(--text-sm); font-weight: var(--weight-strong); margin-bottom: var(--space-2); }
  }

  &__segmented {
    display: inline-flex;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
    label { position: relative; }
    input { position: absolute; opacity: 0; }
    span { display: block; padding: var(--space-2) var(--space-3); font-size: var(--text-sm); cursor: pointer; border-right: 1px solid var(--line); }
    label:last-child span { border-right: 0; }
    input:checked + span { background: var(--ink); color: var(--surface); }
    input:focus-visible + span { @include focus-ring; }
  }


}
</style>
