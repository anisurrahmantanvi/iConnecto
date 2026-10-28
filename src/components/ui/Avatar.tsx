import { useState } from 'react'
import { initials } from '@/lib/format'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const cls = size === 'md' ? 'avatar' : `avatar avatar--${size}`
  return (
    <span className={cls} aria-hidden={!name}>
      {src && !failed ? (
        <img src={src} alt={name ? `${name}'s avatar` : ''} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}
