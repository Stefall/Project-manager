<script setup>
import { nextTick, ref } from 'vue'

// Liste éditable d'éléments. kind = text (chaînes), check ({ label, done }) ou link ({ label, url }).
const props = defineProps({
  label: { type: String, required: true },
  kind: { type: String, default: 'text' },
  addLabel: { type: String, default: 'Ajouter' },
  error: { type: String, default: '' },
})
const model = defineModel({ type: Array, default: () => [] })
const root = ref(null)

const blank = () => ({ text: '', check: { label: '', done: false }, link: { label: '', url: '' } })[props.kind]

async function add() {
  model.value = [...model.value, blank()]
  await nextTick()
  const inputs = root.value.querySelectorAll('.list-editor__item input[type=text], .list-editor__item input[type=url]')
  inputs[inputs.length - (props.kind === 'link' ? 2 : 1)]?.focus()
}
function update(i, value) {
  model.value = model.value.map((item, j) => (j === i ? value : item))
}
function remove(i) {
  model.value = model.value.filter((_, j) => j !== i)
}
</script>

<template>
  <fieldset ref="root" class="list-editor">
    <legend>{{ label }}</legend>
    <ul>
      <li v-for="(item, i) in model" :key="i" class="list-editor__item">
        <template v-if="kind === 'text'">
          <input type="text" :value="item" :aria-label="`${label}, élément ${i + 1}`" @input="update(i, $event.target.value)" @keydown.enter.prevent="add" />
        </template>
        <template v-else-if="kind === 'check'">
          <input type="checkbox" :checked="item.done" :aria-label="`Fait : ${item.label}`" @change="update(i, { ...item, done: $event.target.checked })" />
          <input type="text" :value="item.label" :class="{ done: item.done }" :aria-label="`Point ${i + 1}`" @input="update(i, { ...item, label: $event.target.value })" @keydown.enter.prevent="add" />
        </template>
        <template v-else>
          <input type="text" class="list-editor__label" :value="item.label" placeholder="Libellé" :aria-label="`Libellé du lien ${i + 1}`" @input="update(i, { ...item, label: $event.target.value })" />
          <input type="url" :value="item.url" placeholder="https://…" :aria-label="`Adresse du lien ${i + 1}`" @input="update(i, { ...item, url: $event.target.value.trim() })" />
          <a v-if="/^https?:\/\//.test(item.url)" :href="item.url" target="_blank" rel="noopener" class="list-editor__open" :aria-label="`Ouvrir ${item.label || item.url}`">↗</a>
        </template>
        <button type="button" class="list-editor__remove" :aria-label="`Retirer l'élément ${i + 1}`" @click="remove(i)">×</button>
      </li>
    </ul>
    <p v-if="error" class="field__error">{{ error }}</p>
    <button type="button" class="list-editor__add" @click="add">+ {{ addLabel }}</button>
  </fieldset>
</template>

<style scoped lang="scss">
.list-editor {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  legend { font-size: var(--text-sm); font-weight: var(--weight-strong); margin-bottom: var(--space-2); }
  ul { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: grid; gap: var(--space-2); }

  &__item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    input[type='text'], input[type='url'] { flex: 1 1 0; width: 0; min-width: 0; height: 36px; padding: 0 var(--space-3); border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--surface); }
    input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--ink); }
    .done { text-decoration: line-through; color: var(--ink-muted); }
  }
  &__label { flex: 0 0 35% !important; width: auto !important; }
  &__open { text-decoration: none; padding: 0 var(--space-1); }
  &__remove { border: 0; background: none; font-size: 18px; cursor: pointer; color: var(--ink-muted); padding: 0 var(--space-1); }
  &__add { border: 0; background: none; padding: 0; font-size: var(--text-sm); color: var(--ink-muted); cursor: pointer; text-decoration: underline; }
}
</style>
