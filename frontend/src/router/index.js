import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/features/auth/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/layouts/AppShell.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('@/features/dashboard/DashboardView.vue'), meta: { title: 'Dashboard' } },
      { path: 'projets', name: 'projects', component: () => import('@/features/projects/ProjectsView.vue'), meta: { title: 'Projets' } },
      { path: 'projets/:id', name: 'project', component: () => import('@/features/projects/ProjectView.vue'), meta: { title: 'Projet' } },
      { path: 'taches', name: 'tasks', component: () => import('@/features/tasks/TasksView.vue'), meta: { title: 'Tâches' } },
      { path: 'planning', name: 'planning', component: () => import('@/features/planning/PlanningView.vue'), meta: { title: 'Planning' } },
      { path: 'bilans', name: 'reports', component: () => import('@/features/reports/ReportsView.vue'), meta: { title: 'Bilans mensuels' } },
      { path: 'admin', name: 'admin', component: () => import('@/features/admin/AdminView.vue'), meta: { title: 'Administration', admin: true } },
    ],
  },
]

// GitHub Pages ne sait pas réécrire les URL : la démo utilise des URL en #/taches.
const history = import.meta.env.VITE_BACKEND === 'sheets' ? createWebHashHistory() : createWebHistory('/')
const router = createRouter({ history, routes })

router.beforeEach(async (to) => {
  const session = useSessionStore()
  if (!session.ready) await session.load().catch(() => { session.user = null })
  if (!to.meta.public && !session.user) return { name: 'login', query: { next: to.fullPath } }
  if (to.meta.admin && !session.isAdmin) return { name: 'dashboard' }
})

// Après une mise en ligne, les fichiers de l'ancienne version n'existent plus : un onglet resté ouvert
// échoue à charger l'écran demandé et le clic semble ne rien faire. On recharge alors la page sur l'écran visé.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk|Unable to preload/i
router.onError((error, to) => {
  if (!CHUNK_ERROR.test(error?.message ?? '')) return
  let reloaded = false
  try { reloaded = sessionStorage.getItem('vltpm.reload') === to.fullPath } catch { /* ignoré */ }
  if (reloaded) return // déjà rechargé une fois pour cet écran : on n'insiste pas
  try { sessionStorage.setItem('vltpm.reload', to.fullPath) } catch { /* ignoré */ }
  window.location.assign(router.resolve(to).href)
  window.location.reload()
})
router.afterEach(() => {
  try { sessionStorage.removeItem('vltpm.reload') } catch { /* ignoré */ }
})

export default router
