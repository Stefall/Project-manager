import { api, setCsrfToken } from './client'

// Backend de production : API PHP sur le serveur de VLT (voir api/).
export const phpBackend = {
  kind: 'php',

  async me() {
    const { user, csrf } = await api.get('/auth/me')
    setCsrfToken(csrf)
    return { user }
  },

  async login({ email, password }) {
    const { user, csrf } = await api.post('/auth/login', { email, password })
    setCsrfToken(csrf)
    return { user }
  },

  logout: () => api.post('/auth/logout'),

  bootstrap: (since) => api.get(`/bootstrap${since !== null ? `?since=${since}` : ''}`),
  createTask: (input) => api.post('/tasks', input),
  updateTask: (id, changes, version) => api.patch(`/tasks/${id}`, changes, version),
  archiveTask: (id, version) => api.post(`/tasks/${id}/archive`, {}, version),
  updateProject: (id, changes, version) => api.patch(`/projects/${id}`, changes, version),
  createDeliverable: (input) => api.post('/deliverables', input),
  updateDeliverable: (id, changes, version) => api.patch(`/deliverables/${id}`, changes, version),
  deliverableMilestone: (id, action, body, version) => api.post(`/deliverables/${id}/${action}`, body, version),
}
