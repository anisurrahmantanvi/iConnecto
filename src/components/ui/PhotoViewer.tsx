import { useCallback, useEffect, useRef, useState, type TouchList } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'

interface PhotoViewerProps {
  urls: string[]
  /** Index of the photo to show, or null when closed. */
  index: number | null
  onIndexChange: (i: number) => void
  onClose: () => void
}

const MIN = 1
const MAX = 5

/**
 * Full-screen photo viewer. Pinch with two fingers, double-tap, or use the + / − buttons to zoom; drag to move around a zoomed photo.
 * With several photos, the arrows switch between them.
 */
export function PhotoViewer({ urls, index, onIndexChange, onClose }: PhotoViewerProps) {
  const [zoom, setZoom] = useState(1)
  const stage = useRef<HTMLDivElement>(null)
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const lastTap = useRef(0)
  const open = index !== null

  const setClamped = useCallback((z: number) => setZoom(Math.min(MAX, Math.max(MIN, z))), [])

  // Start every photo un-zoomed and scrolled to the top-left.
  useEffect(() => {
    setZoom(1)
    stage.current?.scrollTo(0, 0)
  }, [index])

  // After zooming, keep the view centred on the middle of the photo instead of jumping to a corner.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    el.scrollTo((el.scrollWidth - el.clientWidth) / 2, (el.scrollHeight - el.clientHeight) / 2)
  }, [zoom])

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

  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

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
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { dist: dist(e.touches), zoom }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) setClamped(pinch.current.zoom * (dist(e.touches) / pinch.current.dist))
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) pinch.current = null
        }}
        onClick={() => {
          const now = Date.now()
          if (now - lastTap.current < 300) setZoom((z) => (z > 1 ? 1 : 2.5))
          lastTap.current = now
        }}
      >
        <img
          className="viewer__img"
          src={urls[index]}
          alt={`Photo ${index + 1} of ${urls.length}`}
          draggable={false}
          style={{ width: `${zoom * 100}vw`, height: `${zoom * 100}dvh` }}
        />
      </div>

      {urls.length > 1 && index > 0 ? (
        <button type="button" className="viewer__btn viewer__nav viewer__nav--prev" aria-label="Previous photo" onClick={() => onIndexChange(index - 1)}><ChevronLeft size={26} /></button>
      ) : null}
      {urls.length > 1 && index < urls.length - 1 ? (
        <button type="button" className="viewer__btn viewer__nav viewer__nav--next" aria-label="Next photo" onClick={() => onIndexChange(index + 1)}><ChevronRight size={26} /></button>
      ) : null}

      <div className="viewer__zoom">
        <button type="button" className="viewer__btn" aria-label="Zoom out" disabled={zoom <= MIN} onClick={() => setClamped(zoom - 0.75)}><Minus size={22} /></button>
        <button type="button" className="viewer__btn" aria-label="Zoom in" disabled={zoom >= MAX} onClick={() => setClamped(zoom + 0.75)}><Plus size={22} /></button>
      </div>
    </div>,
    document.body,
  )
}
