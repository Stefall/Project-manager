<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/components/useTaskStats'
import { DONE } from '@/domain/settings'
import { timelineScale, toDay } from '@/domain/planning'

// Gantt projet → livrable → tâches. Seules les dates saisies sont dessinées :
// une barre pour un début et une échéance, un repère pour une date seule.
const props = defineProps({
  groups: { type: Array, required: true },
  range: { type: Object, required: true },
  // null : l'échelle s'ajuste à la largeur disponible (entre 9 et 28 px par jour).
  pxPerDay: { type: Number, default: null },
  today: { type: String, required: true },
})

const ui = useUiStore()
const collapsed = reactive({})
const root = ref(null)
const available = ref(0)
let observer
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { available.value = entry.contentRect.width })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
const label = computed(() => (available.value && available.value < 700 ? 150 : 280))
const px = computed(() => {
  if (props.pxPerDay) return props.pxPerDay
  return Math.max(9, Math.min(28, Math.floor((available.value - label.value - 2) / props.range.days)))
})
const scale = computed(() => timelineScale(props.range))
const width = computed(() => props.range.days * px.value)
const x = (iso) => (toDay(iso) - toDay(props.range.start)) * px.value
const barStyle = (start, end) => ({ left: `${x(start)}px`, width: `${Math.max(px.value, x(end) - x(start) + px.value)}px` })
const pointStyle = (iso) => ({ left: `${x(iso) + px.value / 2}px` })

const TONES = { 'À faire': 'todo', 'En cours': 'progress', 'En attente': 'waiting', 'Bloqué': 'blocked', [DONE]: 'done' }
const tone = (task) => TONES[task.status] ?? 'todo'
const isLate = (task) => task.status !== DONE && task.deadline && task.deadline < props.today

const MONTHS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthLabel = (key) => MONTHS.format(new Date(`${key}-01T00:00:00Z`))

function describe(task, schedule) {
  const dates = schedule.kind === 'range'
    ? `du ${formatDate(schedule.start)} au ${formatDate(schedule.end)}`
    : schedule.kind === 'deadline' ? `échéance le ${formatDate(schedule.end)}, début non renseigné` : `début le ${formatDate(schedule.start)}, échéance à préciser`
  return `${task.title} : ${dates}, ${task.status}${isLate(task) ? ', en retard' : ''}`
}

const MARK_ICONS = {
  due: 'M8 2 14 8 8 14 2 8Z',
  validatedAt: 'M3.5 8.5l3 3 6-7',
  deliveredAt: 'M2 8h10M8.5 4.5 12 8l-3.5 3.5',
  publishedAt: 'M8 2v12M3 7l5-5 5 5',
}
</script>

