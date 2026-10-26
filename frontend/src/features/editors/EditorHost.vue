<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import VDrawer from '@/design-system/components/VDrawer.vue'
import TaskEditor from './TaskEditor.vue'
import ProjectEditor from './ProjectEditor.vue'
import DeliverableEditor from './DeliverableEditor.vue'

// Un seul panneau latéral d'édition pour toute l'application, piloté par ui.editor.
const ui = useUiStore()
const views = {
  task: { component: TaskEditor, title: 'Tâche' },
  project: { component: ProjectEditor, title: 'Modifier le projet' },
  deliverable: { component: DeliverableEditor, title: 'Livrable' },
}
const view = computed(() => views[ui.editor?.kind])
const title = computed(() => (ui.editor?.kind === 'deliverable' && !ui.editor.id ? 'Nouveau livrable' : view.value?.title ?? ''))
</script>

<template>
  <VDrawer :open="!!view" :title="title" @close="ui.closeEditor()">
    <component :is="view.component" v-if="view" :id="ui.editor.id" :key="`${ui.editor.kind}-${ui.editor.id}`" :defaults="ui.editor.defaults" />
    <template #footer><div id="editor-footer" class="editor-footer" /></template>
  </VDrawer>
</template>

<style scoped>
.editor-footer { display: flex; gap: var(--space-2); justify-content: flex-end; flex-wrap: wrap; width: 100%; }
</style>
