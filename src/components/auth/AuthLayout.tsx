import type { ReactNode } from 'react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Logo } from '@/components/ui/Logo'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/** Shared frame for sign-in, sign-up, password reset and callback screens. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth">
      <GlassPanel strong sheen className="auth__card" as="main">
        <div className="col" style={{ alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <Logo size={64} />
          <h1>{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="small center muted" style={{ textAlign: 'center' }}>{footer}</div> : null}
      </GlassPanel>
    </div>
  )
}
