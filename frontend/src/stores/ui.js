import { defineStore } from 'pinia'

let toastId = 0

function savedProject() {
  try { return localStorage.getItem('vltpm.project') || '' } catch { return '' }
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    quickAdd: { open: false, defaults: {} },
    // Panneau latéral d'édition : { kind: 'task' | 'project' | 'deliverable', id, defaults }
    editor: null,
    currentProjectId: savedProject(),
    toasts: [],
  }),
  actions: {
    openQuickAdd(defaults = {}) {
      this.quickAdd = { open: true, defaults }
    },
    closeQuickAdd() {
      this.quickAdd.open = false
    },
    openEditor(kind, id = null, defaults = {}) {
      this.editor = { kind, id, defaults }
    },
    closeEditor() {
      this.editor = null
    },
    selectProject(id) {
      this.currentProjectId = id
      try { localStorage.setItem('vltpm.project', id) } catch { /* navigation privée */ }
    },
    toast(message, tone = 'info') {
      const id = ++toastId
      this.toasts.push({ id, message, tone })
      setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id) }, 3500)
    },
  },
})
