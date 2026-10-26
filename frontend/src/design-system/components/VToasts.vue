<script setup>
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="v-toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in ui.toasts" :key="t.id" class="v-toast" :class="`v-toast--${t.tone}`">
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.v-toasts { position: fixed; bottom: var(--space-6); left: 50%; transform: translateX(-50%); display: grid; gap: var(--space-2); z-index: 60; }
.v-toast {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: var(--surface);
  font-size: var(--text-sm);
  &--error { background: var(--status-blocked); }
}
.toast-enter-active, .toast-leave-active { transition: opacity var(--duration) var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; }
</style>
