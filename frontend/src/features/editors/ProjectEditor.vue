<script setup>
import { computed, reactive, watch } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { PROJECT_STATUSES } from '@/domain/projects'
import { changedFields, clone, useEditorSave } from './useEditorSave'
import VButton from '@/design-system/components/VButton.vue'
import ListEditor from '@/components/ListEditor.vue'

const props = defineProps({ id: { type: String, required: true } })
const data = useDataStore()
const ui = useUiStore()
const { errors, saving, conflict, run } = useEditorSave()

const project = computed(() => data.projectById[props.id])
const form = reactive({})
const LISTS = ['achievements', 'watchpoints', 'nextSteps', 'links']
const FIELDS = ['name', 'clientId', 'status', 'summary', 'situation', 'description', 'objectives', 'scope', 'startDate', 'endDate', ...LISTS]

function reset() {
  if (!project.value) return
  for (const f of FIELDS) form[f] = clone(project.value[f] ?? (LISTS.includes(f) ? [] : ''))
}
watch(() => props.id, reset, { immediate: true })
watch(conflict, (c) => c && reset())

function save() {
  const changes = changedFields(project.value, form)
  for (const f of ['achievements', 'watchpoints', 'nextSteps']) changes[f] &&= changes[f].map((s) => s.trim()).filter(Boolean)
  changes.links &&= changes.links.filter((l) => l.url)
  if (!Object.keys(changes).length) return ui.closeEditor()
  run(() => data.updateProject(project.value, changes))
}
</script>

<template>
  <form v-if="project" id="editor-form" class="editor" novalidate @submit.prevent="save">
    <div class="field-row">
      <label class="field" :class="{ 'field--invalid': errors.name }">
        <span>Nom du projet</span>
        <input v-model="form.name" type="text" required />
        <span v-if="errors.name" class="field__error">{{ errors.name }}</span>
      </label>
      <label class="field">
        <span>Client</span>
        <select v-model="form.clientId">
          <option v-for="c in data.clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
    </div>

    <div class="field-row">
      <label class="field">
        <span>Statut général</span>
        <select v-model="form.status">
          <option value="">Non renseigné</option>
          <option v-for="s in PROJECT_STATUSES" :key="s">{{ s }}</option>
        </select>
      </label>
      <div class="field-row">
        <label class="field"><span>Début</span><input v-model="form.startDate" type="date" /></label>
        <label class="field" :class="{ 'field--invalid': errors.endDate }">
          <span>Fin</span><input v-model="form.endDate" type="date" />
          <span v-if="errors.endDate" class="field__error">{{ errors.endDate }}</span>
        </label>
      </div>
    </div>

    <label class="field">
      <span>Présentation <span class="field__hint">permanente, une ou deux phrases</span></span>
      <textarea v-model="form.summary" rows="2" />
    </label>
    <label class="field">
      <span>Situation actuelle <span class="field__hint">à actualiser régulièrement</span></span>
      <textarea v-model="form.situation" rows="3" />
    </label>
    <label class="field">
      <span>Contexte et description</span>
      <textarea v-model="form.description" rows="3" />
    </label>
    <div class="field-row">
      <label class="field"><span>Objectifs</span><textarea v-model="form.objectives" rows="3" /></label>
      <label class="field"><span>Périmètre</span><textarea v-model="form.scope" rows="3" /></label>
    </div>

    <ListEditor v-model="form.nextSteps" label="Prochaines étapes" add-label="Ajouter une étape" />
    <ListEditor v-model="form.watchpoints" label="Points de vigilance" add-label="Ajouter un point" />
    <ListEditor v-model="form.achievements" label="Réalisations principales" add-label="Ajouter une réalisation" />
    <ListEditor v-model="form.links" kind="link" label="Documents de référence" add-label="Ajouter un lien" :error="errors.links" />

    <Teleport defer to="#editor-footer">
      <VButton variant="ghost" @click="ui.closeEditor()">Annuler</VButton>
      <VButton type="submit" form="editor-form" variant="primary" :loading="saving">Enregistrer</VButton>
    </Teleport>
  </form>
</template>
