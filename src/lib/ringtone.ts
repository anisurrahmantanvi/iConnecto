/**
 * Call sounds made with the Web Audio API (no audio files, nothing to license):
 *  - 'incoming': a short rising melody that repeats, plus vibration, while a call is ringing for you.
 *  - 'outgoing': a soft two-tone ring-back the caller hears while waiting for the other person to answer.
 * Works while the app is open. A closed app can only show a notification (see the push notes).
 */
type Kind = 'incoming' | 'outgoing'

interface Note { at: number; dur: number; freqs: number[]; gain: number }

const PATTERNS: Record<Kind, { period: number; notes: Note[] }> = {
  incoming: {
    period: 2.6,
    notes: [0, 0.22, 0.44, 0.66, 1.1, 1.32, 1.54, 1.76].map((at, i) => ({
      at,
      dur: 0.2,
      freqs: [[659.25, 1318.5], [783.99, 1568], [1046.5, 2093], [783.99, 1568]][i % 4],
      gain: 0.22,
    })),
  },
  outgoing: {
    period: 4,
    notes: [{ at: 0, dur: 1.2, freqs: [440, 480], gain: 0.12 }],
  },
}

let ctx: AudioContext | null = null
let timer: number | null = null
let active: { stop: () => void }[] = []
let currentKind: Kind | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx
  } catch {
    return null
  }
}

function playCycle(kind: Kind): void {
  const c = audio()
  if (!c) return
  const start = c.currentTime + 0.02
  for (const n of PATTERNS[kind].notes) {
    const g = c.createGain()
    g.gain.setValueAtTime(0, start + n.at)
    g.gain.linearRampToValueAtTime(n.gain, start + n.at + 0.02)
    g.gain.setValueAtTime(n.gain, start + n.at + n.dur - 0.04)
    g.gain.linearRampToValueAtTime(0, start + n.at + n.dur)
    g.connect(c.destination)
    for (const f of n.freqs) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      o.start(start + n.at)
      o.stop(start + n.at + n.dur + 0.02)
      active.push({ stop: () => { try { o.stop() } catch { /* already stopped */ } } })
    }
  }
  if (kind === 'incoming') {
    try { navigator.vibrate?.([450, 250, 450, 1450]) } catch { /* not supported */ }
  }
}

export function stopRing(): void {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  currentKind = null
  for (const a of active) a.stop()
  active = []
  try { navigator.vibrate?.(0) } catch { /* not supported */ }
}

export function startRing(kind: Kind): void {
  if (currentKind === kind) return
  stopRing()
  currentKind = kind
  playCycle(kind)
  timer = window.setInterval(() => {
    active = []
    playCycle(kind)
  }, PATTERNS[kind].period * 1000)
}
