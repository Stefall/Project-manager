<script setup>
import { computed, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { useSessionStore } from '@/stores/session'
import { orphanPoles } from '@/domain/team'
import PersonAvatar from '@/components/PersonAvatar.vue'

// Équipe du projet : pour chaque pôle, les personnes qui le tiennent. Les tâches d'un pôle les concernent.
const props = defineProps({ project: { type: Object, required: true } })
const data = useDataStore()
const ui = useUiStore()
const session = useSessionStore()

const team = computed(() => props.project.team ?? {})
const orphans = computed(() => new Set(orphanPoles(props.project, data.tasks)))
// Pôles affichés : ceux qui ont quelqu'un, puis ceux qu'utilisent les tâches du projet ; les autres s'ajoutent à la demande.
const shown = ref([])
const rows = computed(() => data.settings.poles.filter((p) => team.value[p.id]?.length || orphans.value.has(p.id) || shown.value.includes(p.id)))
const addable = computed(() => data.settings.poles.filter((p) => !p.hidden && !rows.value.includes(p)))

const membersOf = (pole) => (team.value[pole] ?? []).map((id) => data.personById[id]).filter(Boolean)
/** Personnes proposées pour un pôle : celles dont c'est le pôle habituel d'abord. */
const candidates = (pole) => data.people
  .filter((p) => !(team.value[pole] ?? []).includes(p.id))
  .sort((a, b) => Number(b.poles?.includes(pole)) - Number(a.poles?.includes(pole)) || a.name.localeCompare(b.name))

// Les modifications s'enchaînent une par une : deux ajouts rapides partiraient sinon de la même version du projet.
let queue = Promise.resolve()
function save(pole, change, message) {
  queue = queue.then(async () => {
    const current = data.projectById[props.project.id]
    const next = change(current.team?.[pole] ?? [])
    try {
      await data.updateProject(current, { team: { ...(current.team ?? {}), [pole]: next } })
      ui.toast(message, 'success')
    } catch (e) {
      ui.toast(e.isConflict ? 'Le projet vient d\'être modifié par quelqu\'un d\'autre : la version à jour est affichée.' : e.message, 'error')
    }
  })
}
function add(pole, event) {
  const id = event.target.value
  event.target.value = ''
  if (id) save(pole, (ids) => (ids.includes(id) ? ids : [...ids, id]), `${data.personById[id].name} ajouté(e) : ${data.poleLabel(pole)}.`)
}
const remove = (pole, person) => save(pole, (ids) => ids.filter((id) => id !== person.id), `${person.name} retiré(e) : ${data.poleLabel(pole)}.`)
function showPole(event) {
  if (event.target.value) shown.value.push(event.target.value)
  event.target.value = ''
}
</script>

<template>
  <section class="team" aria-labelledby="team-title">
    <h2 id="team-title" class="section-title">Équipe</h2>
    <p v-if="!data.people.length" class="muted">
      L'annuaire est vide.
      <RouterLink v-if="session.isAdmin" :to="{ name: 'admin', query: { onglet: 'equipe' } }">Ajouter des personnes</RouterLink>
      <template v-else>Demandez à un administrateur d'ajouter des personnes.</template>
    </p>
    <ul v-else class="team__rows">
      <li v-for="pole in rows" :key="pole.id" class="team__row">
        <span class="team__pole">{{ pole.label }}</span>
        <span class="team__people">
          <span v-for="person in membersOf(pole.id)" :key="person.id" class="chip">
            <PersonAvatar :person="person" size="sm" />{{ person.name }}
            <button type="button" :aria-label="`Retirer ${person.name} du pôle ${pole.label}`" @click="remove(pole.id, person)">×</button>
          </span>
          <span v-if="!membersOf(pole.id).length" class="orphan">Aucune personne : ses tâches n’iront dans aucun récap</span>
          <select v-if="candidates(pole.id).length" class="add" :aria-label="`Ajouter une personne au pôle ${pole.label}`" @change="add(pole.id, $event)">
            <option value="">+</option>
            <option v-for="p in candidates(pole.id)" :key="p.id" :value="p.id">{{ p.name }}{{ p.poles?.includes(pole.id) ? ' ★' : '' }}</option>
          </select>
        </span>
      </li>
      <li v-if="addable.length" class="team__more">
        <select aria-label="Ajouter un pôle à l'équipe" @change="showPole">
          <option value="">+ Ajouter un pôle</option>
          <option v-for="p in addable" :key="p.id" :value="p.id">{{ p.label }}</option>
        </select>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); }
.section-title { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin: 0 0 var(--space-3); }
.team__rows { list-style: none !important; padding: 0 !important; margin: 0; display: grid; gap: var(--space-3) !important; }
.team__row { display: grid; gap: var(--space-1); }
.team__pole { font-size: var(--text-xs); font-weight: var(--weight-strong); color: var(--ink-muted); }
.team__people { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 4px 2px 2px; border: 1px solid var(--line); border-radius: var(--radius-pill); background: var(--surface); font-size: var(--text-sm);
  button { border: 0; background: none; cursor: pointer; color: var(--ink-muted); padding: 0 4px; font-size: 14px; line-height: 1; border-radius: 50%; &:hover { color: var(--ink); } &:focus-visible { @include focus-ring; } }
}
.orphan { font-size: var(--text-xs); color: var(--status-waiting); }
.add { width: 32px; height: 26px; padding: 0; text-align: center; border: 1px dashed var(--line-strong); border-radius: var(--radius-pill); background: var(--surface); cursor: pointer; appearance: none; font-weight: var(--weight-strong); color: var(--ink-muted); }
.team__more select { border: 0; background: none; padding: 0; color: var(--ink-muted); font-size: var(--text-sm); cursor: pointer; text-decoration: underline; text-decoration-color: var(--line-strong); }
</style>
