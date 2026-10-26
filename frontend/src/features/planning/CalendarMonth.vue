<script setup>
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useDataStore } from '@/stores/data'
import { DONE } from '@/domain/settings'
import { monthGrid } from '@/domain/planning'

// Calendrier mensuel des échéances, débuts de tâches et jalons de livrables.
// Sur mobile, la grille devient une liste des jours qui ont au moins un élément.
const props = defineProps({
  month: { type: String, required: true },
  events: { type: Array, required: true },
  today: { type: String, required: true },
})

const ui = useUiStore()
const data = useDataStore()
const MAX_PER_DAY = 3

const byDay = computed(() => {
  const map = {}
  for (const e of props.events) (map[e.date] ??= []).push(e)
  return map
})
const weeks = computed(() => monthGrid(props.month))
const agenda = computed(() => weeks.value.flat().filter((d) => d.inMonth && byDay.value[d.iso]))

const TONES = { 'À faire': 'todo', 'En cours': 'progress', 'En attente': 'waiting', 'Bloqué': 'blocked', [DONE]: 'done' }
const KIND_LABELS = {
  'task-deadline': 'Échéance',
  'task-start': 'Début',
  'deliverable-due': 'Échéance livrable',
  'deliverable-validatedAt': 'Validé',
  'deliverable-deliveredAt': 'Livré',
  'deliverable-publishedAt': 'Publié',
  'project-start': 'Début du projet',
  'project-end': 'Fin du projet',
}
const ICONS = {
  'task-deadline': 'M8 2 14 8 8 14 2 8Z',
  'task-start': 'M4 2v12M4 3h8l-2 3 2 3H4',
  'deliverable-due': 'M8 2 14 8 8 14 2 8Z',
  'deliverable-validatedAt': 'M3.5 8.5l3 3 6-7',
  'deliverable-deliveredAt': 'M2 8h10M8.5 4.5 12 8l-3.5 3.5',
  'deliverable-publishedAt': 'M8 2v12M3 7l5-5 5 5',
  'project-start': 'M4 2v12M4 3h8l-2 3 2 3H4',
  'project-end': 'M3 3h10v10H3Z',
}

function title(e) {
  if (e.task) return e.task.title
  if (e.deliverable) return e.deliverable.name
  return e.project.name
}
function tone(e) {
  if (e.task) return e.kind === 'task-deadline' && e.task.status !== DONE && e.date < props.today ? 'late' : TONES[e.task.status] ?? 'todo'
  return e.kind.startsWith('deliverable-') && e.kind !== 'deliverable-due' ? 'done' : 'neutral'
}
function open(e) {
  if (e.task) ui.openEditor('task', e.task.id)
  else if (e.deliverable) ui.openEditor('deliverable', e.deliverable.id)
  else ui.openEditor('project', e.project.id)
}
const describe = (e) => `${KIND_LABELS[e.kind]} : ${title(e)}${e.task ? ` (${e.task.status})` : ''}${tone(e) === 'late' ? ', en retard' : ''} — ${data.projectById[e.projectId]?.name ?? ''}`

const DAY_NAMES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const dayNumber = (iso) => Number(iso.slice(8))
const LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const longDate = (iso) => LONG.format(new Date(`${iso}T00:00:00Z`))
</script>

<template>
  <div class="calendar">
    <table class="calendar__grid">
      <thead><tr><th v-for="d in DAY_NAMES" :key="d" scope="col">{{ d }}</th></tr></thead>
      <tbody>
        <tr v-for="(week, i) in weeks" :key="i">
          <td v-for="day in week" :key="day.iso" :class="{ out: !day.inMonth, today: day.iso === today }">
            <span class="calendar__day" :aria-label="longDate(day.iso)">{{ dayNumber(day.iso) }}</span>
            <ul v-if="byDay[day.iso]">
              <li v-for="(e, j) in byDay[day.iso].slice(0, MAX_PER_DAY)" :key="j">
                <button type="button" class="chip" :class="`chip--${tone(e)}`" :title="describe(e)" :aria-label="describe(e)" @click="open(e)">
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path :d="ICONS[e.kind]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                  <span>{{ title(e) }}</span>
                </button>
              </li>
              <li v-if="byDay[day.iso].length > MAX_PER_DAY" class="more">
                <details>
                  <summary>+ {{ byDay[day.iso].length - MAX_PER_DAY }} autre(s)</summary>
                  <button v-for="(e, j) in byDay[day.iso].slice(MAX_PER_DAY)" :key="j" type="button" class="chip" :class="`chip--${tone(e)}`" :title="describe(e)" @click="open(e)"><span>{{ title(e) }}</span></button>
                </details>
              </li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>

    <ol class="calendar__agenda">
      <li v-if="!agenda.length" class="muted">Aucune date ce mois-ci.</li>
      <li v-for="day in agenda" :key="day.iso">
        <h3 :class="{ today: day.iso === today }">{{ longDate(day.iso) }}</h3>
        <button v-for="(e, j) in byDay[day.iso]" :key="j" type="button" class="chip chip--wide" :class="`chip--${tone(e)}`" @click="open(e)">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path :d="ICONS[e.kind]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span><strong>{{ KIND_LABELS[e.kind] }}</strong> · {{ title(e) }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.calendar__grid {
  width: 100%; table-layout: fixed; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); font-size: var(--text-xs);
  th { padding: var(--space-2); text-align: left; font-weight: var(--weight-strong); color: var(--ink-muted); border-bottom: 1px solid var(--line); }
  td { height: 112px; vertical-align: top; padding: var(--space-1); border: 1px solid var(--line); }
  td.out { background: var(--surface-sunken); .calendar__day { color: var(--ink-faint); } }
  td.today .calendar__day { background: var(--ink); color: var(--surface); }
  ul { list-style: none; margin: var(--space-1) 0 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
  li { min-width: 0; }
}
.calendar__day { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 4px; border-radius: var(--radius-pill); font-weight: var(--weight-strong); }
.more summary { cursor: pointer; color: var(--ink-muted); padding: 2px 4px; }
.more details[open] { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }

.chip {
  display: flex; align-items: center; gap: 4px; width: 100%; min-width: 0; padding: 2px 6px; border: 1px solid transparent; border-radius: var(--radius-sm);
  font: inherit; text-align: left; cursor: pointer; color: var(--ink); background: var(--surface-sunken);
  svg { flex: none; }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &:hover span { text-decoration: underline; }
  &:focus-visible { @include focus-ring; }
  @each $tone in todo, progress, waiting, done {
    &--#{$tone} { background: var(--status-#{$tone}-bg); color: var(--status-#{$tone}); }
  }
  &--blocked, &--late { background: var(--status-blocked-bg); color: var(--status-blocked); }
  &--late { border-color: var(--status-blocked); font-weight: var(--weight-strong); }
  &--neutral { background: var(--surface); border-color: var(--line-strong); }
  &--wide { padding: var(--space-2) var(--space-3); font-size: var(--text-sm); span { white-space: normal; } }
}

.calendar__agenda { display: none; list-style: none; padding: 0; margin: 0;
  > li { display: grid; gap: var(--space-2); margin-bottom: var(--space-4); }
  h3 { margin: 0; font-size: var(--text-sm); &::first-letter { text-transform: uppercase; } &.today::after { content: ' · aujourd\'hui'; color: var(--ink-muted); text-transform: none; } }
}

@include below($bp-tablet) {
  .calendar__grid { display: none; }
  .calendar__agenda { display: block; }
}
</style>
