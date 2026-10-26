<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import VToasts from '@/design-system/components/VToasts.vue'

const router = useRouter()
const session = useSessionStore()
// Session Google expirée ou révoquée : retour à la connexion avec un message, sans boucle silencieuse.
onMounted(() => {
  window.addEventListener('vltpm:unauthorized', async () => {
    await session.logout().catch(() => {})
    router.push({ name: 'login', query: { raison: 'session' } })
  })
})
</script>

<template>
  <RouterView />
  <VToasts />
</template>
