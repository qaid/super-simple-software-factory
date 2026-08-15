<script setup lang="ts">
// critique #2. Which agent failed, and the first line of its
// error, straight from the list payload's embedded phases (no extra fetch).
import { computed } from 'vue'
import type { SessionSummary } from '../lib/types'
import { failureOf } from '../lib/sessions'

const props = defineProps<{ session: SessionSummary; block?: boolean }>()
const fail = computed(() => failureOf(props.session))
</script>

<template>
  <div v-if="fail" class="fail" :class="{ block }">
    <span class="who">{{ fail.who }}</span>
    <span class="phase">{{ fail.phase }}</span>
    <span class="line" :title="fail.line">{{ fail.line }}</span>
  </div>
</template>

<style scoped>
.fail {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 6px 9px;
  border-left: 2px solid var(--red);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--red-bg);
}

.who {
  flex: none;
  color: var(--red);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.phase {
  flex: none;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}

.line {
  min-width: 0;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--err-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fail.block {
  display: block;
}

.fail.block .line {
  display: block;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
