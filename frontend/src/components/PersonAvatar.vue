<script setup>
import { computed } from 'vue'
import { initials } from '@/domain/team'

// Pastille aux initiales d'une personne de l'annuaire ; le nom complet est toujours donné en texte alternatif.
const props = defineProps({ person: { type: Object, required: true }, size: { type: String, default: 'md' } })
// Teinte stable par personne, prise dans une palette sobre (jamais le seul indice : les initiales restent lisibles).
const TONES = ['progress', 'waiting', 'done', 'todo']
const tone = computed(() => TONES[[...String(props.person.id)].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length])
</script>

<template>
  <span class="avatar" :class="[`avatar--${size}`, `avatar--${tone}`]" :title="person.name" role="img" :aria-label="person.name">{{ initials(person.name) }}</span>
</template>

<style scoped lang="scss">
.avatar {
  display: inline-grid; place-items: center; flex: none; border-radius: 50%; font-weight: var(--weight-strong); letter-spacing: 0.02em;
  border: 2px solid var(--surface);
  &--md { width: 28px; height: 28px; font-size: 11px; }
  &--sm { width: 22px; height: 22px; font-size: 9.5px; }
  @each $tone in todo, progress, waiting, done {
    &--#{$tone} { background: var(--status-#{$tone}-bg); color: var(--status-#{$tone}); }
  }
}
</style>
