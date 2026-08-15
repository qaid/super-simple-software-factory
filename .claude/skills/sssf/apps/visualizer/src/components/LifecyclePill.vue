<script setup lang="ts">
// lifecycle state as a pill. Fixes critique #3 by naming the
// state (needs review vs done) instead of collapsing everything into "success".
import { computed } from 'vue'
import { LIFECYCLE_META, type Lifecycle } from '../lib/sessions'

const props = defineProps<{ life: Lifecycle; compact?: boolean }>()
const meta = computed(() => LIFECYCLE_META[props.life])
</script>

<template>
  <span class="pill" :class="[life, { compact }]">
    <span class="glyph">{{ meta.glyph }}</span>
    <span class="label">{{ meta.label }}</span>
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid currentColor;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  flex: none;
}

.pill.compact {
  padding: 1px 8px;
  font-size: 11px;
}

.glyph {
  font-size: 11px;
  line-height: 1;
}

.queued {
  color: var(--faint);
  background: var(--faint-bg);
}

.building {
  color: var(--blue);
  background: var(--blue-bg);
}

.building .glyph {
  animation: spin 1.6s linear infinite;
}

.needs-review {
  color: var(--amber);
  background: var(--amber-bg);
  box-shadow: none;
}

.attention {
  color: var(--purple);
  background: var(--purple-bg);
}

.failed {
  color: var(--red);
  background: var(--red-bg);
}

.done {
  color: var(--green);
  background: var(--green-bg);
}
</style>
