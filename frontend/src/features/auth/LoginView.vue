<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import VButton from '@/design-system/components/VButton.vue'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await session.login(email.value, password.value)
    router.replace(route.query.next || '/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <form class="login__card" @submit.prevent="submit">
      <p class="login__brand">VLT</p>
      <h1 class="editorial">Project Manager</h1>
      <label class="field">
        <span>E-mail</span>
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label class="field">
        <span>Mot de passe</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="login__error" role="alert">{{ error }}</p>
      <VButton type="submit" variant="primary" :loading="loading">Se connecter</VButton>
    </form>
  </main>
</template>

<style scoped lang="scss">
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-4);

  &__card {
    width: min(380px, 100%);
    display: grid;
    gap: var(--space-4);
    padding: var(--space-8);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    h1 { font-size: var(--text-xl); margin-bottom: var(--space-2); }
  }

  &__brand { margin: 0; font-weight: var(--weight-strong); letter-spacing: 0.2em; font-size: var(--text-xs); }
  &__error { margin: 0; color: var(--status-blocked); font-size: var(--text-sm); }
}

</style>
