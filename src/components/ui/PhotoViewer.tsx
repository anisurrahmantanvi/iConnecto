import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface PhotoViewerProps {
  urls: string[]
  /** Index of the photo to show, or null when closed. */
  index: number | null
  onIndexChange: (i: number) => void
  onClose: () => void
}

const MIN = 1
const MAX = 6

/**
 * Full-screen photo viewer. Pinch with two fingers to zoom in and out, drag to move a zoomed photo, double-tap to zoom,
 * and swipe sideways (when not zoomed) to change photo.
 */
export function PhotoViewer({ urls, index, onIndexChange, onClose }: PhotoViewerProps) {
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; s: number; x: number; y: number } | null>(null)
  const drag = useRef<{ x: number; y: number; moved: number; sx: number } | null>(null)
  const lastTap = useRef({ t: 0, x: 0, y: 0 })
  const open = index !== null

  const limit = (s: number, x: number, y: number) => {
    const el = stage.current
    const w = el?.clientWidth ?? 0
    const h = el?.clientHeight ?? 0
    const mx = ((s - 1) * w) / 2
    const my = ((s - 1) * h) / 2
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
  }

  // Every photo starts un-zoomed.
  useEffect(() => { setView({ s: 1, x: 0, y: 0 }) }, [index])

  const centre = () => {
    const r = stage.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 }
  }

  // Zoom to s1 while the point under the finger stays where it is.
  const zoomAt = (s1: number, fx: number, fy: number, from = view) => {
    const c = centre()
    const f = { x: fx - c.x, y: fy - c.y }
    const s = Math.min(MAX, Math.max(MIN, s1))
    const k = s / from.s
    return limit(s, f.x - k * (f.x - from.x), f.y - k * (f.y - from.y))
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s, x: view.x, y: view.y }
      drag.current = null
    } else {
      drag.current = { x: e.clientX, y: e.clientY, moved: 0, sx: e.clientX }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return
    const prev = ptrs.current.get(e.pointerId)!
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      setView(zoomAt(pinch.current.s * (d / pinch.current.d), (a.x + b.x) / 2, (a.y + b.y) / 2, { s: pinch.current.s, x: pinch.current.x, y: pinch.current.y }))
    } else if (drag.current) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      drag.current.moved += Math.abs(dx) + Math.abs(dy)
      if (view.s > 1) setView((v) => limit(v.s, v.x + dx, v.y + dy))
    }
  }
  const onUp = (e: React.PointerEvent) => {
    const wasSingle = ptrs.current.size === 1
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size < 2) pinch.current = null
    const d = drag.current
    if (!wasSingle || !d) return
    drag.current = null
    const swipe = e.clientX - d.sx
    if (view.s <= 1.02 && Math.abs(swipe) > 70 && d.moved > 70 && index !== null) {
      if (swipe < 0 && index < urls.length - 1) onIndexChange(index + 1)
      else if (swipe > 0 && index > 0) onIndexChange(index - 1)
      return
    }
    if (d.moved < 12) {
      const now = Date.now()
      const t = lastTap.current
      if (now - t.t < 300 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 40) {
        setView(view.s > 1.05 ? { s: 1, x: 0, y: 0 } : zoomAt(2.5, e.clientX, e.clientY))
        lastTap.current = { t: 0, x: 0, y: 0 }
      } else lastTap.current = { t: now, x: e.clientX, y: e.clientY }
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index! < urls.length - 1) onIndexChange(index! + 1)
      if (e.key === 'ArrowLeft' && index! > 0) onIndexChange(index! - 1)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, index, urls.length, onClose, onIndexChange])

  if (index === null || !urls[index]) return null

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="viewer__bar">
        <button type="button" className="viewer__btn" aria-label="Close photo" onClick={onClose}><X size={24} /></button>
        {urls.length > 1 ? <span className="viewer__count">{index + 1} / {urls.length}</span> : <span />}
        <span style={{ width: 44 }} />
      </div>

      <div
        ref={stage}
        className="viewer__stage"
        style={{ overflow: 'hidden', touchAction: 'none', display: 'grid', placeItems: 'center' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img
          className="viewer__img"
          src={urls[index]}
          alt={`Photo ${index + 1} of ${urls.length}`}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', maxWidth: 'none', transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: pinch.current || drag.current ? 'none' : 'transform .18s ease', userSelect: 'none', pointerEvents: 'none' }}
        />
      </div>

      {urls.length > 1 && index > 0 ? (
        <button type="button" className="viewer__btn viewer__nav viewer__nav--prev" aria-label="Previous photo" onClick={() => onIndexChange(index - 1)}><ChevronLeft size={26} /></button>
      ) : null}
      {urls.length > 1 && index < urls.length - 1 ? (
        <button type="button" className="viewer__btn viewer__nav viewer__nav--next" aria-label="Next photo" onClick={() => onIndexChange(index + 1)}><ChevronRight size={26} /></button>
      ) : null}

    </div>,
    document.body,
  )
}
