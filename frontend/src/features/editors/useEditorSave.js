import { ref } from 'vue'
import { useUiStore } from '@/stores/ui'

/** Enregistre un formulaire de panneau : erreurs de champ, conflit de version, confirmation. */
export function useEditorSave() {
  const ui = useUiStore()
  const errors = ref({})
  const saving = ref(false)
  const conflict = ref(false)

  async function run(action, { success = 'Enregistré', close = true } = {}) {
    errors.value = {}
    conflict.value = false
    saving.value = true
    try {
      const result = await action()
      ui.toast(success)
      if (close) ui.closeEditor()
      return result
    } catch (e) {
      errors.value = e.fields ?? {}
      if (e.isConflict) {
        conflict.value = true
        ui.toast('Modifié entre-temps par quelqu\'un d\'autre : la version à jour est affichée.', 'error')
      } else {
        ui.toast(e.message, 'error')
      }
      return null
    } finally {
      saving.value = false
    }
  }

  return { errors, saving, conflict, run }
}

/** Champs modifiés entre l'original et le formulaire (comparaison profonde simple). */
export function changedFields(original, form) {
  return Object.fromEntries(Object.entries(form).filter(([k, v]) => JSON.stringify(v ?? '') !== JSON.stringify(original[k] ?? '')))
}

/** Copie profonde d'une valeur du store (structuredClone échoue sur les proxys réactifs). */
export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}
