<script setup>
import { computed } from 'vue'
import { useDataStore } from '@/stores/data'
import { poleInfo } from '@/domain/poles'

// Pastilles colorées des pôles d'une tâche. Accepte des identifiants (lus dans les paramètres)
// ou des pôles déjà résolus { id, label, short, color } (bilans figés).
const props = defineProps({ poles: { type: Array, default: () => [] } })
const data = useDataStore()
const items = computed(() => props.poles.map((p) => (typeof p === 'string' ? poleInfo(p, data.settings.poles) : p)))
</script>

<template>
  <span v-if="items.length" class="poles">
    <span v-for="p in items" :key="p.id" class="pole" :style="{ '--pole': p.color }" :title="p.label">{{ p.short }}</span>
  </span>
</template>

<style scoped lang="scss">
.poles { display: inline-flex; flex-wrap: wrap; gap: 4px; vertical-align: middle; }
.pole {
  display: inline-flex; align-items: center; gap: 4px; padding: 0 7px; border-radius: var(--radius-pill);
  font-size: 11px; line-height: 18px; font-weight: 600; white-space: nowrap;
  color: var(--pole); background: color-mix(in srgb, var(--pole) 12%, transparent);
  &::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--pole); }
}
@media print { .pole { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
