<script setup>
import { computed } from 'vue'
import { MILESTONE_LABELS } from '@/domain/reports'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import PoleTags from '@/components/PoleTags.vue'

// Mise en page d'un bilan (aperçu ou version figée), pensée aussi pour l'impression en PDF.
// N'utilise que le contenu du bilan : une version figée se relit à l'identique.
const props = defineProps({
  content: { type: Object, required: true },
  meta: { type: Object, default: null }, // { number, createdAt, createdBy, comment } pour une version figée
})

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthLabel = computed(() => MONTH.format(new Date(`${props.content.month}-01T00:00:00Z`)))
const short = (iso) => SHORT.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
const long = (iso) => DATE.format(new Date(iso))

const projectName = (id) => props.content.projects.find((p) => p.id === id)?.name ?? ''
const STEP = { validated: 'Validé', delivered: 'Livré', published: 'Publié' }
const multi = computed(() => props.content.projects.length > 1)
const title = computed(() => (props.content.projectId ? props.content.projects[0]?.name : 'Tous les projets en cours'))
const milestones = computed(() => Object.entries(props.content.milestones).filter(([, list]) => list.length))
const highlights = computed(() => [
  { label: 'Tâches terminées', value: props.content.completedTasks.length },
  ...Object.entries(props.content.milestones).map(([key, list]) => ({ label: MILESTONE_LABELS[key], value: list.length })),
  { label: 'Tâches créées', value: props.content.activity.created },
])
</script>