<template>
  <div ref="root" class="gantt" :style="{ '--label': `${label}px`, '--days': range.days, '--px': `${px}px`, '--width': `${width}px` }">
    <div class="gantt__head" aria-hidden="true">
      <div class="gantt__label gantt__corner" />
      <div class="gantt__track">
        <div class="gantt__months">
          <span v-for="m in scale.months" :key="m.key" :style="{ left: `${m.offset * px}px`, width: `${m.days * px}px` }">{{ monthLabel(m.key) }}</span>
        </div>
        <div class="gantt__weeks">
          <span v-for="w in scale.weeks" :key="w.iso" :style="{ left: `${w.offset * px}px`, width: `${7 * px}px` }">
            S{{ w.number }}<template v-if="px >= 20"> · {{ formatDate(w.iso) }}</template>
          </span>
        </div>
      </div>
    </div>

    <div class="gantt__body">
      <div class="gantt__today" :style="{ left: `calc(var(--label) + ${x(today) + px / 2}px)` }" aria-hidden="true"><span>Aujourd'hui</span></div>

      <template v-for="g in groups" :key="g.project.id">
        <div class="gantt__row gantt__row--project">
          <div class="gantt__label">
            <button type="button" class="gantt__toggle" :aria-expanded="!collapsed[g.project.id]" @click="collapsed[g.project.id] = !collapsed[g.project.id]">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
              <span class="dot" :style="{ background: g.project.color || 'var(--ink)' }" />
              <strong>{{ g.project.name }}</strong>
            </button>
          </div>
          <div class="gantt__track">
            <div v-if="g.span" class="bar bar--project" :class="{ 'bar--declared': g.span.declared }" :style="{ ...barStyle(g.span.start, g.span.end), '--accent': g.project.color || 'var(--ink)' }"
              :title="`${g.project.name} : ${formatDate(g.span.start)} → ${formatDate(g.span.end)}${g.span.declared ? '' : ' (étendue des éléments datés)'}`" />
          </div>
        </div>

        <template v-if="!collapsed[g.project.id]">
          <template v-for="c in g.children" :key="c.deliverable?.id ?? `${g.project.id}-loose`">
            <div class="gantt__row gantt__row--deliverable">
              <div class="gantt__label">
                <button v-if="c.deliverable" type="button" class="link" @click="ui.openEditor('deliverable', c.deliverable.id)">{{ c.deliverable.name }}</button>
                <span v-else class="muted">Sans livrable</span>
              </div>
              <div class="gantt__track">
                <div v-if="c.span && c.span.start !== c.span.end" class="bar bar--deliverable" :style="barStyle(c.span.start, c.span.end)" aria-hidden="true" />
                <span v-for="m in c.marks" :key="m.type" class="mark" :class="`mark--${m.type}`" :style="pointStyle(m.date)" role="img" :aria-label="`${c.deliverable.name} : ${m.label} le ${formatDate(m.date)}`" :title="`${m.label} le ${formatDate(m.date)}`">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path :d="MARK_ICONS[m.type]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </span>
              </div>
            </div>

            <div v-for="r in c.rows" :key="r.task.id" class="gantt__row gantt__row--task">
              <div class="gantt__label">
                <button type="button" class="link" :title="r.task.title" @click="ui.openEditor('task', r.task.id)">{{ r.task.title }}</button>
              </div>
              <div class="gantt__track">
                <button
                  type="button"
                  class="bar bar--task"
                  :class="[`bar--${tone(r.task)}`, `bar--kind-${r.schedule.kind}`, { 'bar--late': isLate(r.task) }]"
                  :style="r.schedule.kind === 'range' ? barStyle(r.schedule.start, r.schedule.end) : pointStyle(r.schedule.start)"
                  :aria-label="describe(r.task, r.schedule)"
                  :title="describe(r.task, r.schedule)"
                  @click="ui.openEditor('task', r.task.id)"
                >
                  <span v-if="r.schedule.kind !== 'range'" class="bar__shape" aria-hidden="true" />
                  <span v-if="r.schedule.kind === 'start'" class="bar__note">échéance à préciser</span>
                  <span v-if="isLate(r.task)" class="bar__note bar__note--late">en retard</span>
                </button>
              </div>
            </div>
          </template>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.gantt {
  --row: 36px;
  position: relative;
  overflow: auto;
  max-height: calc(100vh - 260px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);

  &__head { position: sticky; top: 0; z-index: 3; display: grid; grid-template-columns: var(--label) var(--width); width: max-content; background: var(--surface); border-bottom: 1px solid var(--line-strong); }
  &__corner { z-index: 4; }
  &__months, &__weeks { position: relative; height: 24px; span { position: absolute; top: 0; height: 100%; padding: 4px var(--space-2); border-left: 1px solid var(--line); white-space: nowrap; overflow: hidden; } }
  &__months span { font-weight: var(--weight-strong); text-transform: capitalize; }
  &__weeks span { color: var(--ink-muted); font-size: var(--text-xs); }

  &__body { position: relative; width: max-content; }
  &__row { display: grid; grid-template-columns: var(--label) var(--width); min-height: var(--row); border-bottom: 1px solid var(--line); }
  &__row--project { background: var(--surface-sunken); }
  &__label {
    position: sticky; left: 0; z-index: 2; display: flex; align-items: center; min-width: 0;
    padding: 0 var(--space-3); background: inherit; background-color: var(--surface); border-right: 1px solid var(--line);
    .link { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
  &__row--project &__label { background-color: var(--surface-sunken); }
  &__row--deliverable &__label { padding-left: var(--space-6); font-weight: var(--weight-strong); }
  &__row--task &__label { padding-left: calc(var(--space-6) + var(--space-4)); }

  // Fond : lignes de semaine et week-ends grisés (la période commence toujours un lundi).
  &__track {
    position: relative;
    background-image:
      linear-gradient(90deg, var(--line) 1px, transparent 1px),
      linear-gradient(90deg, transparent calc(var(--px) * 5), color-mix(in srgb, var(--surface-sunken) 70%, transparent) calc(var(--px) * 5));
    background-size: calc(var(--px) * 7) 100%;
  }
  &__head &__track { background-image: none; }

  &__today {
    position: absolute; top: 0; bottom: 0; z-index: 1; width: 0; border-left: 2px solid var(--ink); pointer-events: none;
    span { position: sticky; top: 0; display: inline-block; margin-left: 4px; padding: 0 4px; font-size: var(--text-xs); background: var(--ink); color: var(--surface); border-radius: 3px; }
  }

  &__toggle {
    display: inline-flex; align-items: center; gap: var(--space-2); min-width: 0; border: 0; background: none; padding: 0; cursor: pointer; font: inherit; color: inherit;
    svg { transition: transform var(--duration) var(--ease); flex: none; }
    &[aria-expanded='true'] svg { transform: rotate(90deg); }
    strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
}

.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.muted { color: var(--ink-muted); }
.link { border: 0; background: none; padding: 0; text-align: left; cursor: pointer; font: inherit; color: inherit; &:hover { text-decoration: underline; } }

.bar {
  position: absolute; top: 50%; transform: translateY(-50%); border-radius: var(--radius-sm);

  &--project { height: 8px; background: var(--accent); opacity: 0.35; }
  &--project.bar--declared { opacity: 0.8; }
  &--deliverable { height: 6px; border: 1px solid var(--line-strong); background: var(--surface-sunken); }

  &--task {
    height: 20px; border: 1px solid transparent; padding: 0; cursor: pointer; font: inherit;
    &:focus-visible { @include focus-ring; }
  }
  @each $tone in todo, progress, waiting, blocked, done {
    &--#{$tone} { background: var(--status-#{$tone}-bg); border-color: var(--status-#{$tone}); color: var(--status-#{$tone}); }
  }
  &--kind-range { border-left-width: 4px; }
  // Date seule : un losange (échéance) ou un drapeau de départ, jamais une barre.
  &--kind-deadline, &--kind-start { width: 16px; height: 16px; margin-left: -8px; border: 0; background: none; }
  &__shape { position: absolute; inset: 1px; border: 2px solid currentColor; background: color-mix(in srgb, currentColor 14%, var(--surface)); }
  &--kind-deadline &__shape { transform: rotate(45deg); border-radius: 2px; }
  &--kind-start &__shape { border-radius: 2px 50% 50% 2px; }
  &--late { box-shadow: 0 0 0 2px var(--status-blocked); }
  &--kind-deadline.bar--late, &--kind-start.bar--late { box-shadow: none; }
  &--late &__shape { border-color: var(--status-blocked); }

  &__note { position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); white-space: nowrap; font-size: var(--text-xs); color: var(--ink-muted); pointer-events: none; }
  &__note--late { color: var(--status-blocked); font-weight: var(--weight-strong); }
}

.mark {
  position: absolute; top: 50%; transform: translate(-50%, -50%); display: grid; place-items: center;
  width: 22px; height: 22px; border-radius: 50%; background: var(--surface); border: 1px solid var(--line-strong); color: var(--ink);
  &--validatedAt, &--deliveredAt, &--publishedAt { color: var(--status-done); border-color: var(--status-done); background: var(--status-done-bg); }
}

</style>
