<script setup lang="ts">
// The sessions view: a command center.
//
// Split layout. Left is a narrow reverse-chronological list (most recent run
// first) with tiny status glyphs and needs-you highlighting; right is one
// large detail panel for the selected run: full title,
// every phase with duration and routed model, error block, PR row. j/k moves
// the selection.
//
// This component also owns the poll loop, so there is exactly one /api/sessions
// poller on the page.
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { SessionSummary } from '../lib/types'
import { fetchSessions } from '../lib/api'
import { fmtCost, fmtDate, fmtDuration, fmtInfraCost, fmtTokens, ts } from '../lib/format'
import { agentColor } from '../lib/events'
import { modelName } from '../lib/models'
import { hrefFor } from '../lib/router'
import {
  ageLabel,
  costOutlierThreshold,
  durationMs,
  failureOf,
  issueChip,
  issueTitle,
  lifecycleOf,
  LIFECYCLE_META,
  MISSING_API_FIELDS,
  needsYou,
  rankedOrder,
  shortDur,
  typingInField,
} from '../lib/sessions'
import LifecyclePill from './LifecyclePill.vue'
import DurationBar from './DurationBar.vue'
import PrRow from './PrRow.vue'

// ── Data ─────────────────────────────────────────────────────────────────────

const sessions = shallowRef<SessionSummary[]>([])
const apiError = ref<string | null>(null)
const loaded = ref(false)
const nowMs = ref(Date.now())

let timer: ReturnType<typeof setInterval> | undefined
let inflight = false

async function tick() {
  if (inflight) return
  inflight = true
  try {
    sessions.value = await fetchSessions()
    nowMs.value = Date.now()
    apiError.value = null
    loaded.value = true
  } catch (err) {
    apiError.value = err instanceof Error ? err.message : String(err)
  } finally {
    inflight = false
  }
}

// ── Selection ────────────────────────────────────────────────────────────────

const ranked = computed(() => rankedOrder(sessions.value))
const outlierAbove = computed(() => costOutlierThreshold(sessions.value))
const selectedId = ref<string | null>(null)
const showGaps = ref(false)

const selected = computed(
  () => ranked.value.find((s) => s.adw_id === selectedId.value) ?? ranked.value[0] ?? null,
)

// Selection follows the data until the user picks: an empty first render must
// not leave the panel permanently blank once sessions arrive.
watch(ranked, (list) => {
  if (!selectedId.value && list[0]) selectedId.value = list[0].adw_id
})

function move(step: number) {
  const list = ranked.value
  if (!list.length) return
  const i = list.findIndex((s) => s.adw_id === selected.value?.adw_id)
  const next = list[Math.min(Math.max(i + step, 0), list.length - 1)]
  if (next) selectedId.value = next.adw_id
}

function onKey(e: KeyboardEvent) {
  if (typingInField() || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'j') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'k') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Escape' && showGaps.value) {
    e.preventDefault()
    showGaps.value = false
  }
}

onMounted(() => {
  void tick()
  timer = setInterval(() => void tick(), 500)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKey)
})

// ── Phase table ──────────────────────────────────────────────────────────────

interface PhaseRow {
  id: string
  name: string
  owner: string
  kind: string
  status: string
  ms: number
  color: string
  model: string
}

const phaseRows = computed<PhaseRow[]>(() => {
  const s = selected.value
  if (!s) return []
  const owners: string[] = []
  return (s.phases ?? []).map((p) => {
    if (p.owner && !owners.includes(p.owner)) owners.push(p.owner)
    const info = (s.agents ?? []).find((a) => a.agent === p.owner)
    const t0 = ts(p.started_at)
    const t1 = ts(p.ended_at)
    const ms = Number.isFinite(t0)
      ? Math.max((Number.isFinite(t1) ? t1 : nowMs.value) - t0, 0)
      : NaN
    return {
      id: p.phase_id,
      name: p.name ?? 'n/a',
      owner: p.owner || p.kind || 'n/a',
      kind: p.kind ?? '',
      status: String(p.status ?? ''),
      ms,
      color:
        p.kind === 'agent'
          ? agentColor(info?.color, null, Math.max(owners.indexOf(p.owner ?? ''), 0))
          : 'var(--faint)',
      // TODO(api): only agent phases carry a routed model; code/engineer steps
      // have none, which is correct but leaves the column sparse.
      model: modelName(info?.model),
    }
  })
})

