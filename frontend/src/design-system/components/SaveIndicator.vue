<script setup>
import { computed } from 'vue'
import { useDataStore } from '@/stores/data'

const data = useDataStore()
const label = computed(() => (data.pendingWrites > 0 ? 'Enregistrement…' : 'Enregistré'))
</script>

<template>
  <span class="save-indicator" :class="{ 'save-indicator--busy': data.pendingWrites > 0 }" role="status" aria-live="polite">
    <span class="save-indicator__dot" aria-hidden="true" />{{ label }}
  </span>
</template>

<style scoped lang="scss">
.save-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--ink-muted);
  &__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--status-done); }
  &--busy &__dot { background: var(--status-progress); }
}
</style>
