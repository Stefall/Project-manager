<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { formatDate, useTaskStats } from '@/components/useTaskStats'
import VButton from '@/design-system/components/VButton.vue'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import EmptyState from '@/design-system/components/EmptyState.vue'
import DeliverableCard from './DeliverableCard.vue'

// Fiche projet : tout ce qu'il faut pour comprendre un projet en moins de 30 secondes.
const route = useRoute()
const data = useDataStore()
const ui = useUiStore()

const project = computed(() => data.projectById[route.params.id])
const deliverables = computed(() => data.deliverablesFor(route.params.id))
const tasks = computed(() => data.tasksFor(route.params.id))
const loose = computed(() => tasks.value.filter((t) => !t.deliverableId))
const stats = useTaskStats(tasks)

</script>

<template>
  <EmptyState v-if="!project && !data.loading" title="Projet introuvable" text="Il a peut-être été archivé." />
  <div v-else-if="project" class="project">
    <header class="project__header">
      <div>
        <p class="project__client">{{ project.client }}<template v-if="project.status"> · {{ project.status }}</template></p>
        <h1 class="editorial">{{ project.name }}</h1>
        <p v-if="project.startDate || project.endDate" class="project__dates">
          {{ project.startDate ? formatDate(project.startDate) : '…' }} → {{ project.endDate ? formatDate(project.endDate) : '…' }}
        </p>
      </div>
      <div class="project__actions">
        <VButton @click="ui.openEditor('project', project.id)">Modifier</VButton>
        <VButton @click="ui.openEditor('deliverable', null, { projectId: project.id })">+ Livrable</VButton>
      </div>
    </header>

    <p v-if="project.summary" class="project__summary editorial">{{ project.summary }}</p>

    <section class="situation" aria-labelledby="situation-title">
      <h2 id="situation-title">Situation</h2>
      <p>{{ project.situation || 'Pas encore de synthèse.' }}</p>
      <div class="situation__stats">
        <span><strong>{{ stats.percent }} %</strong> d'avancement</span>
        <span><StatusBadge status="En cours" /> {{ stats.progress }}</span>
        <span><StatusBadge status="En attente" /> {{ stats.waiting }}</span>
        <span><StatusBadge status="Bloqué" /> {{ stats.blocked }}</span>
        <span v-if="stats.late.length" class="late">{{ stats.late.length }} en retard</span>
      </div>
    </section>

    <div class="project__columns">
      <section aria-labelledby="deliverables-title">
        <h2 id="deliverables-title" class="section-title">Livrables ({{ deliverables.length }})</h2>
        <EmptyState v-if="!deliverables.length" title="Aucun livrable" text="Ajoutez le premier livrable de ce projet.">
          <VButton @click="ui.openEditor('deliverable', null, { projectId: project.id })">+ Livrable</VButton>
        </EmptyState>
        <div class="deliverables">
          <DeliverableCard v-for="d in deliverables" :key="d.id" :deliverable="d" />
        </div>

        <template v-if="loose.length">
          <h2 class="section-title">Tâches hors livrable</h2>
          <ul class="loose">
            <li v-for="t in loose" :key="t.id">
              <button type="button" @click="ui.openEditor('task', t.id)"><StatusBadge :status="t.status" /> {{ t.title }}</button>
            </li>
          </ul>
        </template>
      </section>

      <aside class="aside">
        <section>
          <h2 class="section-title">Prochaines étapes</h2>
          <ol v-if="project.nextSteps?.length"><li v-for="s in project.nextSteps" :key="s">{{ s }}</li></ol>
          <p v-else class="muted">À définir.</p>
        </section>
        <section>
          <h2 class="section-title">Échéances</h2>
          <ul v-if="stats.late.length || stats.soon.length" class="deadlines">
            <li v-for="t in stats.late" :key="t.id"><span class="late">{{ formatDate(t.deadline) }}</span> {{ t.title }}</li>
            <li v-for="t in stats.soon" :key="t.id"><span>{{ formatDate(t.deadline) }}</span> {{ t.title }}</li>
          </ul>
          <p class="muted">{{ stats.undated.length }} tâche(s) avec une date à préciser.</p>
        </section>
        <section v-if="project.watchpoints?.length">
          <h2 class="section-title">Points de vigilance</h2>
          <ul><li v-for="s in project.watchpoints" :key="s">{{ s }}</li></ul>
        </section>
        <section v-if="project.achievements?.length">
          <h2 class="section-title">Réalisations principales</h2>
          <ul><li v-for="s in project.achievements" :key="s">{{ s }}</li></ul>
        </section>
        <section v-if="project.objectives || project.scope">
          <h2 class="section-title">Objectifs et périmètre</h2>
          <p v-if="project.objectives">{{ project.objectives }}</p>
          <p v-if="project.scope" class="muted">{{ project.scope }}</p>
        </section>
        <section v-if="project.links?.length">
          <h2 class="section-title">Documents de référence</h2>
          <ul><li v-for="l in project.links" :key="l.url"><a :href="l.url" target="_blank" rel="noopener">{{ l.label || l.url }}</a></li></ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.late { color: var(--status-blocked); font-weight: var(--weight-strong); }
.section-title { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin: 0 0 var(--space-3); }

.project {
  &__header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-4); h1 { font-size: var(--text-2xl); } }
  &__client { margin: 0 0 var(--space-1); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); }
  &__dates { margin: var(--space-2) 0 0; font-size: var(--text-sm); color: var(--ink-muted); }
  &__actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  &__summary { font-size: var(--text-lg); line-height: 1.5; max-width: 760px; margin: 0 0 var(--space-6); }
  &__columns { display: grid; grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr); gap: var(--space-8); align-items: start; }
}

.situation {
  margin-bottom: var(--space-8);
  padding: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 3px solid var(--ink);
  border-radius: var(--radius-md);
  h2 { font-size: var(--text-sm); margin-bottom: var(--space-2); }
  p { margin: 0 0 var(--space-4); }
  &__stats { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: center; font-size: var(--text-sm); span { display: inline-flex; align-items: center; gap: var(--space-1); } }
}

.deliverables { display: grid; gap: var(--space-4); margin-bottom: var(--space-8); }
.loose { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1);
  button { display: flex; gap: var(--space-3); align-items: center; width: 100%; text-align: left; border: 0; background: none; padding: var(--space-2); cursor: pointer; border-radius: var(--radius-sm); &:hover { background: var(--surface-sunken); } } }

.aside {
  display: grid;
  gap: var(--space-6);
  font-size: var(--text-sm);
  section { padding-bottom: var(--space-6); border-bottom: 1px solid var(--line); &:last-child { border-bottom: 0; } }
  ul, ol { margin: 0; padding-left: var(--space-4); display: grid; gap: var(--space-1); }
  p { margin: 0 0 var(--space-2); }
  .deadlines { list-style: none; padding: 0; span { display: inline-block; min-width: 56px; color: var(--ink-muted); } .late { color: var(--status-blocked); } }
}

@include below($bp-desktop) { .project__columns { grid-template-columns: 1fr; } }
@include below($bp-tablet) { .project__header { flex-direction: column; } }
</style>
