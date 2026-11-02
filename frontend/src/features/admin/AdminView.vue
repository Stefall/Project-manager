<script setup>
import { onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backend } from '@/api/backend'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import AdminUsers from './AdminUsers.vue'
import AdminClients from './AdminClients.vue'
import AdminPeople from './AdminPeople.vue'
import AdminSettings from './AdminSettings.vue'
import AdminArchives from './AdminArchives.vue'

// Administration, réservée aux comptes administrateurs (garde du routeur + contrôle du backend).
const data = useDataStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const TABS = [
  { id: 'comptes', label: 'Comptes', component: AdminUsers },
  { id: 'equipe', label: 'Équipe', component: AdminPeople },
  { id: 'clients', label: 'Clients et projets', component: AdminClients },
  { id: 'parametres', label: 'Pôles et paramètres', component: AdminSettings },
  { id: 'archives', label: 'Archives', component: AdminArchives },
]
const tab = ref(TABS.some((t) => t.id === route.query.onglet) ? route.query.onglet : 'comptes')
watch(tab, (onglet) => router.replace({ query: { onglet } }))
watch(() => route.query.onglet, (onglet) => { if (TABS.some((t) => t.id === onglet)) tab.value = onglet })

const admin = ref(null)
const loadError = ref('')
async function reload() {
  loadError.value = ''
  try {
    admin.value = await backend.adminData()
  } catch (e) {
    loadError.value = e.message
  }
}
onMounted(reload)
watch(() => data.revision, reload)

/** Écriture d'administration avec message de confirmation ; renvoie null et affiche l'erreur en cas d'échec. */
async function write(call, success) {
  try {
    const result = await data.adminWrite(call)
    await reload()
    if (success) ui.toast(success, 'success')
    return result ?? true
  } catch (e) {
    const field = Object.values(e.fields ?? {})[0]
    ui.toast(field && e.status === 422 ? field : e.message, 'error')
    if (e.isConflict) await reload()
    return null
  }
}
provide('adminWrite', write)
</script>

<template>
  <div>
    <header class="page-header">
      <div>
        <h1>Administration</h1>
        <p>Comptes autorisés, équipe, clients et projets, pôles, paramètres et archives.</p>
      </div>
      <RouterLink class="history-link" :to="{ name: 'reports', query: { onglet: 'historique' } }">Historique des actions →</RouterLink>
    </header>

    <nav class="tabs" aria-label="Sections de l'administration">
      <button v-for="t in TABS" :key="t.id" type="button" :aria-pressed="tab === t.id" @click="tab = t.id">{{ t.label }}</button>
    </nav>

    <p v-if="loadError" class="error" role="alert">Administration indisponible : {{ loadError }}</p>
    <p v-else-if="!admin" class="muted">Chargement…</p>
    <component :is="TABS.find((t) => t.id === tab).component" v-else :admin="admin" />
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); }
.error { color: var(--status-blocked); }
.history-link { font-size: var(--text-sm); font-weight: var(--weight-strong); }
.tabs {
  display: flex; flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-6); border-bottom: 1px solid var(--line);
  button { border: 0; background: none; padding: var(--space-2) var(--space-3); cursor: pointer; font-size: var(--text-sm); color: var(--ink-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
  button[aria-pressed='true'] { color: var(--ink); border-bottom-color: var(--ink); font-weight: var(--weight-strong); }
  button:focus-visible { @include focus-ring; }
}
</style>
