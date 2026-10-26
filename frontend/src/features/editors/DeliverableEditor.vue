<script setup>
import { computed, reactive, watch } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { changedFields, clone, useEditorSave } from './useEditorSave'
import VButton from '@/design-system/components/VButton.vue'
import ListEditor from '@/components/ListEditor.vue'

// Création (id absent, projectId dans defaults) ou modification d'un livrable.
const props = defineProps({ id: { type: String, default: null }, defaults: { type: Object, default: () => ({}) } })
const data = useDataStore()
const ui = useUiStore()
const { errors, saving, conflict, run } = useEditorSave()

const deliverable = computed(() => (props.id ? data.deliverableById[props.id] : null))
const form = reactive({})
function reset() {
  const d = deliverable.value ?? { projectId: props.defaults.projectId ?? ui.currentProjectId ?? '' }
  Object.assign(form, { projectId: d.projectId, name: d.name ?? '', description: d.description ?? '', dueDate: d.dueDate ?? '', links: clone(d.links ?? []) })
}
watch(() => props.id, reset, { immediate: true })
watch(conflict, (c) => c && reset())

function save() {
  if (!deliverable.value) {
    return run(() => data.createDeliverable({ ...form, links: form.links.filter((l) => l.url) }), { success: 'Livrable créé' })
  }
  const changes = changedFields(deliverable.value, form)
  delete changes.projectId
  changes.links &&= changes.links.filter((l) => l.url)
  if (!Object.keys(changes).length) return ui.closeEditor()
  run(() => data.updateDeliverable(deliverable.value, changes))
}

function archive() {
  const open = data.tasksOfDeliverable(props.id).filter((t) => t.status !== 'Terminé').length
  const warning = open ? `\n${open} tâche(s) non terminée(s) y sont rattachées ; elles resteront visibles.` : ''
  if (!confirm(`Archiver le livrable « ${deliverable.value.name} » ?${warning}`)) return
  run(() => data.updateDeliverable(deliverable.value, { archived: true }), { success: 'Livrable archivé' })
}
</script>

<template>
  <form id="editor-form" class="editor" novalidate @submit.prevent="save">
    <label v-if="!deliverable" class="field" :class="{ 'field--invalid': errors.projectId }">
      <span>Projet</span>
      <select v-model="form.projectId" required>
        <option value="" disabled>Choisir…</option>
        <option v-for="p in data.projects" :key="p.id" :value="p.id">{{ p.client }} · {{ p.name }}</option>
      </select>
      <span v-if="errors.projectId" class="field__error">{{ errors.projectId }}</span>
    </label>
    <label class="field" :class="{ 'field--invalid': errors.name }">
      <span>Nom du livrable</span>
      <input v-model="form.name" type="text" required />
      <span v-if="errors.name" class="field__error">{{ errors.name }}</span>
    </label>
    <label class="field" :class="{ 'field--invalid': errors.dueDate }">
      <span>Échéance <span class="field__hint">facultative</span></span>
      <input v-model="form.dueDate" type="date" />
    </label>
    <label class="field">
      <span>Description</span>
      <textarea v-model="form.description" rows="3" />
    </label>
    <ListEditor v-model="form.links" kind="link" label="Liens" add-label="Ajouter un lien" :error="errors.links" />

    <Teleport defer to="#editor-footer">
      <VButton v-if="deliverable" variant="ghost" class="editor__danger" @click="archive">Archiver</VButton>
      <VButton variant="ghost" @click="ui.closeEditor()">Annuler</VButton>
      <VButton type="submit" form="editor-form" variant="primary" :loading="saving">{{ deliverable ? 'Enregistrer' : 'Créer le livrable' }}</VButton>
    </Teleport>
  </form>
</template>
