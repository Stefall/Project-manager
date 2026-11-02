<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { buildReport, shiftMonth, versionsOf } from '@/domain/reports'
import { todayIso } from '@/domain/planning'
import VButton from '@/design-system/components/VButton.vue'
import ReportDocument from './ReportDocument.vue'
import HistoryLog from './HistoryLog.vue'

// Bilans mensuels : aperçu recalculé depuis l'historique, puis versions figées (jamais recalculées).
const data = useDataStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const thisMonth = todayIso().slice(0, 7)
const tab = ref(route.query.onglet === 'historique' ? 'history' : 'report')
const month = ref(/^\d{4}-\d{2}$/.test(route.query.mois ?? '') ? route.query.mois : thisMonth)
const projectId = ref(typeof route.query.projet === 'string' ? route.query.projet : '')
const selected = ref('draft') // 'draft' ou id d'une version figée
const comment = ref('')
const freezing = ref(false)
const loadError = ref('')

watch([tab, month, projectId], () => {
  selected.value = 'draft'
  router.replace({ query: { onglet: tab.value === 'history' ? 'historique' : undefined, mois: month.value, projet: projectId.value || undefined } })
})

async function load(force = false) {
  loadError.value = ''
  try {
    await data.loadHistory({ force })
  } catch (e) {
    loadError.value = e.message
  }
}
onMounted(() => load())
watch(() => data.revision, () => load())

const projects = computed(() => data.projects.filter((p) => !p.archived))
const draft = computed(() => buildReport({
  month: month.value, projectId: projectId.value,
  projects: data.projects, deliverables: data.deliverables, tasks: data.tasks, events: data.events,
}))
const versions = computed(() => versionsOf(data.reports, { month: month.value, projectId: projectId.value }))
const current = computed(() => versions.value.find((v) => v.id === selected.value) ?? null)

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthLabel = computed(() => MONTH.format(new Date(`${month.value}-01T00:00:00Z`)))
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

async function freeze() {
  freezing.value = true
  try {
    const report = await data.freezeReport({ month: month.value, projectId: projectId.value, comment: comment.value.trim(), content: draft.value })
    comment.value = ''
    selected.value = report.id
    ui.toast(`Version ${report.number} du bilan figée.`, 'success')
  } catch (e) {
    ui.toast(e.message, 'error')
  } finally {
    freezing.value = false
  }
}

function print() {
  const previous = document.title
  const scope = projectId.value ? data.projectById[projectId.value]?.name : 'Tous les projets'
  document.title = `Bilan ${month.value} — ${scope}${current.value ? ` — v${current.value.number}` : ' — aperçu'}`
  window.print()
  document.title = previous
}
</script>

<template>
  <div>
    <header class="page-header no-print">
      <div>
        <h1>Bilans mensuels</h1>
        <p>Reconstitués à partir de l'historique, puis figés en versions qui ne changent plus.</p>
      </div>
      <div class="toggle" role="group" aria-label="Affichage">
        <button type="button" :aria-pressed="tab === 'report'" @click="tab = 'report'">Bilan</button>
        <button type="button" :aria-pressed="tab === 'history'" @click="tab = 'history'">Historique</button>
      </div>
    </header>

    <div class="controls no-print">
      <div class="month-nav" role="group" aria-label="Mois">
        <button type="button" aria-label="Mois précédent" @click="month = shiftMonth(month, -1)">‹</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" aria-label="Mois suivant" :disabled="month >= thisMonth" @click="month = shiftMonth(month, 1)">›</button>
      </div>
      <label class="field"><span>Périmètre</span>
        <select v-model="projectId">
          <option value="">Tous les projets en cours</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.client }} · {{ p.name }}</option>
        </select>
      </label>
    </div>

    <p v-if="loadError" class="error no-print" role="alert">Historique indisponible : {{ loadError }}</p>

    <HistoryLog v-if="tab === 'history'" :month="month" :project-id="projectId" />

    <div v-else class="reports">
      <aside class="versions no-print" aria-label="Versions du bilan">
        <h2 class="section-title">Versions</h2>
        <button type="button" class="version" :aria-current="selected === 'draft' ? 'true' : undefined" @click="selected = 'draft'">
          <strong>Aperçu</strong><span>recalculé à l'ouverture</span>
        </button>
        <button v-for="v in versions" :key="v.id" type="button" class="version" :aria-current="selected === v.id ? 'true' : undefined" @click="selected = v.id">
          <strong>Version {{ v.number }}</strong><span>{{ DATE.format(new Date(v.createdAt)) }} · {{ v.createdBy }}</span>
        </button>
        <p v-if="!versions.length" class="muted">Aucune version figée pour ce mois.</p>

        <div v-if="selected === 'draft'" class="freeze">
          <label class="field"><span>Commentaire (facultatif)</span>
            <textarea v-model="comment" rows="3" maxlength="2000" placeholder="Contexte, points à relever pour le client…" />
          </label>
          <VButton variant="primary" :loading="freezing" @click="freeze">Figer cette version</VButton>
          <p class="muted">Une version figée garde exactement ce contenu, même si les tâches changent ensuite.</p>
        </div>
        <VButton @click="print">Exporter en PDF</VButton>
      </aside>

      <ReportDocument v-if="current" :key="current.id" :content="current.content" :meta="current" />
      <ReportDocument v-else :content="draft" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.muted { color: var(--ink-muted); font-size: var(--text-xs); margin: 0; }
.error { color: var(--status-blocked); }
.toggle { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden;
  button { border: 0; background: var(--surface); padding: var(--space-2) var(--space-4); cursor: pointer; font-size: var(--text-sm); }
  button[aria-pressed='true'] { background: var(--ink); color: var(--surface); }
}
.controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-6); margin-bottom: var(--space-6); .field { min-width: 240px; } }
.month-nav { display: inline-flex; align-items: center; gap: var(--space-2); padding-bottom: var(--space-1);
  strong { min-width: 150px; text-align: center; text-transform: capitalize; }
  button { border: 1px solid var(--line-strong); background: var(--surface); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
}
.reports { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: var(--space-6); align-items: start; }
.versions { position: sticky; top: calc(var(--topbar-height) + var(--space-4)); display: grid; gap: var(--space-2); }
.section-title { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); margin: 0 0 var(--space-2); }
.version {
  display: grid; gap: 2px; text-align: left; padding: var(--space-2) var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--surface); cursor: pointer; font: inherit; color: inherit;
  span { font-size: var(--text-xs); color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &[aria-current='true'] { border-color: var(--ink); box-shadow: inset 3px 0 0 var(--ink); }
}
.freeze { display: grid; gap: var(--space-2); margin: var(--space-3) 0; padding-top: var(--space-3); border-top: 1px solid var(--line);
  textarea { width: 100%; resize: vertical; } }
@include below($bp-desktop) { .reports { grid-template-columns: 1fr; } .versions { position: static; } }
@media print { .reports { display: block; } }
</style>