const maxPhaseMs = computed(() =>
  Math.max(...phaseRows.value.map((p) => (Number.isFinite(p.ms) ? p.ms : 0)), 1),
)
</script>

<template>
  <div class="wrap">
    <div v-if="apiError" class="error-bar">api unreachable, retrying {{ apiError }}</div>

    <div v-if="!ranked.length" class="empty-state">
      {{ loaded ? 'no sessions yet' : apiError ? '' : 'loading sessions' }}
    </div>

    <div v-else class="cc">
      <aside class="list">
        <div class="list-head">
          <span>{{ ranked.length }} runs</span>
          <span class="hint">j / k</span>
        </div>
        <button
          v-for="s in ranked"
          :key="s.adw_id"
          class="item"
          :class="[lifecycleOf(s), { sel: s.adw_id === selected?.adw_id, hot: needsYou(s) }]"
          @click="selectedId = s.adw_id"
        >
          <span class="glyph" :style="{ color: LIFECYCLE_META[lifecycleOf(s)].color }">{{
            LIFECYCLE_META[lifecycleOf(s)].glyph
          }}</span>
          <span class="i-body">
            <span class="i-title" :title="issueTitle(s)">{{ issueTitle(s) }}</span>
            <span class="i-meta">
              <span class="i-chip">{{ issueChip(s) }}</span>
              <span>{{ fmtCost(s.total_cost) }}</span>
              <span class="i-infra" title="Scaleway compute, euros">{{
                fmtInfraCost(s.infra_cost)
              }}</span>
              <span>{{ ageLabel(s, nowMs) }}</span>
            </span>
          </span>
        </button>

        <footer class="list-foot">
          <button class="gaps-link" :class="{ on: showGaps }" @click="showGaps = !showGaps">
            data gaps
          </button>
        </footer>
      </aside>

      <section v-if="selected" class="panel">
        <header class="p-head">
          <div class="p-title-row">
            <!-- issue_number is wired now; falls back to '#?' on rows from
                 before enrichment started recording it. -->
            <span class="p-chip">{{ issueChip(selected) }}</span>
            <h1 class="p-title">{{ issueTitle(selected) }}</h1>
          </div>
          <div class="p-state">
            <LifecyclePill :life="lifecycleOf(selected)" />
            <PrRow :session="selected" />
            <span class="p-run">{{ selected.adw_name ?? 'n/a' }} · {{ selected.adw_id }}</span>
          </div>
        </header>

        <div class="p-stats">
          <span class="stat">
            <b :class="{ outlier: (selected.total_cost ?? 0) > outlierAbove }">{{
              fmtCost(selected.total_cost)
            }}</b>
            <i>cost</i>
          </span>
          <!-- Its own stat, never folded into `cost`: different currency, and
               model spend grows with task difficulty while instance spend grows
               with run count and with boxes left running. -->
          <span class="stat">
            <b>{{ fmtInfraCost(selected.infra_cost) }}</b>
            <i>infra</i>
          </span>
          <span class="stat">
            <b>{{ fmtDuration(durationMs(selected, nowMs)) }}</b><i>duration</i>
          </span>
          <span class="stat">
            <b>{{ fmtTokens(selected.total_tokens) }}</b><i>tokens</i>
          </span>
          <span class="stat">
            <b>{{ selected.phase_count ?? selected.phases?.length ?? 0 }}</b><i>phases</i>
          </span>
          <span class="stat">
            <b>{{ fmtDate(selected.started_at) }}</b><i>started</i>
          </span>
        </div>

        <DurationBar :session="selected" :now-ms="nowMs" show-models />

        <div v-if="failureOf(selected)" class="err">
          <span class="err-head"
            >failed in {{ failureOf(selected)?.who }} · phase
            {{ failureOf(selected)?.phase }}</span
          >
          <pre class="err-body">{{ failureOf(selected)?.line }}</pre>
        </div>

        <div class="phases">
          <div class="ph-head">
            <span>Phase</span><span>Owner</span><span>Model</span><span>Duration</span>
          </div>
          <div v-for="p in phaseRows" :key="p.id" class="ph" :class="p.status">
            <span class="ph-name">
              <span class="ph-dot" :style="{ background: p.color }" />
              {{ p.name }}
            </span>
            <span
              class="ph-owner"
              :style="{ color: p.kind === 'agent' ? p.color : 'var(--faint)' }"
              >{{ p.owner }}</span
            >
            <span class="ph-model" :title="p.model">{{ p.model || 'n/a' }}</span>
            <span class="ph-dur">
              <span
                class="ph-bar"
                :style="{
                  width: `${((Number.isFinite(p.ms) ? p.ms : 0) / maxPhaseMs) * 100}%`,
                  background: p.color,
                }"
              />
              <span class="ph-ms">{{ shortDur(p.ms) }}</span>
            </span>
          </div>
        </div>

        <a class="open" :href="hrefFor(selected.adw_id)">open full trace →</a>
      </section>

      <section v-else class="panel empty">no runs</section>
    </div>

    <!-- Fields the API does not carry. Kept visible so the placeholders in the
         UI ("#?", "PR ?") read as known gaps rather than bugs. -->
    <div v-if="showGaps" class="gaps" role="dialog" aria-label="data gaps">
      <div class="gaps-head">
        API fields this view needs but the API does not return
        <button class="gaps-close" aria-label="close" @click="showGaps = false">×</button>
      </div>
      <ul class="gaps-list">
        <li v-for="f in MISSING_API_FIELDS" :key="f">{{ f }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
}

