/**
 * Sessions-view derivations: lifecycle, ranking, failure surfacing, per-agent
 * duration segments. One module on purpose, so lifecycle semantics are decided
 * in exactly one place and the list, the pills and the bars cannot disagree.
 *
 * Promoted from the prototype round; the five explored variants live on the
 * `prototype/sessions-redesign` branch.
 */
import type { Phase, SessionSummary } from './types'
import { ts } from './format'
import { agentColor } from './events'
import { modelName } from './models'

/** True when the user is typing, so global key handlers must stand down. */
export function typingInField(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
// The critique's point 3: "success" today conflates "PR is open, go review it"
// with "merged and finished". The API cannot yet tell those apart (see
// MISSING_API_FIELDS), so a finished run resolves to needs-review and `done`
// stays reachable-but-unused until the API carries merge state.

export type Lifecycle = 'queued' | 'building' | 'needs-review' | 'attention' | 'failed' | 'done'

export const LIFECYCLE_META: Record<Lifecycle, { label: string; color: string; glyph: string }> = {
  queued: { label: 'queued', color: 'var(--faint)', glyph: '○' },
  building: { label: 'building', color: 'var(--blue)', glyph: '◐' },
  'needs-review': { label: 'needs review', color: 'var(--amber)', glyph: '◆' },
  attention: { label: 'stalled', color: 'var(--purple)', glyph: '!' },
  failed: { label: 'failed', color: 'var(--red)', glyph: '✕' },
  done: { label: 'done', color: 'var(--green)', glyph: '✓' },
}

/** Both "fail" and "failed" appear in real rows; normalize once. */
export function lifecycleOf(s: SessionSummary): Lifecycle {
  // The declared union omits "failed", but real rows carry it, so compare as a
  // plain string rather than trusting the type.
  const status = String(s.status ?? '')
  const openPhase = (s.phases ?? []).some((p) => String(p.status ?? '') === 'running')
  if (status === 'fail' || status === 'failed' || status === 'error') {
    // Real data contains rows marked failed whose last phase is still "running"
    // with no ended_at: an abandoned run, not a clean failure. Calling that
    // "failed" hides the fact that nothing ever reported back, so it gets its
    // own state instead.
    return openPhase ? 'attention' : 'failed'
  }
  if (status === 'running') {
    const started = (s.phases ?? []).some((p) => p.kind === 'agent' && p.started_at)
    return started ? 'building' : 'queued'
  }
  // TODO(api): a merged run should resolve to 'done'. Without pr_state/merged
  // in the payload every finished run lands on needs-review.
  if (status === 'success') return 'needs-review'
  return 'queued'
}

/** Runs the human is blocking on: finished and unreviewed, or broken. */
export function needsYou(s: SessionSummary): boolean {
  const l = lifecycleOf(s)
  return l === 'needs-review' || l === 'failed' || l === 'attention'
}

// ── Issue identity ───────────────────────────────────────────────────────────

/** The issue title: the request's first line, which is what the API stores. */
export function issueTitle(s: SessionSummary): string {
  const first = (s.request ?? '').split('\n')[0]?.trim()
  return first || '(no request recorded)'
}

/**
 * TODO(api): there is no issue_number field. Numbers that appear inside the
 * request body are references to OTHER issues (e.g. "found while fixing #1519"),
 * so scraping them would label runs with the wrong issue. Render a placeholder
 * rather than invent one.
 */
export function issueChip(_s: SessionSummary): string {
  return '#?'
}

/**
 * TODO(api): no pr_number / pr_state / merged_at. The row renders as a
 * placeholder so the design is honest about the gap.
 */
export function prLabel(s: SessionSummary): string | null {
  // Only a run that actually finished can have a PR to review.
  const life = lifecycleOf(s)
  return life === 'needs-review' || life === 'done' ? 'PR ?' : null
}

// ── Failure surfacing ────────────────────────────────────────────────────────

export interface FailureInfo {
  /** Agent or step that failed, e.g. "quality" or "git". */
  who: string
  /** Phase name, e.g. "test_1". */
  phase: string
  /** First line of the error text. */
  line: string
}

export function failureOf(s: SessionSummary): FailureInfo | null {
  const life = lifecycleOf(s)
  if (life !== 'failed' && life !== 'attention') return null
  const phases = s.phases ?? []
  if (life === 'attention') {
    const open = phases.find((p) => String(p.status ?? '') === 'running')
    return {
      who: open?.owner || 'unknown',
      phase: open?.name ?? 'n/a',
      line: 'run marked failed while this phase is still open; no result reported',
    }
  }
  const bad = phases.find((p) => {
    const st = String(p.status ?? '')
    return st === 'fail' || st === 'failed' || st === 'error'
  })
  if (bad) {
    const line = (bad.error ?? '').split('\n')[0]?.trim()
    return {
      who: bad.owner || bad.kind || 'unknown',
      phase: bad.name ?? 'n/a',
      line: line || 'no error text recorded',
    }
  }
  // A run marked failed whose phases carry no failure row: the last phase that
  // started is the honest best guess at where it died.
  const last = phases.filter((p) => p.started_at).at(-1)
  if (!last) return { who: 'unknown', phase: 'n/a', line: 'run failed before any phase ran' }
  return {
    who: last.owner || last.kind || 'unknown',
    phase: last.name ?? 'n/a',
    // TODO(api): a run killed mid-phase has status "failed" but no phase error
    // row, so there is no error text to show. Needs a session-level failure
    // reason from the API.
    line: 'run ended during this phase; no error text recorded',
  }
}

// ── Per-agent duration segments ──────────────────────────────────────────────

export interface Segment {
  owner: string
  color: string
  model: string
  ms: number
  pct: number
  label: string
  running: boolean
}

function phaseMs(p: Phase, nowMs: number): number {
  const t0 = ts(p.started_at)
  if (!Number.isFinite(t0)) return 0
  const t1 = ts(p.ended_at)
  return Math.max((Number.isFinite(t1) ? t1 : nowMs) - t0, 0)
}

export function shortDur(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** Agent phases collapsed to one segment per agent, widest-honest proportions. */
export function segmentsOf(s: SessionSummary, nowMs: number): Segment[] {
  const byOwner = new Map<string, { ms: number; running: boolean }>()
  const order: string[] = []
  for (const p of s.phases ?? []) {
    if (p.kind !== 'agent' || !p.owner) continue
    if (!byOwner.has(p.owner)) {
      byOwner.set(p.owner, { ms: 0, running: false })
      order.push(p.owner)
    }
    const acc = byOwner.get(p.owner)
    if (!acc) continue
    acc.ms += phaseMs(p, nowMs)
    if (p.status === 'running') acc.running = true
  }
  const total = [...byOwner.values()].reduce((a, b) => a + b.ms, 0)
  return order.map((owner, i) => {
    const acc = byOwner.get(owner) ?? { ms: 0, running: false }
    const info = (s.agents ?? []).find((a) => a.agent === owner)
    return {
      owner,
      color: agentColor(info?.color, null, i),
      model: modelName(info?.model),
      ms: acc.ms,
      pct: total > 0 ? (acc.ms / total) * 100 : 100 / Math.max(order.length, 1),
      label: `${owner} ${shortDur(acc.ms)}`,
      running: acc.running,
    }
  })
}

export function durationMs(s: SessionSummary, nowMs: number): number {
  const t0 = ts(s.started_at)
  if (!Number.isFinite(t0)) return NaN
  const t1 = ts(s.ended_at)
  return (Number.isFinite(t1) ? t1 : nowMs) - t0
}

/** "3m ago" style age, for the list's rightmost meta column. */
export function ageLabel(s: SessionSummary, nowMs: number): string {
  const t = ts(s.started_at)
  if (!Number.isFinite(t)) return 'n/a'
  return `${shortDur(nowMs - t)} ago`
}

// ── Cost outliers ────────────────────────────────────────────────────────────

/** Costs above 2x the median read as outliers worth tinting. */
export function costOutlierThreshold(sessions: SessionSummary[]): number {
  const costs = sessions.map((s) => s.total_cost ?? 0).filter((c) => c > 0).toSorted((a, b) => a - b)
  if (!costs.length) return Infinity
  const median = costs[Math.floor(costs.length / 2)] ?? 0
  return Math.max(median * 2, 0.01)
}

// ── Ordering ────────────────────────────────────────────────────────────────

/** Newest start time first; runs with no started_at sort to the end. */
export function newestFirst(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.toSorted((a, b) => {
    const ta = ts(a.started_at)
    const tb = ts(b.started_at)
    const va = Number.isFinite(ta) ? (ta as number) : -Infinity
    const vb = Number.isFinite(tb) ? (tb as number) : -Infinity
    return vb - va
  })
}

/**
 * Plain reverse-chronological order by start time, regardless of lifecycle.
 * Lifecycle pills/colors and needs-you row treatment still apply per-row; this
 * only controls list position. Runs without started_at sort last.
 */
export function rankedOrder(sessions: SessionSummary[]): SessionSummary[] {
  return newestFirst(sessions)
}

/**
 * Fields the API does not expose that this view needs. Surfaced behind the
 * footer "data gaps" link so the gap stays visible instead of being quietly
 * papered over with invented values.
 */
export const MISSING_API_FIELDS = [
  'issue_number: the GitHub issue this run implements (body-scraped numbers are references to other issues)',
  'issue_url: to link the chip through to GitHub',
  'pr_number / pr_url: the PR the run opened',
  'pr_state: open / draft / merged / closed, so needs-review and done stop being the same status',
  'merged_at: the only honest source for a "done" lifecycle state',
  'review_state: approved / changes-requested, for a real "needs you" queue',
  'failure_reason: a session-level error for runs that die without a failing phase row',
  'branch / worktree path: to jump from a card to the code',
  'attempt_of: an explicit parent run id, so retries group without matching on title text',
  'CONTRACT BUG: shared/types.ts declares SessionStatus as running|success|fail, but the API returns "failed" too (run d6337127). Both spellings are live; the type lies.',
  'CONTRACT BUG: run d6337127 has status "failed" with its build phase still "running" and ended_at null. Nothing distinguishes an abandoned run from a clean failure, so this view infers a "stalled" state instead.',
]
