<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { buildOverview, buildRecap, renderRecap, shortDate } from '@/domain/recap'
import { todayIso } from '@/domain/planning'
import StatusBadge from '@/design-system/components/StatusBadge.vue'
import EmptyState from '@/design-system/components/EmptyState.vue'
import VButton from '@/design-system/components/VButton.vue'

// « Ma semaine » : le contenu exact du récap du lundi, pour la personne connectée.
// Un administrateur peut afficher celui de n'importe qui et voir l'e-mail tel qu'il partira.
const data = useDataStore()
const session = useSessionStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const today = todayIso()
const norm = (s) => String(s ?? '').trim().toLowerCase()
const me = computed(() => data.people.find((p) => norm(p.email) === norm(session.user?.email)))
const personId = ref(typeof route.query.personne === 'string' ? route.query.personne : '')
watch(personId, (personne) => router.replace({ query: { personne: personne || undefined } }))
const person = computed(() => (session.isAdmin && personId.value ? data.personById[personId.value] : me.value))
const isMine = computed(() => person.value && person.value.id === me.value?.id)

const recap = computed(() => person.value && buildRecap({ person: person.value, projects: data.projects, deliverables: data.deliverables, tasks: data.tasks, settings: data.settings, today }))
// La vue d'ensemble accompagne le récap des administrateurs.
const overview = computed(() => (isMine.value && session.isAdmin ? buildOverview({ projects: data.projects, tasks: data.tasks, settings: data.settings, today }) : []))
const appUrl = `${location.origin}${location.pathname}`
const mail = computed(() => recap.value && renderRecap(recap.value, { appUrl, overview: overview.value }))
const showMail = ref(false)
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>{{ isMine || !person ? 'Ma semaine' : `La semaine de ${person.name}` }}</h1>
        <p v-if="recap">Du {{ shortDate(recap.weekStart) }} au {{ shortDate(recap.weekEnd) }} · ce que contiendra le récap du lundi</p>
      </div>
      <div v-if="session.isAdmin && data.people.length" class="who">
        <label class="field"><span>Voir le récap de</span>
          <select v-model="personId">
            <option value="">{{ me ? `${me.name} (moi)` : 'Choisir…' }}</option>
            <option v-for="p in data.people.filter((x) => x.id !== me?.id)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <VButton v-if="mail" @click="showMail = !showMail">{{ showMail ? 'Revenir à la vue' : 'Voir l\'e-mail' }}</VButton>
      </div>
    </header>

    <p v-if="data.loading" class="muted">Chargement…</p>
    <EmptyState v-else-if="!person" title="Vous n'êtes pas dans l'annuaire" :text="`Aucune personne de l'annuaire n'a l'adresse ${session.user?.email}. Un administrateur peut vous ajouter dans Administration → Équipe, puis dans l'équipe de vos projets.`" />

    <template v-else-if="showMail && mail">
      <p class="muted mail-meta"><strong>À :</strong> {{ person.email }}<template v-if="person.digest === false"> (ne reçoit pas le récap)</template> · <strong>Objet :</strong> {{ mail.subject }}<template v-if="recap.empty"> · <em>récap vide : aucun e-mail ne sera préparé</em></template></p>
      <iframe class="mail" title="Aperçu de l'e-mail" :srcdoc="mail.html" sandbox="allow-popups allow-popups-to-escape-sandbox" />
    </template>

    <template v-else>
      <EmptyState v-if="!recap.projects.length" title="Aucun projet" text="Cette personne ne fait partie d'aucune équipe de projet en cours. On l'ajoute depuis la fiche du projet." />
      <EmptyState v-else-if="recap.empty" title="Rien cette semaine" :text="`Aucune tâche à rendre, en retard ou bloquée sur ${recap.projects.map((p) => p.name).join(', ')}.`" />

      <section v-if="recap.late.length" class="block block--late" aria-labelledby="late-title">
        <h2 id="late-title">En retard ({{ recap.late.length }})</h2>
        <ul><li v-for="t in recap.late" :key="t.id"><button type="button" @click="ui.openEditor('task', t.id)"><span class="date late">{{ shortDate(t.deadline) }}</span><StatusBadge :status="t.status" /><span class="title">{{ t.title }}</span><span class="meta">{{ t.project }}<template v-if="t.deliverable"> · {{ t.deliverable }}</template></span></button></li></ul>
      </section>

      <section v-for="d in recap.days" :key="d.date" class="block" :aria-label="d.label">
        <h2>{{ d.label }}<template v-if="d.date === today"> · aujourd'hui</template></h2>
        <ul><li v-for="t in d.tasks" :key="t.id"><button type="button" @click="ui.openEditor('task', t.id)"><StatusBadge :status="t.status" /><span class="title">{{ t.title }}</span><span class="meta">{{ t.project }}<template v-if="t.deliverable"> · {{ t.deliverable }}</template></span></button></li></ul>
      </section>

      <section v-if="recap.waiting.length" class="block" aria-labelledby="waiting-title">
        <h2 id="waiting-title">Bloquées ou en attente ({{ recap.waiting.length }})</h2>
        <ul><li v-for="t in recap.waiting" :key="t.id"><button type="button" @click="ui.openEditor('task', t.id)"><StatusBadge :status="t.status" /><span class="title">{{ t.title }}</span><span class="meta">{{ t.note || t.project }}</span></button></li></ul>
      </section>

      <section v-if="recap.ongoing.length" class="block" aria-labelledby="ongoing-title">
        <h2 id="ongoing-title">En cours, sans échéance ({{ recap.ongoing.length }})</h2>
        <ul><li v-for="t in recap.ongoing" :key="t.id"><button type="button" @click="ui.openEditor('task', t.id)"><StatusBadge :status="t.status" /><span class="title">{{ t.title }}</span><span class="meta">{{ t.deadlineText || 'date à préciser' }} · {{ t.project }}</span></button></li></ul>
      </section>

      <section v-if="recap.milestones.length" class="block" aria-labelledby="milestones-title">
        <h2 id="milestones-title">Livrables attendus cette semaine</h2>
        <ul><li v-for="m in recap.milestones" :key="m.id"><button type="button" @click="ui.openEditor('deliverable', m.id)"><span class="date">{{ shortDate(m.dueDate) }}</span><span class="title">{{ m.name }}</span><span class="meta">{{ m.project }}</span></button></li></ul>
      </section>

      <section v-if="overview.length" class="block block--overview" aria-labelledby="overview-title">
        <h2 id="overview-title">Vue d'ensemble (administration)</h2>
        <ul><li v-for="p in overview" :key="p.id"><RouterLink :to="{ name: 'project', params: { id: p.id } }"><span class="title">{{ p.name }}</span><span class="meta">
          <span v-if="p.late" class="late">{{ p.late }} en retard</span><span v-if="p.blocked">{{ p.blocked }} bloquée(s)</span><span v-if="p.waiting">{{ p.waiting }} en attente</span><span v-if="p.orphans.length" class="orphan">pôles sans personne : {{ p.orphans.join(', ') }}</span>
        </span></RouterLink></li></ul>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-sm); }
