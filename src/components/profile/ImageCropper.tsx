import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface Props {
  file: File
  /** width / height of the final picture: 1 for a profile photo, 16/9 for a cover. */
  aspect: number
  round?: boolean
  title: string
  outWidth: number
  onCancel: () => void
  onDone: (cropped: File) => void
}

/** Move and zoom a photo inside a frame, then save exactly what the frame shows. Drag to move, pinch or use the slider to zoom. */
export function ImageCropper({ file, aspect, round, title, outWidth, onCancel, onDone }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [size, setSize] = useState({ w: 300, h: 300 / aspect })
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    const img = new Image()
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const w = el.clientWidth
    setSize({ w, h: w / aspect })
  }, [aspect, nat])

  const base = nat ? Math.max(size.w / nat.w, size.h / nat.h) : 1
  const scale = base * zoom
  const clamp = (x: number, y: number, s = scale) => {
    if (!nat) return { x: 0, y: 0 }
    return { x: Math.min(0, Math.max(size.w - nat.w * s, x)), y: Math.min(0, Math.max(size.h - nat.h * s, y)) }
  }

  // Centre the photo whenever it (or the frame) changes.
  useEffect(() => {
    if (!nat) return
    const s = base * zoom
    setOff(clamp((size.w - nat.w * s) / 2, (size.h - nat.h * s) / 2, s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, size.w, size.h])

  const setZoomKeepCenter = (z: number) => {
    if (!nat) return
    const nz = Math.min(4, Math.max(1, z))
    const s0 = base * zoom
    const s1 = base * nz
    const cx = (size.w / 2 - off.x) / s0
    const cy = (size.h / 2 - off.y) / s0
    setZoom(nz)
    setOff(clamp(size.w / 2 - cx * s1, size.h / 2 - cy * s1, s1))
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      setZoomKeepCenter((pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d)
    } else if (pointers.current.size === 1) {
      setOff((o) => clamp(o.x + e.clientX - prev.x, o.y + e.clientY - prev.y))
    }
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  const save = async () => {
    if (!nat || !src) return
    setBusy(true)
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read the photo.')); i.src = src })
      const w = Math.max(200, Math.min(outWidth, Math.round(size.w / scale)))
      const h = Math.round(w / aspect)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not edit the photo.')
      ctx.drawImage(img, -off.x / scale, -off.y / scale, size.w / scale, size.h / scale, 0, 0, w, h)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
      if (!blob) throw new Error('Could not save the photo.')
      onDone(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
    } catch {
      setBusy(false)
    }
  }

  return (
    <Dialog open title={title} onClose={onCancel}>
      <div className="col" style={{ gap: 12 }}>
        <div
          ref={stageRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ position: 'relative', width: '100%', height: size.h, overflow: 'hidden', background: '#000', borderRadius: round ? '50%' : 14, touchAction: 'none', cursor: 'grab', maxWidth: round ? 300 : undefined, margin: round ? '0 auto' : undefined }}
        >
          {src && nat ? (
            <img src={src} alt="" draggable={false} style={{ position: 'absolute', left: 0, top: 0, width: nat.w * scale, height: nat.h * scale, transform: `translate(${off.x}px, ${off.y}px)`, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }} />
          ) : null}
        </div>
        <p className="small muted" style={{ textAlign: 'center' }}>Drag to move. Pinch or use the slider to zoom.</p>
        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => setZoomKeepCenter(zoom - 0.25)}><Minus size={18} /></button>
          <input className="grow" type="range" min={1} max={4} step={0.01} value={zoom} aria-label="Zoom" onChange={(e) => setZoomKeepCenter(Number(e.target.value))} />
          <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => setZoomKeepCenter(zoom + 0.25)}><Plus size={18} /></button>
        </div>
        <div className="dialog-actions">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!nat} onClick={() => void save()}>Save</Button>
        </div>
      </div>
    </Dialog>
  )
}
