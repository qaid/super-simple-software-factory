<script setup lang="ts">
// critique #3's PR row. The API carries no pr_number/pr_state,
// so the row renders as a marked placeholder rather than inventing a number.
import { computed } from 'vue'
import type { SessionSummary } from '../lib/types'
import { lifecycleOf, prLabel } from '../lib/sessions'

const props = defineProps<{ session: SessionSummary }>()
const label = computed(() => prLabel(props.session))
const life = computed(() => lifecycleOf(props.session))
</script>

<template>
  <!-- TODO(api): needs pr_number, pr_url, pr_state, merged_at. -->
  <div v-if="label" class="pr" :class="life" title="No pr_number or pr_state in the API yet">
    <span class="mark">PR</span>
    <span class="num">?</span>
    <span class="state">{{ life === 'done' ? 'merged' : 'awaiting review' }}</span>
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
}

.needs-review .state {
  color: var(--amber);
}

.done .state {
  color: var(--green);
}
</style>