<template>
  <article class="report">
    <header class="report__header">
      <p class="report__kicker">Bilan mensuel · {{ monthLabel }}</p>
      <h2 class="editorial">{{ title }}</h2>
      <p v-if="content.projects[0]?.client && content.projectId" class="report__client">{{ content.projects[0].client }}</p>
      <p class="report__meta">
        <template v-if="meta">Version {{ meta.number }} figée le {{ long(meta.createdAt) }} par {{ meta.createdBy }}</template>
        <template v-else>Aperçu calculé le {{ long(content.generatedAt) }} à partir de l'historique, non figé</template>
      </p>
      <p v-if="meta?.comment" class="report__comment">{{ meta.comment }}</p>
    </header>

    <section class="report__figures" aria-label="Chiffres du mois">
      <div v-for="h in highlights" :key="h.label"><strong>{{ h.value }}</strong><span>{{ h.label }}</span></div>
    </section>

    <section v-for="p in content.projects.filter((x) => x.situation || x.nextSteps.length || x.watchpoints.length)" :key="p.id" class="report__section">
      <h3>{{ multi ? p.name : 'Situation' }}</h3>
      <p v-if="p.situation">{{ p.situation }}</p>
      <div class="report__cols">
        <div v-if="p.nextSteps.length"><h4>Prochaines étapes</h4><ul><li v-for="s in p.nextSteps" :key="s">{{ s }}</li></ul></div>
        <div v-if="p.watchpoints.length"><h4>Points de vigilance</h4><ul><li v-for="s in p.watchpoints" :key="s">{{ s }}</li></ul></div>
      </div>
    </section>

    <!-- Bilans récents : un bloc par livrable, comme sur la page projet. -->
    <section v-if="content.byDeliverable" class="report__section">
      <h3>Livrables et tâches terminées</h3>
      <p v-if="!content.byDeliverable.length" class="muted">Aucun livrable validé, livré ou publié et aucune tâche terminée ce mois-ci.</p>
      <div v-for="d in content.byDeliverable" :key="d.id || 'hors'" class="deliv">
        <div class="deliv__head">
          <h4>{{ d.id ? d.name : 'Hors livrable' }}<span v-if="multi && d.projectId" class="muted"> · {{ projectName(d.projectId) }}</span></h4>
          <span v-if="d.id" class="muted">{{ d.done }}/{{ d.total }} tâche(s) terminée(s)</span>
        </div>
        <div v-if="d.total" class="deliv__bar" role="img" :aria-label="`Avancement ${Math.round((d.done / d.total) * 100)} %`">
          <span :style="{ width: `${Math.round((d.done / d.total) * 100)}%` }" />
        </div>
        <ul v-if="d.milestones.length" class="deliv__milestones">
          <li v-for="m in d.milestones" :key="m.key">✓ {{ STEP[m.key] }} le {{ short(m.date) }}</li>
        </ul>
        <ul v-if="d.tasks.length" class="report__list">
          <li v-for="t in d.tasks" :key="t.id">
            <span class="date">{{ t.date ? short(t.date) : '—' }}</span> {{ t.title }}
            <span v-if="!t.date" class="muted"> · terminée dans l'ancien outil, date inconnue</span>
            <span v-if="t.reopened" class="tag">rouverte depuis</span>
          </li>
        </ul>
        <p v-else class="muted">Aucune tâche terminée ce mois-ci.</p>
      </div>
    </section>

    <!-- Versions figées avant le bilan par livrable : mise en page d'origine. -->
    <template v-else>
      <section class="report__section">
        <h3>Livrables</h3>
        <p v-if="!milestones.length" class="muted">Aucun livrable validé, livré ou publié ce mois-ci.</p>
        <div v-for="[key, list] in milestones" :key="key">
          <h4>{{ MILESTONE_LABELS[key] }}</h4>
          <ul class="report__list">
            <li v-for="m in list" :key="m.id"><span class="date">{{ short(m.date) }}</span> {{ m.name }}<span v-if="multi" class="muted"> · {{ projectName(m.projectId) }}</span></li>
          </ul>
        </div>
      </section>

      <section class="report__section">
        <h3>Tâches terminées</h3>
        <p v-if="!content.completedTasks.length" class="muted">Aucune tâche terminée avec une date dans ce mois.</p>
        <ul class="report__list">
          <li v-for="t in content.completedTasks" :key="t.id">
            <span class="date">{{ short(t.date) }}</span> {{ t.title }}
            <span v-if="t.deliverable" class="muted"> · {{ t.deliverable }}</span>
            <span v-if="t.reopened" class="tag">rouverte depuis</span>
          </li>
        </ul>
        <p v-if="content.undatedCompleted" class="muted">
          {{ content.undatedCompleted }} tâche(s) terminée(s) dans l'ancien outil n'ont pas de date de fin : elles ne sont comptées dans aucun mois.
        </p>
      </section>
    </template>

    <section class="report__section">
      <h3>Situation des tâches au {{ short(content.generatedAt) }}</h3>
      <p>
        {{ content.snapshot.done }} terminée(s) sur {{ content.snapshot.total }} · {{ content.snapshot.inProgress }} en cours ·
        {{ content.snapshot.todo }} à faire · {{ content.snapshot.waiting.length }} en attente · {{ content.snapshot.blocked.length }} bloquée(s)
      </p>
      <!-- Bilans récents : tâches non terminées classées par livrable, avec leurs pôles en couleur. -->
      <div v-if="content.snapshot.byDeliverable">
        <div v-for="g in content.snapshot.byDeliverable" :key="g.id || 'hors'" class="open">
          <h4 class="open__title">{{ g.id ? g.name : 'Hors livrable' }}<span v-if="multi && g.projectId" class="muted"> · {{ projectName(g.projectId) }}</span></h4>
          <ul class="open__list">
            <li v-for="t in g.tasks" :key="t.id">
              <StatusBadge :status="t.status" class="open__status" />
              <span class="open__text">{{ t.title }}<span v-if="t.note" class="muted"> — {{ t.note }}</span></span>
              <PoleTags :poles="t.poles" />
            </li>
          </ul>
        </div>
      </div>
      <div v-else class="report__cols">
        <div v-if="content.snapshot.blocked.length">
          <h4>Bloquées</h4>
          <ul><li v-for="t in content.snapshot.blocked" :key="t.id">{{ t.title }}<span v-if="t.note" class="muted"> — {{ t.note }}</span></li></ul>
        </div>
        <div v-if="content.snapshot.waiting.length">
          <h4>En attente</h4>
          <ul><li v-for="t in content.snapshot.waiting" :key="t.id">{{ t.title }}<span v-if="t.note" class="muted"> — {{ t.note }}</span></li></ul>
        </div>
      </div>
    </section>

    <section class="report__section">
      <h3>Échéances à venir</h3>
      <p v-if="!content.upcoming.length" class="muted">Aucune échéance datée d'ici la fin du mois prochain.</p>
      <ul class="report__list">
        <li v-for="t in content.upcoming" :key="t.id"><span class="date">{{ short(t.deadline) }}</span> {{ t.title }}<span v-if="multi" class="muted"> · {{ projectName(t.projectId) }}</span></li>
      </ul>
    </section>

    <section v-if="!content.byDeliverable && content.timeline.length" class="report__section report__timeline">
      <h3>Journal du mois</h3>
      <ul class="report__list">
        <li v-for="(e, i) in content.timeline" :key="i"><span class="date">{{ short(e.date) }}</span> {{ e.description }}</li>
      </ul>
    </section>
  </article>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); }
