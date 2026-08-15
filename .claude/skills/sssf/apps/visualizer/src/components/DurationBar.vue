<script setup lang="ts">
// critique #4. The dot swimlane is replaced by a stacked
// proportional bar, one segment per agent, in that agent's configured color.
// Labels sit under the bar at readable sizes; the micro form drops labels for
// table cells and keeps the shape as an at-a-glance signature.
import { computed } from 'vue'
import type { SessionSummary } from '../lib/types'
import { hexAlpha } from '../lib/events'
import { segmentsOf, shortDur } from '../lib/sessions'

const props = defineProps<{
  session: SessionSummary
  nowMs: number
  micro?: boolean
  /** Show routed model under each agent label. */
  showModels?: boolean
}>()

const segs = computed(() => segmentsOf(props.session, props.nowMs))
// Below this share a label would collide with its neighbour, so it drops out.
const LABEL_MIN_PCT = 14
</script>

<template>
  <div v-if="segs.length" class="dur" :class="{ micro }">
    <div class="track">
      <span
        v-for="s in segs"
        :key="s.owner"
        class="seg"
        :class="{ live: s.running }"
        :style="{
          width: `${Math.max(s.pct, 2)}%`,
          background: s.running ? hexAlpha(s.color, 0.45) : s.color,
          boxShadow: s.running ? `inset 0 0 0 1px ${s.color}` : 'none',
        }"
        :title="`${s.owner} ${shortDur(s.ms)}${s.model ? ' · ' + s.model : ''}`"
      />
    </div>
    <div v-if="!micro" class="legend">
      <span
        v-for="s in segs"
        :key="s.owner"
        class="leg"
        :style="{ width: `${Math.max(s.pct, 2)}%` }"
      >
        <template v-if="s.pct >= LABEL_MIN_PCT">
          <span class="leg-name" :style="{ color: s.color }">{{ s.owner }}</span>
          <span class="leg-ms">{{ shortDur(s.ms) }}</span>
          <span v-if="showModels && s.model" class="leg-model" :title="s.model">{{ s.model }}</span>
        </template>
      </span>
    </div>
  </div>
  <div v-else class="dur-empty">no agent phases yet</div>
</template>

<style scoped>
.dur {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.track {
  display: flex;
  height: 8px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--track);
}

.micro .track {
  height: 6px;
}

.seg {
  flex: none;
  transition: width 0.3s ease;
}

.seg.live {
  animation: pulse 1.5s ease-in-out infinite;
}

.legend {
  display: flex;
  min-width: 0;
}

.leg {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-right: 8px;
  overflow: hidden;
  white-space: nowrap;
}

.leg-name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leg-ms {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}

.leg-model {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--faint);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dur-empty {
  font-size: 12px;
  color: var(--faint);
}
</style>
