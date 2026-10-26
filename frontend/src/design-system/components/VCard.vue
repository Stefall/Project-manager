<script setup>
defineProps({ to: { type: [String, Object], default: null } })
</script>

<template>
  <component :is="to ? 'RouterLink' : 'div'" :to="to" class="v-card" :class="{ 'v-card--link': to }">
    <slot />
  </component>
</template>

<style scoped lang="scss">
.v-card {
  display: block;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  text-decoration: none;
  color: inherit;

  &--link { transition: border-color var(--duration) var(--ease); }
  &--link:hover { border-color: var(--line-strong); }
}
</style>
