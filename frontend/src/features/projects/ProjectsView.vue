<script setup>
import { computed } from 'vue'
import { useDataStore } from '@/stores/data'
import VCard from '@/design-system/components/VCard.vue'
import EmptyState from '@/design-system/components/EmptyState.vue'

const data = useDataStore()

// Client → Projets, avec l'avancement calculé sur les tâches terminées.
const groups = computed(() => {
  const byClient = new Map()
  for (const p of data.projects) {
    const key = p.client || 'Sans client'
    if (!byClient.has(key)) byClient.set(key, [])
    const tasks = data.tasksFor(p.id)
    const done = tasks.filter((t) => t.status === 'Terminé').length
    byClient.get(key).push({
      ...p,
      taskCount: tasks.length,
      blocked: tasks.filter((t) => t.status === 'Bloqué').length,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      deliverableCount: data.deliverablesFor(p.id).length,
    })
  }
  return [...byClient.entries()].sort(([a], [b]) => a.localeCompare(b))
})
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>Projets</h1>
        <p>{{ data.projects.length }} projet(s) actif(s), classés par client.</p>
      </div>
    </header>

    <EmptyState v-if="!data.projects.length && !data.loading" title="Aucun projet" />

    <section v-for="[client, projects] in groups" :key="client" class="client">
      <h2 class="client__name">{{ client }}</h2>
      <div class="client__grid">
        <VCard v-for="p in projects" :key="p.id" :to="{ name: 'project', params: { id: p.id } }" class="project">
          <p v-if="p.status" class="project__status">{{ p.status }}</p>
          <h3 class="editorial">{{ p.name }}</h3>
          <p class="project__summary">{{ p.summary }}</p>
          <div class="progress" role="img" :aria-label="`Avancement ${p.percent} %`"><span :style="{ width: `${p.percent}%` }" /></div>
          <p class="project__meta">
            {{ p.percent }} % · {{ p.deliverableCount }} livrable(s) · {{ p.taskCount }} tâche(s)
            <strong v-if="p.blocked" class="project__blocked">· {{ p.blocked }} bloquée(s)</strong>
          </p>
        </VCard>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.client {
  margin-bottom: var(--space-8);
  &__name { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin-bottom: var(--space-4); }
  &__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4); }
}
.project {
  h3 { font-size: var(--text-xl); margin: 0 0 var(--space-2); }
  &__status { margin: 0 0 var(--space-1); font-size: var(--text-xs); color: var(--ink-muted); }
  &__summary { margin: 0 0 var(--space-4); color: var(--ink-muted); font-size: var(--text-sm); }
  &__meta { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--ink-muted); }
  &__blocked { color: var(--status-blocked); }
}
.progress { height: 6px; background: var(--surface-sunken); border-radius: var(--radius-pill); overflow: hidden; span { display: block; height: 100%; background: var(--ink); } }
</style>
