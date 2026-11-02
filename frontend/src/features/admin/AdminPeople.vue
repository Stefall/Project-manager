<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { teamMembers } from '@/domain/team'
import VButton from '@/design-system/components/VButton.vue'
import PolePicker from '@/components/PolePicker.vue'
import PersonAvatar from '@/components/PersonAvatar.vue'

// Annuaire : les personnes qu'on affecte aux pôles d'un projet et qui reçoivent le récap du lundi.
// Distinct des comptes : un freelance peut recevoir le récap sans se connecter à l'application.
const props = defineProps({ admin: { type: Object, required: true } })
const write = inject('adminWrite')
const data = useDataStore()

const people = computed(() => props.admin.people.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name)))
const projectsOf = (person) => data.projects.filter((p) => teamMembers(p, [person]).length)
const poleNames = (ids) => (ids ?? []).map((id) => data.poleLabel(id)).join(', ') || '—'

const form = reactive({ name: '', email: '', poles: [], external: false })
const adding = ref(false)
async function add() {
  adding.value = true
  const input = { ...form, poles: [...form.poles] }
  const ok = await write((b) => b.createPerson(input), `${form.name.trim()} ajouté(e) à l'annuaire.`)
  adding.value = false
  if (ok) Object.assign(form, { name: '', email: '', poles: [], external: false })
}

const update = (person, changes, message) => write((b) => b.updatePerson(person.id, changes, person.version), message)
function edit(person, field, event) {
  const value = event.target.value.trim()
  if (value && value !== person[field]) update(person, { [field]: value }, 'Annuaire mis à jour.')
  else event.target.value = person[field]
}
const editing = ref(null)
const editPoles = ref([])
function openPoles(person) {
  editing.value = person.id
  editPoles.value = [...(person.poles ?? [])]
}
async function savePoles(person) {
  if (await update(person, { poles: [...editPoles.value] }, 'Pôles habituels mis à jour.')) editing.value = null
}
function archive(person) {
  const n = projectsOf(person).length
  if (n && !window.confirm(`${person.name} fait partie de ${n} équipe(s). Archivée, elle n'y apparaîtra plus et ne recevra plus de récap. Continuer ?`)) return
  update(person, { archived: true }, `${person.name} archivé(e).`)
}
</script>

<template>
  <div>
    <section class="admin-section" aria-labelledby="people-title">
      <h2 id="people-title">Annuaire ({{ people.length }})</h2>
      <p class="admin-hint">On affecte ces personnes aux pôles de chaque projet, depuis la fiche du projet. Elles reçoivent le récap du lundi pour les projets dont elles font partie.</p>
      <p v-if="!people.length" class="admin-hint">Personne pour l'instant.</p>
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th scope="col">Nom</th><th scope="col">E-mail</th><th scope="col">Pôles habituels</th><th scope="col">Projets</th><th scope="col">Récap du lundi</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <template v-for="p in people" :key="p.id">
              <tr>
                <td><span class="name"><PersonAvatar :person="p" size="sm" /><input type="text" :value="p.name" :aria-label="`Nom de ${p.email}`" maxlength="120" @change="edit(p, 'name', $event)" @keydown.enter="$event.target.blur()" /></span></td>
                <td><input type="text" :value="p.email" :aria-label="`E-mail de ${p.name}`" maxlength="200" @change="edit(p, 'email', $event)" @keydown.enter="$event.target.blur()" /></td>
                <td><button type="button" class="poles" :aria-expanded="editing === p.id" @click="editing === p.id ? (editing = null) : openPoles(p)">{{ poleNames(p.poles) }}</button></td>
                <td>{{ projectsOf(p).map((x) => x.name).join(', ') || '—' }}</td>
                <td>
                  <label class="check"><input type="checkbox" :checked="p.digest !== false" @change="update(p, { digest: $event.target.checked }, $event.target.checked ? `${p.name} recevra le récap.` : `${p.name} ne recevra plus le récap.`)"> {{ p.digest !== false ? 'Oui' : 'Non' }}</label>
                  <span v-if="p.external" class="admin-tag">externe</span>
                </td>
                <td class="actions"><VButton size="sm" variant="ghost" @click="archive(p)">Archiver</VButton></td>
              </tr>
              <tr v-if="editing === p.id" class="poles-row">
                <td colspan="6">
                  <PolePicker v-model="editPoles" />
                  <div class="poles-actions">
                    <VButton size="sm" @click="editing = null">Annuler</VButton>
                    <VButton size="sm" variant="primary" @click="savePoles(p)">Enregistrer</VButton>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <section class="admin-section" aria-labelledby="new-person-title">
      <h2 id="new-person-title">Ajouter une personne</h2>
      <form class="admin-form admin-form--stack" @submit.prevent="add">
        <div class="row">
          <label class="field"><span>Nom</span><input v-model="form.name" type="text" required maxlength="120" placeholder="Prénom Nom" /></label>
          <label class="field"><span>E-mail</span><input v-model="form.email" type="email" required placeholder="prenom@exemple.com" /></label>
          <label class="check"><input v-model="form.external" type="checkbox"> Externe (freelance, partenaire)</label>
        </div>
        <PolePicker v-model="form.poles" />
        <div><VButton type="submit" variant="primary" :loading="adding">Ajouter à l'annuaire</VButton></div>
      </form>
      <p class="admin-hint">Les pôles habituels servent seulement à proposer la personne en premier (★) quand on compose l'équipe d'un projet.</p>
    </section>
  </div>
</template>

<style lang="scss" src="./admin.scss"></style>
<style scoped lang="scss">
.name { display: flex; align-items: center; gap: var(--space-2); }
.check { display: inline-flex; align-items: center; gap: var(--space-2); }
.poles { border: 0; background: none; padding: var(--space-1) var(--space-2); text-align: left; cursor: pointer; font: inherit; color: inherit; border-radius: var(--radius-sm); text-decoration: underline; text-decoration-color: var(--line-strong); &:hover { background: var(--surface-sunken); } }
.poles-row td { background: var(--surface-sunken); }
.poles-actions { display: flex; gap: var(--space-2); justify-content: flex-end; margin-top: var(--space-3); }
.admin-form--stack { flex-direction: column; align-items: stretch; .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); } }
</style>
