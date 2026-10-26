<script setup>
defineProps({ title: { type: String, required: true }, text: { type: String, default: '' } })
</script>

<template>
  <div class="empty-state">
    <p class="empty-state__title editorial">{{ title }}</p>
    <p v-if="text" class="empty-state__text">{{ text }}</p>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  padding: var(--space-12) var(--space-6);
  text-align: center;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
  &__title { font-size: var(--text-lg); margin: 0 0 var(--space-2); }
  &__text { color: var(--ink-muted); margin: 0 0 var(--space-4); }
}
</style>
