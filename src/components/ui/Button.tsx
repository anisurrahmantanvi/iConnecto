import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'danger' | 'default'
  size?: 'md' | 'sm'
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'default', size = 'md', block, loading, icon, className = '', children, type = 'button', disabled, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} aria-busy={loading || undefined} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 size={18} className="spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  small?: boolean
  active?: boolean
  like?: boolean
}

export function IconButton({ label, small, active, like, className = '', children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      data-active={active ? 'true' : undefined}
      className={`icon-btn ${small ? 'icon-btn--sm' : ''} ${like ? 'is-like' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
