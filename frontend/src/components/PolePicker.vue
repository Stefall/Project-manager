<script setup>
import { useDataStore } from '@/stores/data'

// Pôles en cases à cocher multisélection (jamais de responsables nominatifs).
const model = defineModel({ type: Array, default: () => [] })
const data = useDataStore()
</script>

<template>
  <fieldset class="pole-picker">
    <legend>Pôles concernés</legend>
    <div class="pole-picker__list">
      <label v-for="pole in data.settings.poles" :key="pole.id" class="pole-picker__pole">
        <input v-model="model" type="checkbox" :value="pole.id" />
        <span>{{ pole.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped lang="scss">
.pole-picker {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  legend { font-size: var(--text-sm); font-weight: var(--weight-strong); margin-bottom: var(--space-2); }
  &__list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  &__pole {
    position: relative;
    input { position: absolute; opacity: 0; }
    span { display: inline-block; padding: var(--space-1) var(--space-3); border: 1px solid var(--line-strong); border-radius: var(--radius-pill); font-size: var(--text-sm); cursor: pointer; }
    input:checked + span { background: var(--ink); border-color: var(--ink); color: var(--surface); }
    input:checked + span::before { content: '✓ '; }
    input:focus-visible + span { @include focus-ring; }
  }
}
</style>
