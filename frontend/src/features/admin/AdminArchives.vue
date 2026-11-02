<script setup>
import { computed, inject } from 'vue'
import VButton from '@/design-system/components/VButton.vue'

// Éléments archivés : rien n'est supprimé du Sheet, tout se restaure.
const props = defineProps({ admin: { type: Object, required: true } })
const write = inject('adminWrite')

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const when = (item) => (item.updatedAt ? DATE.format(new Date(item.updatedAt)) : '')
const archivedProject = computed(() => new Set(props.admin.archived.projects.map((p) => p.id)))
const projectName = (id) => props.admin.archived.projects.find((p) => p.id === id)?.name

const groups = computed(() => [
  { kind: 'person', title: 'Personnes de l\'annuaire', items: (props.admin.people ?? []).filter((p) => p.archived), label: (p) => `${p.name} · ${p.email}` },
  { kind: 'client', title: 'Clients', items: props.admin.clients.filter((c) => c.archived), label: (c) => c.name },
  { kind: 'project', title: 'Projets', items: props.admin.archived.projects, label: (p) => `${p.client ? `${p.client} · ` : ''}${p.name}` },
  { kind: 'deliverable', title: 'Livrables', items: props.admin.archived.deliverables, label: (d) => d.name },
  { kind: 'task', title: 'Tâches', items: props.admin.archived.tasks, label: (t) => t.title },
])

function restore(kind, item) {
  const name = item.name ?? item.title
  const call = {
    client: (b) => b.updateClient(item.id, { archived: false }, item.version),
    person: (b) => b.updatePerson(item.id, { archived: false }, item.version),
  }[kind] ?? ((b) => b.setArchived(kind, item.id, false, item.version))
  write(call, `« ${name} » restauré.`)
}
</script>

<template>
  <div>
    <p class="admin-hint intro">Archiver ne supprime rien : la ligne reste dans le Google Sheet et l'historique est conservé.</p>
    <section v-for="g in groups" :key="g.kind" class="admin-section" :aria-labelledby="`archives-${g.kind}`">
      <h2 :id="`archives-${g.kind}`">{{ g.title }} ({{ g.items.length }})</h2>
      <p v-if="!g.items.length" class="admin-hint">Aucun élément archivé.</p>
      <div v-else class="admin-table-wrap">
        <table class="admin-table">
          <tbody>
            <tr v-for="item in g.items" :key="item.id">
              <td>
                {{ g.label(item) }}
                <span v-if="item.projectId && archivedProject.has(item.projectId)" class="admin-hint"> — projet « {{ projectName(item.projectId) }} » archivé : restaurez-le pour revoir cet élément</span>
              </td>
              <td class="when">Archivé le {{ when(item) }}<template v-if="item.updatedBy"> par {{ item.updatedBy }}</template></td>
              <td class="actions"><VButton size="sm" @click="restore(g.kind, item)">Restaurer</VButton></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style lang="scss" src="./admin.scss"></style>
<style scoped>
.intro { margin-bottom: var(--space-6); }
.when { color: var(--ink-muted); font-size: var(--text-xs); white-space: nowrap; }
</style>
