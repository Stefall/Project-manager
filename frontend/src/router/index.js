import { createRouter, createWebHistory } from 'vue-router'
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

const router = createRouter({ history: createWebHistory('/'), routes })

router.beforeEach(async (to) => {
  const session = useSessionStore()
  if (!session.ready) await session.load().catch(() => {})
  if (!to.meta.public && !session.user) return { name: 'login', query: { next: to.fullPath } }
  if (to.meta.admin && !session.isAdmin) return { name: 'dashboard' }
})

export default router