.report {
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); padding: var(--space-8);
  font-size: var(--text-sm); line-height: 1.55;

  &__header { border-bottom: 1px solid var(--line); padding-bottom: var(--space-6); margin-bottom: var(--space-6);
    h2 { font-size: var(--text-2xl); margin: var(--space-1) 0; } }
  &__kicker { margin: 0; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); }
  &__client { margin: 0; color: var(--ink-muted); }
  &__meta { margin: var(--space-3) 0 0; font-size: var(--text-xs); color: var(--ink-muted); }
  &__comment { margin: var(--space-2) 0 0; padding: var(--space-2) var(--space-3); background: var(--surface-sunken); border-radius: var(--radius-sm); }

  &__figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-6);
    div { display: grid; padding: var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); }
    strong { font-size: var(--text-xl); }
    span { font-size: var(--text-xs); color: var(--ink-muted); } }

  &__section { margin-bottom: var(--space-6); break-inside: avoid-page;
    h3 { font-size: var(--text-md); margin: 0 0 var(--space-2); }
    h4 { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); margin: var(--space-3) 0 var(--space-1); }
    p { margin: 0 0 var(--space-2); }
    ul { margin: 0; padding-left: var(--space-4); } }
  &__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); }
  &__list { list-style: none; padding: 0 !important; display: grid; gap: 2px;
    .date { display: inline-block; min-width: 56px; color: var(--ink-muted); font-variant-numeric: tabular-nums; } }
  &__timeline { break-inside: auto; }
}
.deliv {
  padding: var(--space-4) 0; border-top: 1px solid var(--line); break-inside: avoid;
  &__head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); flex-wrap: wrap;
    h4 { margin: 0 !important; font-size: var(--text-sm) !important; text-transform: none !important; letter-spacing: 0 !important; color: var(--ink) !important; } }
  &__bar { height: 3px; background: var(--line); border-radius: 2px; margin: var(--space-2) 0;
    span { display: block; height: 100%; background: var(--ink); border-radius: 2px; } }
  &__milestones { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); padding: 0 !important; margin: 0 0 var(--space-2) !important;
    li { padding: 2px 10px; border-radius: var(--radius-pill); background: var(--status-done-bg); color: var(--status-done); font-size: var(--text-xs); font-weight: 600; } }
}
.open {
  margin-top: var(--space-4); break-inside: avoid;
  &__title { margin: 0 0 var(--space-1) !important; font-size: var(--text-sm) !important; text-transform: none !important; letter-spacing: 0 !important; color: var(--ink) !important; }
  &__list { list-style: none; padding: 0 !important; display: grid; gap: 4px;
    li { display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; } }
  &__status { flex: 0 0 auto; }
  &__text { flex: 1 1 200px; min-width: 0; }
}
.tag { margin-left: var(--space-2); padding: 0 6px; border-radius: var(--radius-pill); background: var(--status-waiting-bg); color: var(--status-waiting); font-size: var(--text-xs); }

@media print {
  .report { border: 0; padding: 0; font-size: 11pt; }
  .report__figures div { border-color: #ccc; }
}
@include below($bp-tablet) { .report { padding: var(--space-4); } }
</style>
