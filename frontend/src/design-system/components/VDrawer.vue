<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({ open: Boolean, title: { type: String, required: true } })
const emit = defineEmits(['close'])
const panel = ref(null)
let returnFocus = null

// Focus déplacé dans le panneau à l'ouverture, rendu à l'élément d'origine à la fermeture.
watch(() => props.open, async (open) => {
  if (open) {
    returnFocus = document.activeElement
    await nextTick()
    panel.value?.querySelector('input, select, textarea, button')?.focus()
  } else {
    returnFocus?.focus?.()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="v-drawer" @keydown.esc="emit('close')">
        <div class="v-drawer__scrim" @click="emit('close')" />
        <aside ref="panel" class="v-drawer__panel" role="dialog" aria-modal="true" :aria-label="title">
          <header class="v-drawer__header">
            <h2>{{ title }}</h2>
            <button class="v-drawer__close" type="button" aria-label="Fermer" @click="emit('close')">×</button>
          </header>
          <div class="v-drawer__body"><slot /></div>
          <footer v-if="$slots.footer" class="v-drawer__footer"><slot name="footer" /></footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.v-drawer {
  position: fixed;
  inset: 0;
  z-index: 50;

  &__scrim { position: absolute; inset: 0; background: rgb(17 17 17 / 0.2); }

  &__panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(var(--drawer-width), 100vw);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-left: 1px solid var(--line);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--line);
    h2 { font-size: var(--text-lg); }
  }

  &__close { border: 0; background: none; font-size: 22px; cursor: pointer; padding: var(--space-1) var(--space-2); }
  &__body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: var(--space-6); > * { min-width: 0; } }
  &__footer { display: flex; gap: var(--space-2); justify-content: flex-end; flex-wrap: wrap; padding: var(--space-4) var(--space-6); border-top: 1px solid var(--line); }
}

.drawer-enter-active, .drawer-leave-active { transition: opacity var(--duration) var(--ease); }
.drawer-enter-active .v-drawer__panel, .drawer-leave-active .v-drawer__panel { transition: transform var(--duration) var(--ease); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .v-drawer__panel, .drawer-leave-to .v-drawer__panel { transform: translateX(24px); }
</style>
