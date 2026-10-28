import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'info' | 'error'
interface ToastItem { id: number; kind: ToastKind; text: string }
interface ToastApi { show: (text: string, kind?: ToastKind) => void; error: (text: string) => void }

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setItems((prev) => [...prev.slice(-2), { id, kind, text }])
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3800)
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, error: (t) => show(t, 'error') }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`glass glass--strong toast ${t.kind === 'error' ? 'toast--error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
