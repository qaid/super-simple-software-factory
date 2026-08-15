<script setup lang="ts">
// critique #1. Issue number chip (never truncates) plus the
// full issue title, clamped to two lines instead of ellipsized to one.
import { computed } from 'vue'
import type { SessionSummary } from '../lib/types'
import { issueChip, issueTitle } from '../lib/sessions'

const props = defineProps<{ session: SessionSummary; lines?: number; size?: number }>()
const chip = computed(() => issueChip(props.session))
const title = computed(() => issueTitle(props.session))
</script>

<template>
  <div class="head">
    <!-- TODO(api): placeholder until the API carries issue_number. -->
    <span class="chip" title="No issue_number in the API yet">{{ chip }}</span>
    <span
      class="title"
      :style="{ '-webkit-line-clamp': String(lines ?? 2), fontSize: `${size ?? 17}px` }"
      :title="title"
      >{{ title }}</span
    >
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
}

.chip {
  flex: none; /* never truncates, per the critique */
  padding: 2px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--purple);
  background: var(--purple-bg);
  color: var(--purple);
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
  white-space: nowrap;
}

.title {
  font-weight: 600;
  line-height: 1.32;
  color: var(--text);
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
