<script setup lang="ts">
// critique #3's PR row. pr_number/pr_state/merged_at/pr_url are wired now;
// older, pre-enrichment rows still have none of these, so the row falls back
// to a marked placeholder rather than inventing a number.
import { computed } from 'vue'
import type { SessionSummary } from '../lib/types'
import { lifecycleOf, prLabel } from '../lib/sessions'

const props = defineProps<{ session: SessionSummary }>()
const label = computed(() => prLabel(props.session))
const life = computed(() => lifecycleOf(props.session))
const num = computed(() => (props.session.pr_number != null ? `#${props.session.pr_number}` : '?'))
const href = computed(() => props.session.pr_url ?? null)
const stateText = computed(() => {
  const s = props.session
  if (life.value === 'done') return 'merged'
  if (s.pr_state) return s.pr_state
  return 'awaiting review'
})
</script>

<template>
  <div
    v-if="label"
    class="pr"
    :class="life"
    :title="session.pr_state ? `pr_state: ${session.pr_state}` : 'No pr_number or pr_state on this run yet'"
  >
    <span class="mark">PR</span>
    <a v-if="href" class="num" :href="href" target="_blank" rel="noopener">{{ num }}</a>
    <span v-else class="num">{{ num }}</span>
    <span class="state">{{ stateText }}</span>
  </div>
</template>

<style scoped>
.pr {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 2px 9px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
  font-size: 12px;
  color: var(--faint);
  white-space: nowrap;
}

.mark {
  font-weight: 700;
  letter-spacing: 0.05em;
}

.num {
  font-family: var(--mono);
  color: var(--dim);
  text-decoration: none;
}

a.num:hover {
  text-decoration: underline;
}

.needs-review .state {
  color: var(--amber);
}

.done .state {
  color: var(--green);
}
</style>
