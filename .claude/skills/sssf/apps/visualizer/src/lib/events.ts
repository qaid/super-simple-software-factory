import type { AgentStartPayload, EventRow, ToolCallPayload } from './types'

// ── Event dot colors ─────────────────────────────────────────────────────────
// One color per event type, shared by the session-card timelines and the phase
// detail list. gate_fail reads as an error signal on purpose.

// Literal hex, not CSS tokens: these strings are parsed by hexAlpha() and also
// written straight into inline styles, so a var() reference would break both.
// Values are mid-lightness so each dot stays legible on the light page surface
// and the dark one, and each hue stays distinct from its neighbours.
export const EVENT_DOT_COLORS: Record<string, string> = {
  agent_start: '#8b5cd6',
  tool_call: '#2e8f9c',
  handoff: '#4f6ef0',
  agent_end: '#2a9d63',
  error: '#c94a42',
  gate_fail: '#c94a42',
}

export function dotColor(type: string | null): string | null {
  if (!type) return null
  return EVENT_DOT_COLORS[type] ?? null
}

// ── Agent lane colors ────────────────────────────────────────────────────────
// Config color wins (agents[].color from the API, or the agent_start payload
// for in-flight agents); the palette below covers dbs written before the
// color column existed.

// Same constraint as EVENT_DOT_COLORS: literal hex for hexAlpha(). Five clearly
// separated hues (violet, teal, blue, amber, pink) at a lightness that reads on
// either theme.
export const AGENT_FALLBACK_COLORS = ['#8b5cd6', '#2e8f9c', '#4f6ef0', '#c2851a', '#c65a92']

/**
 * Relative-luminance band that clears ~3:1 against BOTH theme grounds (white
 * and #0f1117). The window is narrow because it has to satisfy two opposite
 * constraints at once, which is the price of one palette serving both themes.
 */
const LUM_MIN = 0.08
const LUM_MAX = 0.24

function srgbToLinear(v: number): number {
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [r + m, g + m, b + m]
}

/**
 * Normalizes an agent color's brightness so it reads on both themes, preserving
 * hue and saturation.
 *
 * Colors stored in existing databases predate the light theme and were picked
 * for a dark ground only: #e8b64a and #5ad2dd sit near 1.8:1 against the light
 * page, which is unreadable. Hue and saturation carry the agent's identity and
 * are left alone; only brightness moves, and only when the color falls outside
 * the band.
 *
 * The clamp targets relative LUMINANCE rather than HSL lightness, because
 * contrast depends on luminance and the two disagree badly on yellows, cyans
 * and greens: #e8b64a has a mid HSL lightness of 60% but the luminance of a
 * near-white. Since luminance is not invertible in closed form once hue is
 * fixed, the target is found by bisecting on HSL lightness, which is monotonic
 * in luminance for a fixed hue and saturation.
 *
 * Output is hex because hexAlpha() parses it; non-hex input passes through.
 */
function normalizeBrightness(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match || !match[1]) return hex
  const n = Number.parseInt(match[1], 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255

  const lum = luminance(r, g, b)
  if (lum >= LUM_MIN && lum <= LUM_MAX) return hex
  const target = Math.min(Math.max(lum, LUM_MIN), LUM_MAX)

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  h *= 60
  if (h < 0) h += 360

  // 20 iterations puts the result well inside one 8-bit step.
  let lo = 0
  let hi = 1
  let best: [number, number, number] = [r, g, b]
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    best = hslToRgb(h, s, mid)
    const cur = luminance(best[0], best[1], best[2])
    if (cur < target) lo = mid
    else hi = mid
  }

  const hexOf = (v: number) =>
    Math.round(Math.min(Math.max(v, 0), 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hexOf(best[0])}${hexOf(best[1])}${hexOf(best[2])}`
}

export function agentColor(
  configColor: string | null | undefined,
  payloadColor: string | null | undefined,
  index: number,
): string {
  return normalizeBrightness(
    configColor ??
      payloadColor ??
      AGENT_FALLBACK_COLORS[index % AGENT_FALLBACK_COLORS.length] ??
      '#8b5cd6',
  )
}

/** "#c89bff" + alpha → rgba() usable in inline styles. Invalid input → transparent. */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return 'transparent'
  const n = Number.parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`
}

// ── Payload parsing ──────────────────────────────────────────────────────────

export function parsePayload(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    /* legacy or truncated payloads render raw */
  }
  return null
}

export function parseToolCall(e: EventRow): ToolCallPayload | null {
  const payload = parsePayload(e.payload_json)
  if (!payload || typeof payload.tool !== 'string') return null
  return payload as ToolCallPayload
}

export function parseAgentStart(e: EventRow): AgentStartPayload | null {
  return parsePayload(e.payload_json) as AgentStartPayload | null
}

// Args keys most likely to BE the call, in priority order — a bash command, a
// file path, a search pattern. Used to build the one-line label.
const ARG_LABEL_KEYS = [
  'command',
  'cmd',
  'file_path',
  'path',
  'pattern',
  'query',
  'url',
  'prompt',
  'description',
]

const LABEL_MAX = 160

function oneLine(value: string): string {
  const flat = value.replaceAll(/\s+/g, ' ').trim()
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX)}…` : flat
}

/** One-line summary of a tool's args: the call itself, not a JSON dump. */
export function argsSummary(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  for (const key of ARG_LABEL_KEYS) {
    const v = args[key]
    if (typeof v === 'string' && v.trim() !== '') return oneLine(v)
  }
  const parts: string[] = []
  for (const [key, v] of Object.entries(args)) {
    if (v == null) continue
    parts.push(`${key}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }
  return oneLine(parts.join(' '))
}

/**
 * Exact-call row label for an event.
 * Rich tool_call → "bash: bun test src". Legacy payloads fall back to
 * the event name plus whatever hint the payload carries.
 */
export function eventLabel(e: EventRow): string {
  if (e.type === 'tool_call') {
    const call = parseToolCall(e)
    if (call?.tool) {
      // New-tracer rows already carry the human label in events.name
      // ("bash: ls -la src") — prefer it over re-deriving.
      if (e.name?.startsWith(call.tool)) return oneLine(e.name)
      const summary = argsSummary(call.args)
      return summary ? `${call.tool}: ${summary}` : call.tool
    }
    const legacy = parsePayload(e.payload_json)
    if (legacy && typeof legacy.pi_event === 'string') {
      return `${e.name ?? 'tool'} ${legacy.pi_event}`
    }
  }
  return e.name ?? e.type ?? ''
}
