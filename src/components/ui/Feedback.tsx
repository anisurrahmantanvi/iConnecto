import type { CSSProperties, ReactNode } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from './Button'

export function Skeleton({ width, height = 14, radius, style }: { width?: number | string; height?: number | string; radius?: number | string; style?: CSSProperties }) {
  return <div className="skeleton" aria-hidden style={{ width: width ?? '100%', height, borderRadius: radius, ...style }} />
}

export function PostSkeleton() {
  return (
    <div className="glass post" aria-hidden>
      <div className="post__head">
        <Skeleton width={44} height={44} radius="50%" />
        <div className="grow col" style={{ gap: 6 }}>
          <Skeleton width="40%" />
          <Skeleton width="25%" height={11} />
        </div>
      </div>
      <Skeleton height={14} />
      <Skeleton width="80%" height={14} />
      <Skeleton height={180} radius={16} />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="list-row" key={i}>
          <Skeleton width={44} height={44} radius="50%" />
          <div className="grow col" style={{ gap: 6 }}>
            <Skeleton width="45%" />
            <Skeleton width="30%" height={11} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon ? <div className="empty__icon">{icon}</div> : null}
      <h3>{title}</h3>
      {body ? <p className="small">{body}</p> : null}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty" role="alert">
      <div className="empty__icon" style={{ color: 'var(--danger)' }}><AlertCircle size={28} /></div>
      <h3>Couldn't load this</h3>
      <p className="small">{message}</p>
      {onRetry ? <Button variant="glass" size="sm" onClick={onRetry}>Try again</Button> : null}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="center" style={{ padding: 24 }} role="status" aria-live="polite">
      <Loader2 className="spin" size={24} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div className="banner banner--error" role="alert"><AlertCircle size={18} aria-hidden />{children}</div>
}
