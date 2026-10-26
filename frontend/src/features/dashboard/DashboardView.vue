<script setup>
import { computed } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { formatDate, useTaskStats } from '@/components/useTaskStats'
import VCard from '@/design-system/components/VCard.vue'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import EmptyState from '@/design-system/components/EmptyState.vue'

const data = useDataStore()
const ui = useUiStore()

const projects = computed(() => data.projects.filter((p) => !p.archived && (!ui.currentProjectId || p.id === ui.currentProjectId)))
const tasks = computed(() => data.tasksFor(ui.currentProjectId))
const stats = useTaskStats(tasks)
const deliverables = computed(() => data.deliverables.filter((d) => projects.value.some((p) => p.id === d.projectId)))
const deliverablesDone = computed(() => deliverables.value.filter((d) => d.validatedAt || d.deliveredAt).length)

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`

const perProject = (id) => data.tasksFor(id)
const percent = (id) => {
  const list = perProject(id)
  return list.length ? Math.round((list.filter((t) => t.status === 'Terminé').length / list.length) * 100) : 0
}

const kpis = computed(() => [
  { label: 'Projets actifs', value: projects.value.length },
  { label: 'Livrables en cours', value: deliverables.value.length - deliverablesDone.value, sub: plural(deliverablesDone.value, 'terminé') },
  { label: 'Avancement', value: `${stats.value.percent} %`, sub: `${stats.value.done} sur ${plural(stats.value.total, 'tâche')}` },
  { label: 'En retard', value: stats.value.late.length, tone: stats.value.late.length ? 'blocked' : null },
])
const statusRow = computed(() => [
  ['À faire', stats.value.todo], ['En cours', stats.value.progress], ['En attente', stats.value.waiting], ['Bloqué', stats.value.blocked],
])
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>{{ ui.currentProjectId ? data.projectById[ui.currentProjectId]?.name : 'Tous les projets' }}</h1>
        <p>{{ plural(stats.total, 'tâche') }} suivies, {{ stats.blocked }} bloquée(s), {{ stats.waiting }} en attente d'un tiers.</p>
      </div>
    </header>

    <p v-if="data.loading" class="muted">Chargement…</p>

    <template v-else>
      <section class="kpis" aria-label="Indicateurs">
        <VCard v-for="k in kpis" :key="k.label" class="kpi">
          <p class="kpi__label">{{ k.label }}</p>
          <p class="kpi__value" :class="k.tone && `kpi__value--${k.tone}`">{{ k.value }}</p>
          <p v-if="k.sub" class="kpi__sub">{{ k.sub }}</p>
        </VCard>
      </section>

      <section class="statuses" aria-label="Tâches par statut">
        <RouterLink v-for="[status, n] in statusRow" :key="status" :to="{ name: 'tasks', query: { status } }" class="statuses__item">
          <StatusBadge :status="status" /><strong>{{ n }}</strong>
        </RouterLink>
      </section>

      <div class="columns">
        <section>
          <h2 class="section-title">Projets</h2>
          <EmptyState v-if="!projects.length" title="Aucun projet" text="Créez un projet depuis l'administration." />
          <VCard v-for="p in projects" :key="p.id" :to="{ name: 'project', params: { id: p.id } }" class="project-card">
            <p class="project-card__client">{{ p.client }}</p>
            <h3 class="editorial">{{ p.name }}</h3>
            <p class="project-card__summary">{{ p.summary }}</p>
            <p v-if="p.situation" class="project-card__situation"><strong>Situation.</strong> {{ p.situation }}</p>
            <div class="progress" role="img" :aria-label="`Avancement ${percent(p.id)} %`">
              <span :style="{ width: `${percent(p.id)}%` }" />
            </div>
            <p class="project-card__meta">{{ percent(p.id) }} % · {{ plural(perProject(p.id).length, 'tâche') }}</p>
          </VCard>
        </section>

        <section>
          <h2 class="section-title">Échéances</h2>
          <VCard>
            <h3 class="list-title">En retard</h3>
            <p v-if="!stats.late.length" class="muted">Aucune tâche en retard.</p>
            <ul class="deadlines">
              <li v-for="t in stats.late" :key="t.id"><span class="late">{{ formatDate(t.deadline) }}</span> {{ t.title }}</li>
            </ul>
            <h3 class="list-title">7 prochains jours</h3>
            <p v-if="!stats.soon.length" class="muted">Rien d'imminent.</p>
            <ul class="deadlines">
              <li v-for="t in stats.soon" :key="t.id"><span>{{ formatDate(t.deadline) }}</span> {{ t.title }}</li>
            </ul>
            <h3 class="list-title">Dates à préciser</h3>
            <p class="muted">{{ plural(stats.undated.length, 'tâche') }} ouverte(s) sans deadline.</p>
          </VCard>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-4); }
.kpi {
  &__label { margin: 0; font-size: var(--text-sm); color: var(--ink-muted); }
  &__value { margin: var(--space-2) 0 0; font-size: var(--text-2xl); font-weight: var(--weight-strong); }
  &__value--blocked { color: var(--status-blocked); }
  &__sub { margin: 0; font-size: var(--text-xs); color: var(--ink-muted); }
}
.statuses {
  display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-8);
  &__item { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); text-decoration: none; color: inherit; }
}
.columns { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-8); align-items: start; }
.section-title { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin-bottom: var(--space-4); }
.project-card {
  margin-bottom: var(--space-4);
  h3 { font-size: var(--text-xl); margin: var(--space-1) 0 var(--space-3); }
  &__client { margin: 0; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); }
  &__summary { margin: 0 0 var(--space-3); }
  &__situation { margin: 0 0 var(--space-4); color: var(--ink-muted); font-size: var(--text-sm); }
  &__meta { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--ink-muted); }
}
.progress { height: 6px; background: var(--surface-sunken); border-radius: var(--radius-pill); overflow: hidden; span { display: block; height: 100%; background: var(--ink); } }
.list-title { font-size: var(--text-sm); margin: var(--space-4) 0 var(--space-2); &:first-child { margin-top: 0; } }
.deadlines { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); font-size: var(--text-sm); span { display: inline-block; min-width: 56px; color: var(--ink-muted); } .late { color: var(--status-blocked); font-weight: var(--weight-strong); } }

@include below($bp-desktop) { .kpis { grid-template-columns: repeat(2, 1fr); } .columns { grid-template-columns: 1fr; } }
</style>
