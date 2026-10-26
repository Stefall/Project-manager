<script setup>
defineProps({
  variant: { type: String, default: 'secondary' }, // primary | secondary | ghost
  size: { type: String, default: 'md' }, // sm | md
  type: { type: String, default: 'button' },
  loading: Boolean,
})
</script>

<template>
  <button :type="type" class="v-button" :class="[`v-button--${variant}`, `v-button--${size}`]" :disabled="loading" :aria-busy="loading || undefined">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.v-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-weight: var(--weight-strong);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--duration) var(--ease);
  white-space: nowrap;

  &--md { height: 36px; padding: 0 var(--space-4); }
  &--sm { height: 28px; padding: 0 var(--space-3); font-size: var(--text-xs); }

  &--primary { background: var(--ink); border-color: var(--ink); color: var(--surface); }
  &--primary:hover { background: #333; }
  &--secondary:hover { background: var(--surface-sunken); }
  &--ghost { border-color: transparent; background: transparent; }
  &--ghost:hover { background: var(--surface-sunken); }

  &:disabled { opacity: 0.6; cursor: progress; }
}
</style>
