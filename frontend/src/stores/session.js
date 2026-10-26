import { defineStore } from 'pinia'
import { api, setCsrfToken } from '@/api/client'

export const useSessionStore = defineStore('session', {
  state: () => ({ user: null, ready: false }),
  getters: {
    isAdmin: (s) => s.user?.role === 'admin',
  },
  actions: {
    async load() {
      const { user, csrf } = await api.get('/auth/me')
      setCsrfToken(csrf)
      this.user = user
      this.ready = true
    },
    async login(email, password) {
      const { user, csrf } = await api.post('/auth/login', { email, password })
      setCsrfToken(csrf)
      this.user = user
    },
    async logout() {
      await api.post('/auth/logout')
      this.user = null
    },
  },
})