.who { display: flex; align-items: flex-end; gap: var(--space-3); flex-wrap: wrap; .field { min-width: 200px; } }
.mail-meta { margin: 0 0 var(--space-3); }
.mail { width: 100%; height: 70vh; border: 1px solid var(--line); border-radius: var(--radius-md); background: #fff; }
.block {
  margin-bottom: var(--space-6); max-width: 860px;
  h2 { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin: 0 0 var(--space-2); &::first-letter { text-transform: uppercase; } }
  &--late h2 { color: var(--status-blocked); }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); }
  li + li { border-top: 1px solid var(--line); }
  button, a {
    display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); width: 100%; padding: var(--space-3) var(--space-4); border: 0; background: none;
    text-align: left; font: inherit; color: inherit; cursor: pointer; text-decoration: none;
    &:hover .title { text-decoration: underline; }
    &:focus-visible { @include focus-ring; }
  }
  .title { font-weight: var(--weight-strong); }
  .meta { color: var(--ink-muted); font-size: var(--text-sm); margin-left: auto; display: inline-flex; flex-wrap: wrap; gap: var(--space-2); }
  .date { min-width: 52px; color: var(--ink-muted); font-size: var(--text-sm); }
  .late { color: var(--status-blocked); font-weight: var(--weight-strong); }
  .orphan { color: var(--status-waiting); }
}
</style>
