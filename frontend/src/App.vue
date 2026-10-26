<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VToasts from '@/design-system/components/VToasts.vue'

const router = useRouter()
onMounted(() => {
  window.addEventListener('vltpm:unauthorized', () => router.push({ name: 'login' }))
})
</script>

<template>
  <RouterView />
  <VToasts />
</template>
