import { defineStore } from 'pinia'
import { backend } from '@/api/backend'

export const useSessionStore = defineStore('session', {
  state: () => ({ user: null, ready: false }),
  getters: {
    isAdmin: (s) => s.user?.role === 'admin',
    usesGoogle: () => backend.kind === 'sheets',
  },
  actions: {
    async load() {
      try {
        this.user = (await backend.me()).user
      } finally {
        this.ready = true
      }
    },
    async login(credentials) {
      this.user = (await backend.login(credentials)).user
    },
    async logout() {
      await backend.logout()
      this.user = null
    },
  },
})
