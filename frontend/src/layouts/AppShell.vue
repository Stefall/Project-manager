<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import VButton from '@/design-system/components/VButton.vue'
import SaveIndicator from '@/design-system/components/SaveIndicator.vue'
import QuickAddDrawer from '@/features/quick-add/QuickAddDrawer.vue'
import EditorHost from '@/features/editors/EditorHost.vue'

const data = useDataStore()
const session = useSessionStore()
const ui = useUiStore()
const route = useRoute()

const nav = computed(() => [
  { to: '/', label: 'Dashboard' },
  { to: '/projets', label: 'Projets' },
  { to: '/taches', label: 'Tâches' },
  { to: '/planning', label: 'Planning' },
  { to: '/bilans', label: 'Bilans mensuels' },
  ...(session.isAdmin ? [{ to: '/admin', label: 'Administration' }] : []),
])

// Sur une fiche projet, une nouvelle tâche est rattachée à ce projet.
const contextProjectId = computed(() => (route.name === 'project' ? route.params.id : ui.currentProjectId))

// Raccourci « N » : nouvelle tâche, sauf pendant une saisie
function onKey(e) {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable
  if (e.key.toLowerCase() === 'n' && !typing && !e.metaKey && !e.ctrlKey && !ui.quickAdd.open && !ui.editor) {
    e.preventDefault()
    ui.openQuickAdd({ projectId: contextProjectId.value })
  }
}

onMounted(() => {
  data.load()
  data.startPolling()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main">Aller au contenu</a>

    <nav class="shell__sidebar" aria-label="Navigation principale">
      <p class="shell__brand">VLT <span>Project Manager</span></p>
      <ul>
        <li v-for="item in nav" :key="item.to">
          <RouterLink :to="item.to" class="shell__link" :exact-active-class="item.to === '/' ? 'is-active' : ''" :active-class="item.to === '/' ? '' : 'is-active'">
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
      <div class="shell__user">
        <span>{{ session.user?.name || session.user?.email }}</span>
        <button type="button" @click="session.logout().then(() => $router.push({ name: 'login' }))">Déconnexion</button>
      </div>
    </nav>

    <div class="shell__main">
      <header class="shell__topbar">
        <p class="shell__crumb">{{ route.meta.title }}</p>
        <label class="shell__project">
          <span class="sr-only">Projet affiché</span>
          <select :value="ui.currentProjectId" @change="ui.selectProject($event.target.value)">
            <option value="">Tous les projets</option>
            <option v-for="p in data.projects" :key="p.id" :value="p.id">{{ p.client }} · {{ p.name }}</option>
          </select>
        </label>
        <SaveIndicator />
        <VButton variant="primary" class="shell__new" aria-keyshortcuts="n" @click="ui.openQuickAdd({ projectId: contextProjectId })">
          + Nouvelle tâche
        </VButton>
      </header>

      <main id="main" class="shell__content" tabindex="-1">
        <p v-if="data.error" class="shell__error" role="alert">Impossible de charger les données : {{ data.error }}</p>
        <RouterView />
      </main>
    </div>

    <QuickAddDrawer />
    <EditorHost />
  </div>
</template>

<style scoped lang="scss">
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;

  &__sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-4);
    border-right: 1px solid var(--line);
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
  }

  &__brand {
    margin: 0 var(--space-3);
    font-weight: var(--weight-strong);
    letter-spacing: 0.15em;
    span { display: block; letter-spacing: 0; font-weight: var(--weight-regular); color: var(--ink-muted); font-size: var(--text-sm); }
  }

  &__link {
    display: block;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    &:hover { background: var(--surface-sunken); color: var(--ink); }
    &.is-active { background: var(--surface); color: var(--ink); font-weight: var(--weight-strong); box-shadow: inset 0 0 0 1px var(--line); }
  }

  &__user {
    margin-top: auto;
    display: grid;
    gap: var(--space-1);
    padding: 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--ink-muted);
    button { justify-self: start; border: 0; background: none; padding: 0; text-decoration: underline; cursor: pointer; color: inherit; }
  }

  &__main { min-width: 0; }

  &__topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--topbar-height);
    padding: 0 var(--space-8);
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }

  &__crumb { margin: 0 auto 0 0; font-weight: var(--weight-strong); font-size: var(--text-sm); }
  &__project select { height: 32px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--surface); padding: 0 var(--space-2); font-size: var(--text-sm); max-width: 260px; }
  &__content { padding: var(--space-8); max-width: 1280px; outline: none; }
  &__error { padding: var(--space-3) var(--space-4); background: var(--status-blocked-bg); color: var(--status-blocked); border-radius: var(--radius-sm); }

  @include below($bp-tablet) {
    grid-template-columns: 1fr;
    &__sidebar { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; padding: var(--space-3) var(--space-4); border-right: 0; border-bottom: 1px solid var(--line); ul { display: flex; flex-wrap: wrap; } }
    &__user { display: none; }
    &__topbar { padding: 0 var(--space-4); }
    &__crumb { display: none; }
    &__content { padding: var(--space-4); }
    // Sur mobile, le bouton de saisie rapide reste accessible en bas d'écran
    &__new { position: fixed; right: var(--space-4); bottom: var(--space-4); z-index: 20; height: 48px; }
  }
}

.skip-link { position: absolute; left: -9999px; &:focus { left: var(--space-4); top: var(--space-4); z-index: 100; background: var(--surface); padding: var(--space-2) var(--space-3); } }
</style>
