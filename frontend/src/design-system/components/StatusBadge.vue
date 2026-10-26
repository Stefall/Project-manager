<script setup>
import { computed } from 'vue'

// La couleur n'est jamais le seul indicateur : chaque statut a sa forme d'icône et son libellé.
const props = defineProps({ status: { type: String, required: true } })

const map = {
  'À faire': { tone: 'todo', icon: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z' },
  'En cours': { tone: 'progress', icon: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 0v11a5.5 5.5 0 0 0 0-11Z' },
  'En attente': { tone: 'waiting', icon: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 5v3.2l2 1.3' },
  'Bloqué': { tone: 'blocked', icon: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM5 8h6' },
  'Terminé': { tone: 'done', icon: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM5.5 8.2l1.7 1.7 3.3-3.6' },
}
const entry = computed(() => map[props.status] ?? map['À faire'])
</script>

<template>
  <span class="status-badge" :class="`status-badge--${entry.tone}`">
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path :d="entry.icon" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {{ status }}
  </span>
</template>

<style scoped lang="scss">
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--weight-strong);
  white-space: nowrap;

  @each $tone in todo, progress, waiting, blocked, done {
    &--#{$tone} { color: var(--status-#{$tone}); background: var(--status-#{$tone}-bg); }
  }
}
</style>
