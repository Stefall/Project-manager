import { defineStore } from 'pinia'

let toastId = 0

// Les versions précédentes mémorisaient le projet choisi ; ce choix n'est plus repris.
try { localStorage.removeItem('vltpm.project') } catch { /* navigation privée */ }

export const useUiStore = defineStore('ui', {
  state: () => ({
    quickAdd: { open: false, defaults: {} },
    // Panneau latéral d'édition : { kind: 'task' | 'project' | 'deliverable', id, defaults }
    editor: null,
    // Filtre projet des pages Tâches et Planning ; non mémorisé : chaque session repart sur tous les projets.
    currentProjectId: '',
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
    },
    toast(message, tone = 'info') {
      const id = ++toastId
      this.toasts.push({ id, message, tone })
      setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id) }, 3500)
    },
  },
})
