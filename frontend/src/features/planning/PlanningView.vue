<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { DONE } from '@/domain/settings'
import { buildGantt, calendarEvents, shiftMonth, timelineRange, todayIso, undatedItems } from '@/domain/planning'
import EmptyState from '@/design-system/components/EmptyState.vue'
import GanttChart from './GanttChart.vue'
import CalendarMonth from './CalendarMonth.vue'
import UndatedList from './UndatedList.vue'

const data = useDataStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const today = todayIso()

const view = ref(route.query.view === 'calendrier' ? 'calendar' : 'gantt')
const zoom = ref('ajuste')
const month = ref(/^\d{4}-\d{2}$/.test(route.query.mois ?? '') ? route.query.mois : today.slice(0, 7))
const pole = ref('')
const status = ref('')
const showDone = ref(false)
watch([view, month], () => router.replace({ query: { view: view.value === 'calendar' ? 'calendrier' : undefined, mois: view.value === 'calendar' ? month.value : undefined } }))

const projects = computed(() => data.projects.filter((p) => !p.archived && (!ui.currentProjectId || p.id === ui.currentProjectId)))
const filtering = computed(() => Boolean(pole.value || status.value))
const tasks = computed(() => data.tasks.filter((t) =>
  projects.value.some((p) => p.id === t.projectId)
  && (showDone.value || status.value === DONE || t.status !== DONE)
  && (!status.value || t.status === status.value)
  && (!pole.value || t.poles?.includes(pole.value))))
// Avec un filtre pôle ou statut, un livrable n'apparaît que s'il garde au moins une tâche.
const deliverables = computed(() => data.deliverables.filter((d) =>
  projects.value.some((p) => p.id === d.projectId) && (!filtering.value || tasks.value.some((t) => t.deliverableId === d.id))))

const scope = computed(() => ({ projects: projects.value, deliverables: deliverables.value, tasks: tasks.value }))
const groups = computed(() => buildGantt(scope.value))
const range = computed(() => timelineRange(groups.value, today))
const events = computed(() => calendarEvents(scope.value))
const undated = computed(() => undatedItems(scope.value))
const datedCount = computed(() => groups.value.reduce((n, g) => n + g.children.reduce((m, c) => m + c.rows.length, 0), 0))

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthLabel = computed(() => MONTH.format(new Date(`${month.value}-01T00:00:00Z`)))
const monthCount = computed(() => events.value.filter((e) => e.date.startsWith(month.value)).length)
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>Planning</h1>
        <p>{{ datedCount }} tâche(s) datée(s) · {{ undated.tasks.length }} à préciser</p>
      </div>
      <div class="toggle" role="group" aria-label="Affichage">
        <button type="button" :aria-pressed="view === 'gantt'" @click="view = 'gantt'">Gantt</button>
        <button type="button" :aria-pressed="view === 'calendar'" @click="view = 'calendar'">Calendrier</button>
      </div>
    </header>

    <div class="filters">
      <label class="field"><span>Pôle</span>
        <select v-model="pole"><option value="">Tous</option><option v-for="p in data.settings.poles" :key="p.id" :value="p.id">{{ p.label }}</option></select>
      </label>
      <label class="field"><span>Statut</span>
        <select v-model="status"><option value="">Tous</option><option v-for="s in data.settings.statuses" :key="s.id">{{ s.id }}</option></select>
      </label>
      <label class="check"><input v-model="showDone" type="checkbox" :disabled="status === DONE"> Afficher les tâches terminées</label>

      <div v-if="view === 'gantt'" class="toggle toggle--small" role="group" aria-label="Échelle">
        <button type="button" :aria-pressed="zoom === 'ajuste'" @click="zoom = 'ajuste'">Ajusté</button>
        <button type="button" :aria-pressed="zoom === 'semaine'" @click="zoom = 'semaine'">Semaines</button>
        <button type="button" :aria-pressed="zoom === 'mois'" @click="zoom = 'mois'">Mois</button>
      </div>
      <div v-else class="month-nav" role="group" aria-label="Mois affiché">
        <button type="button" aria-label="Mois précédent" @click="month = shiftMonth(month, -1)">‹</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" aria-label="Mois suivant" @click="month = shiftMonth(month, 1)">›</button>
        <button type="button" class="month-nav__today" :disabled="month === today.slice(0, 7)" @click="month = today.slice(0, 7)">Aujourd'hui</button>
      </div>
    </div>

    <p v-if="data.loading" class="muted">Chargement…</p>

    <template v-else-if="view === 'gantt'">
      <EmptyState v-if="!groups.length" title="Rien à placer sur le planning" text="Aucune tâche ni aucun livrable n'a de date. Fixez des échéances ci-dessous pour les voir apparaître." />
      <template v-else>
        <GanttChart :groups="groups" :range="range" :px-per-day="{ ajuste: null, semaine: 28, mois: 9 }[zoom]" :today="today" />
        <p class="legend muted">
          <span><i class="legend__bar" /> Début et échéance saisis</span>
          <span><i class="legend__diamond" /> Échéance seule (début non renseigné)</span>
          <span><i class="legend__flag" /> Début seul (échéance à préciser)</span>
          <span><i class="legend__mark" /> Jalon de livrable (validé, livré, publié)</span>
        </p>
      </template>
    </template>

    <template v-else>
      <p class="muted month-count">{{ monthCount }} élément(s) en {{ monthLabel }}</p>
      <CalendarMonth :month="month" :events="events" :today="today" />
    </template>

    <UndatedList v-if="!data.loading" :tasks="undated.tasks" :deliverables="undated.deliverables" />
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.toggle { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden;
  button { border: 0; background: var(--surface); padding: var(--space-2) var(--space-4); cursor: pointer; font-size: var(--text-sm); }
  button[aria-pressed='true'] { background: var(--ink); color: var(--surface); }
  &--small button { padding: var(--space-1) var(--space-3); }
}
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-6); .field { min-width: 160px; } }
.filters > .toggle, .month-nav { margin-left: auto; }
.check { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); padding-bottom: var(--space-2); }
.month-nav { display: inline-flex; align-items: center; gap: var(--space-2);
  strong { min-width: 140px; text-align: center; text-transform: capitalize; }
  button { border: 1px solid var(--line-strong); background: var(--surface); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); cursor: pointer; font-size: var(--text-sm); }
  button:disabled { opacity: 0.5; cursor: default; }
}
.month-count { margin: 0 0 var(--space-3); }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-4); margin-top: var(--space-3); font-size: var(--text-xs);
  span { display: inline-flex; align-items: center; gap: var(--space-2); }
  i { display: inline-block; flex: none; border: 2px solid var(--status-progress); background: var(--status-progress-bg); }
  &__bar { width: 24px; height: 10px; border-radius: 3px; border-left-width: 4px !important; }
  &__diamond { width: 9px; height: 9px; transform: rotate(45deg); border-radius: 2px; }
  &__flag { width: 10px; height: 10px; border-radius: 2px 50% 50% 2px; }
  &__mark { width: 12px; height: 12px; border-radius: 50%; border-color: var(--status-done) !important; background: var(--status-done-bg) !important; border-width: 1px !important; }
}
@include below($bp-tablet) { .filters > .toggle, .month-nav { margin-left: 0; } }
</style>