.cc {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 0;
  height: calc(100vh - 60px);
}

.list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-right: 1px solid var(--border-soft);
  background: var(--panel);
  padding: 12px 10px 12px;
}

.list-head {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px 10px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faint);
}

.hint {
  font-family: var(--mono);
  letter-spacing: 0;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.item:hover {
  background: var(--hover);
}

.item.sel {
  background: var(--sel);
  border-left-color: var(--primary);
}

.item.hot .i-title {
  color: var(--text);
  font-weight: 600;
}

.glyph {
  flex: none;
  width: 14px;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.i-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.i-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--dim);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.i-meta {
  display: flex;
  gap: 9px;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}

.i-chip {
  color: var(--purple);
}

.list-foot {
  margin-top: auto;
  padding: 12px 10px 2px;
  border-top: 1px solid var(--border-soft);
}

.gaps-link {
  padding: 3px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 12px;
  cursor: pointer;
}

.gaps-link:hover,
.gaps-link.on {
  border-color: var(--border);
  color: var(--text);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px 28px 40px;
  overflow-y: auto;
}

.panel.empty {
  align-items: center;
  justify-content: center;
  color: var(--faint);
}

.p-title-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-width: 0;
}

.p-chip {
  flex: none;
  padding: 3px 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--purple);
  background: var(--purple-bg);
  color: var(--purple);
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 500;
}

.p-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.28;
}

.p-state {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.p-run {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
}

.p-stats {
  display: flex;
  gap: 26px;
  padding: 13px 0;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat b {
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 500;
  /* Guide: data blue signals measurement and quantification. */
  color: var(--data);
}

.stat b.outlier {
  color: var(--amber);
}

.stat i {
  font-size: 12px;
  font-style: normal;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--faint);
}

.err-head {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--red);
}

.err-body {
  font-size: 13px;
  border-color: var(--red);
  background: var(--red-bg);
  color: var(--err-text);
}

.phases {
  display: flex;
  flex-direction: column;
}

.ph-head,
.ph {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) 110px minmax(0, 1fr) 190px;
  gap: 14px;
  align-items: center;
}

.ph-head {
  padding: 0 6px 7px;
  font-size: 12px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--faint);
  border-bottom: 1px solid var(--border-soft);
}

.ph {
  padding: 7px 6px;
  border-bottom: 1px solid var(--border-soft);
  font-size: 14px;
}

.ph.fail .ph-name {
  color: var(--red);
}

.ph.running .ph-name {
  color: var(--blue);
}

.ph-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  min-width: 0;
}

.ph-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.ph-owner {
  font-size: 12px;
  font-weight: 600;
}

.ph-model {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ph-dur {
  display: flex;
  align-items: center;
  gap: 9px;
}

.ph-bar {
  height: 6px;
  min-width: 2px;
  border-radius: var(--radius-pill);
  opacity: 0.65;
}

.ph-ms {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--dim);
}

.open {
  align-self: flex-start;
  font-size: 14px;
}

.gaps {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 50;
  max-width: 640px;
  max-height: 52vh;
  overflow-y: auto;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  box-shadow: var(--shadow-md);
}

.gaps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}

.gaps-close {
  border: 0;
  background: transparent;
  color: var(--faint);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.gaps-close:hover {
  color: var(--text);
}

.gaps-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--dim);
}
</style>
