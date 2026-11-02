<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { ROLES } from '@/domain/admin'
import VButton from '@/design-system/components/VButton.vue'

// Comptes autorisés à se connecter. Un compte n'est jamais supprimé : il est désactivé, pour garder l'historique.
const props = defineProps({ admin: { type: Object, required: true } })
const write = inject('adminWrite')
const session = useSessionStore()

const users = computed(() => [...props.admin.users].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || (a.name || '').localeCompare(b.name || '')))
const form = reactive({ email: '', name: '', role: 'member', password: '' })
const adding = ref(false)

async function add() {
  adding.value = true
  const input = { email: form.email, name: form.name, role: form.role, ...(session.usesGoogle ? {} : { password: form.password }) }
  const ok = await write((b) => b.createUser(input), `Compte ${form.email.trim().toLowerCase()} autorisé.`)
  adding.value = false
  if (ok) Object.assign(form, { email: '', name: '', role: 'member', password: '' })
}

const update = (user, changes, message) => write((b) => b.updateUser(user.id, changes, user.version), message)
function rename(user, event) {
  const name = event.target.value.trim()
  if (name && name !== user.name) update(user, { name }, 'Nom mis à jour.')
  else event.target.value = user.name
}
const isMe = (user) => user.id === session.user?.id
</script>

<template>
  <div>
    <section class="admin-section" aria-labelledby="users-title">
      <h2 id="users-title">Comptes autorisés</h2>
      <p v-if="session.usesGoogle" class="admin-hint">
        Pour qu'une personne puisse se connecter à la démo, il faut aussi l'ajouter aux utilisateurs test du projet Google Cloud
        et lui partager le Google Sheet en éditeur. Ces deux réglages se font dans Google, pas ici.
      </p>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th scope="col">Nom</th><th scope="col">E-mail</th><th scope="col">Rôle</th><th scope="col">Accès</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" :class="{ 'is-off': u.active === false }">
              <td><input type="text" :value="u.name" :aria-label="`Nom de ${u.email}`" maxlength="120" @change="rename(u, $event)" @keydown.enter="$event.target.blur()" /></td>
              <td>{{ u.email }} <span v-if="isMe(u)" class="admin-tag">vous</span></td>
              <td>
                <select :value="u.role" :disabled="isMe(u)" :aria-label="`Rôle de ${u.email}`" @change="update(u, { role: $event.target.value }, 'Rôle mis à jour.')">
                  <option v-for="r in ROLES" :key="r.id" :value="r.id">{{ r.label }}</option>
                </select>
              </td>
              <td><span class="admin-tag" :class="{ 'admin-tag--on': u.active !== false }">{{ u.active !== false ? 'Actif' : 'Désactivé' }}</span></td>
              <td class="actions">
                <VButton v-if="!isMe(u)" size="sm" variant="ghost" @click="update(u, { active: u.active === false }, u.active === false ? `${u.email} peut de nouveau se connecter.` : `${u.email} ne peut plus se connecter.`)">
                  {{ u.active === false ? 'Réactiver' : 'Désactiver' }}
                </VButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="admin-section" aria-labelledby="new-user-title">
      <h2 id="new-user-title">Autoriser un compte</h2>
      <form class="admin-form" @submit.prevent="add">
        <label class="field"><span>{{ session.usesGoogle ? 'E-mail Google' : 'E-mail' }}</span><input v-model="form.email" type="email" required autocomplete="off" placeholder="prenom@vlt.fr" /></label>
        <label class="field"><span>Nom affiché</span><input v-model="form.name" type="text" required maxlength="120" placeholder="Prénom" /></label>
        <label class="field"><span>Rôle</span>
          <select v-model="form.role"><option v-for="r in ROLES" :key="r.id" :value="r.id">{{ r.label }}</option></select>
        </label>
        <label v-if="!session.usesGoogle" class="field"><span>Mot de passe initial</span><input v-model="form.password" type="password" required minlength="12" autocomplete="new-password" /></label>
        <VButton type="submit" variant="primary" :loading="adding">Autoriser</VButton>
      </form>
      <p class="admin-hint">Les administrateurs accèdent à cet écran ; les membres gèrent projets, livrables et tâches.</p>
    </section>
  </div>
</template>

<style lang="scss" src="./admin.scss"></style>
