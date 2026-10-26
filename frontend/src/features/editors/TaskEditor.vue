<script setup>
import { computed, reactive, watch } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { changedFields, clone, useEditorSave } from './useEditorSave'
import VButton from '@/design-system/components/VButton.vue'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import PolePicker from '@/components/PolePicker.vue'
import ListEditor from '@/components/ListEditor.vue'

const props = defineProps({ id: { type: String, required: true } })
const data = useDataStore()
const ui = useUiStore()
const { errors, saving, conflict, run } = useEditorSave()

const task = computed(() => data.taskById[props.id])
const form = reactive({})
const deliverables = computed(() => data.deliverablesFor(form.projectId))

const FIELDS = ['title', 'projectId', 'deliverableId', 'status', 'priority', 'poles', 'startDate', 'deadline', 'deadlineText', 'description', 'checklist', 'links', 'note']
function reset() {
  if (!task.value) return
  for (const f of FIELDS) form[f] = clone(task.value[f] ?? (['poles', 'checklist', 'links'].includes(f) ? [] : ''))
}
watch(() => props.id, reset, { immediate: true })
// Après un conflit, le formulaire reprend la version du collègue.
watch(conflict, (c) => c && reset())

const checklistDone = computed(() => form.checklist?.filter((c) => c.done).length ?? 0)
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function save() {
  const changes = changedFields(task.value, form)
  changes.checklist &&= changes.checklist.filter((c) => c.label.trim())
  changes.links &&= changes.links.filter((l) => l.url)
  if (!Object.keys(changes).length) return ui.closeEditor()
  run(() => data.updateTask(task.value, changes))
}

function archive() {
  if (!confirm(`Archiver « ${task.value.title} » ? Elle disparaîtra des vues mais restera dans l'historique.`)) return
  run(() => data.archiveTask(task.value), { success: 'Tâche archivée' })
}
</script>

<template>
  <form v-if="task" id="editor-form" class="editor" novalidate @submit.prevent="save">
    <p class="editor__meta">
      <span>{{ task.id }}</span>
      <StatusBadge :status="task.status" />
      <span v-if="form.checklist.length">Checklist {{ checklistDone }}/{{ form.checklist.length }}</span>
    </p>

    <label class="field" :class="{ 'field--invalid': errors.title }">
      <span>Intitulé</span>
      <input v-model="form.title" type="text" maxlength="200" required />
      <span v-if="errors.title" class="field__error">{{ errors.title }}</span>
    </label>

    <div class="field-row">
      <label class="field">
        <span>Statut</span>
        <select v-model="form.status">
          <option v-for="s in data.settings.statuses" :key="s.id">{{ s.id }}</option>
        </select>
      </label>
      <label class="field">
        <span>Priorité</span>
        <select v-model="form.priority">
          <option v-for="p in data.settings.priorities" :key="p">{{ p }}</option>
        </select>
      </label>
    </div>
    <p class="editor__hint">« En attente » : on attend un tiers, c'est normal. « Bloqué » : quelque chose empêche d'avancer et demande une action.</p>

    <div class="field-row">
      <label class="field">
        <span>Projet</span>
        <select v-model="form.projectId" @change="form.deliverableId = ''">
          <option v-for="p in data.projects" :key="p.id" :value="p.id">{{ p.client }} · {{ p.name }}</option>
        </select>
      </label>
      <label class="field" :class="{ 'field--invalid': errors.deliverableId }">
        <span>Livrable</span>
        <select v-model="form.deliverableId">
          <option value="">Aucun</option>
          <option v-for="d in deliverables" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
        <span v-if="errors.deliverableId" class="field__error">{{ errors.deliverableId }}</span>
      </label>
    </div>

    <div class="field-row">
      <label class="field" :class="{ 'field--invalid': errors.startDate }">
        <span>Date de début <span class="field__hint">facultative</span></span>
        <input v-model="form.startDate" type="date" :max="form.deadline || undefined" />
        <span v-if="errors.startDate" class="field__error">{{ errors.startDate }}</span>
      </label>
      <label class="field" :class="{ 'field--invalid': errors.deadline }">
        <span>Deadline</span>
        <input v-model="form.deadline" type="date" />
        <span v-if="errors.deadline" class="field__error">{{ errors.deadline }}</span>
      </label>
    </div>
    <label v-if="!form.deadline" class="field">
      <span>Échéance approximative <span class="field__hint">tant que la date n'est pas fixée</span></span>
      <input v-model="form.deadlineText" type="text" placeholder="Ex. Semaine 45, fin novembre" />
    </label>

    <PolePicker v-model="form.poles" />

    <label class="field">
      <span>Description</span>
      <textarea v-model="form.description" rows="4" />
    </label>

    <ListEditor v-model="form.checklist" kind="check" label="Checklist" add-label="Ajouter un point" />
    <ListEditor v-model="form.links" kind="link" label="Liens documentaires" add-label="Ajouter un lien" :error="errors.links" />

    <label class="field">
      <span>Notes et commentaires</span>
      <textarea v-model="form.note" rows="4" />
    </label>

    <dl class="editor__dates">
      <div v-if="task.createdAt"><dt>Créée</dt><dd>{{ fmt(task.createdAt) }}</dd></div>
      <div v-if="task.updatedAt"><dt>Modifiée</dt><dd>{{ fmt(task.updatedAt) }}<template v-if="task.updatedBy"> par {{ task.updatedBy }}</template></dd></div>
      <div v-if="task.completedAt"><dt>Clôturée</dt><dd>{{ fmt(task.completedAt) }}</dd></div>
    </dl>

    <Teleport defer to="#editor-footer">
      <VButton variant="ghost" class="editor__danger" @click="archive">Archiver</VButton>
      <VButton variant="ghost" @click="ui.closeEditor()">Annuler</VButton>
      <VButton type="submit" form="editor-form" variant="primary" :loading="saving">Enregistrer</VButton>
    </Teleport>
  </form>
  <p v-else>Cette tâche n'existe plus ou a été archivée.</p>
</template>

<style lang="scss">
.editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-6);
  &__meta { display: flex; align-items: center; gap: var(--space-3); margin: 0; font-size: var(--text-xs); color: var(--ink-muted); }
  &__hint { margin: calc(var(--space-4) * -1) 0 0; font-size: var(--text-xs); color: var(--ink-muted); }
  &__dates {
    display: grid; gap: var(--space-1); margin: 0; font-size: var(--text-xs); color: var(--ink-muted);
    div { display: flex; gap: var(--space-2); }
    dt { min-width: 64px; }
    dd { margin: 0; }
  }
  &__danger { margin-right: auto; color: var(--status-blocked); }
}
</style>
