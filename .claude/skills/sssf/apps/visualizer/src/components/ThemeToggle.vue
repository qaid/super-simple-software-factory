<script setup lang="ts">
// Three-state theme control: system, light, dark. One button that cycles, so
// the header stays a single row of chrome; the tooltip names the next state.
import { computed } from 'vue'
import { cycleTheme, theme, THEME_META, THEMES } from '../lib/theme'

const meta = computed(() => THEME_META[theme.value])
const next = computed(
  () => THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length] ?? 'system',
)
</script>

<template>
  <button
    class="toggle"
    :title="`${meta.label}; click for ${THEME_META[next].label}`"
    :aria-label="meta.label"
    @click="cycleTheme"
  >
    <span class="glyph">{{ meta.glyph }}</span>
    <span class="name">{{ theme }}</span>
  </button>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--dim);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}

.toggle:hover {
  border-color: var(--primary);
  color: var(--text);
}

.glyph {
  font-size: 14px;
  line-height: 1;
}

.name {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}
</style>
