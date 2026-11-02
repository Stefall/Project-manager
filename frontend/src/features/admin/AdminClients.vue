<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { PROJECT_STATUSES } from '@/domain/projects'
import VButton from '@/design-system/components/VButton.vue'

// Clients et création de projets. Le détail d'un projet se modifie depuis sa fiche.
const props = defineProps({ admin: { type: Object, required: true } })
const write = inject('adminWrite')
const data = useDataStore()
const ui = useUiStore()

const clients = computed(() => props.admin.clients.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name)))
const projectsOf = (clientId) => data.projects.filter((p) => p.clientId === clientId)
const orphans = computed(() => data.projects.filter((p) => !clients.value.some((c) => c.id === p.clientId)))

const clientName = ref('')
async function addClient() {
  const name = clientName.value
  if (await write((b) => b.createClient({ name }), `Client « ${name.trim()} » créé.`)) clientName.value = ''
}
function renameClient(client, event) {
  const name = event.target.value.trim()
  if (name && name !== client.name) write((b) => b.updateClient(client.id, { name }, client.version), 'Client renommé.')
  else event.target.value = client.name
}
const archiveClient = (client) => write((b) => b.updateClient(client.id, { archived: true }, client.version), `Client « ${client.name} » archivé.`)

const form = reactive({ name: '', clientId: '', status: 'En cadrage', startDate: '', endDate: '' })
const creating = ref(false)
async function addProject() {
  creating.value = true
  const input = { ...form }
  const result = await write((b) => b.createProject(input), `Projet « ${form.name.trim()} » créé.`)
  creating.value = false
  if (result) {
    Object.assign(form, { name: '', status: 'En cadrage', startDate: '', endDate: '' })
    ui.openEditor('project', result.project.id)
  }
}
const archiveProject = (p) => {
  if (!window.confirm(`Archiver « ${p.name} » ? Le projet, ses livrables et ses tâches disparaîtront des écrans. Vous pourrez le restaurer depuis l'onglet Archives.`)) return
  write((b) => b.setArchived('project', p.id, true, p.version), `Projet « ${p.name} » archivé.`)
}
</script>

<template>
  <div>
    <section class="admin-section" aria-labelledby="new-project-title">
      <h2 id="new-project-title">Nouveau projet</h2>
      <form class="admin-form" @submit.prevent="addProject">
        <label class="field"><span>Nom du projet</span><input v-model="form.name" type="text" required maxlength="200" /></label>
        <label class="field"><span>Client</span>
          <select v-model="form.clientId" required><option value="" disabled>Choisir…</option><option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
        <label class="field"><span>Statut</span><select v-model="form.status"><option v-for="s in PROJECT_STATUSES" :key="s">{{ s }}</option></select></label>
        <label class="field"><span>Début (facultatif)</span><input v-model="form.startDate" type="date" /></label>
        <label class="field"><span>Fin prévue (facultatif)</span><input v-model="form.endDate" type="date" /></label>
        <VButton type="submit" variant="primary" :loading="creating">Créer le projet</VButton>
      </form>
      <p class="admin-hint">Aucune date n'est proposée par défaut : laissez vide si elle n'est pas encore connue. La fiche du projet s'ouvre ensuite pour compléter le reste.</p>
    </section>

    <section class="admin-section" aria-labelledby="clients-title">
      <h2 id="clients-title">Clients</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th scope="col">Client</th><th scope="col">Projets en cours</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="c in clients" :key="c.id">
              <td><input type="text" :value="c.name" :aria-label="`Nom du client ${c.name}`" maxlength="120" @change="renameClient(c, $event)" @keydown.enter="$event.target.blur()" /></td>
              <td>
                <ul class="projects">
                  <li v-for="p in projectsOf(c.id)" :key="p.id">
                    <RouterLink :to="{ name: 'project', params: { id: p.id } }">{{ p.name }}</RouterLink>
                    <span class="admin-tag">{{ p.status || 'Sans statut' }}</span>
                    <VButton size="sm" variant="ghost" @click="archiveProject(p)">Archiver</VButton>
                  </li>
                  <li v-if="!projectsOf(c.id).length" class="admin-hint">Aucun projet</li>
                </ul>
              </td>
              <td class="actions">
                <VButton size="sm" variant="ghost" :disabled="projectsOf(c.id).length > 0" :title="projectsOf(c.id).length ? 'Archivez d\'abord ses projets' : undefined" @click="archiveClient(c)">Archiver le client</VButton>
              </td>
            </tr>
            <tr v-if="orphans.length">
              <td class="admin-hint">Sans client</td>
              <td><ul class="projects"><li v-for="p in orphans" :key="p.id"><RouterLink :to="{ name: 'project', params: { id: p.id } }">{{ p.name }}</RouterLink></li></ul></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <form class="admin-form" @submit.prevent="addClient">
        <label class="field"><span>Nouveau client</span><input v-model="clientName" type="text" required maxlength="120" /></label>
        <VButton type="submit">Ajouter le client</VButton>
      </form>
    </section>
  </div>
</template>

<style lang="scss" src="./admin.scss"></style>
<style scoped>
.projects { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
.projects li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
</style>
