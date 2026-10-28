import type { ElementType, HTMLAttributes } from 'react'

interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  strong?: boolean
  sheen?: boolean
  padded?: boolean
}

export function GlassPanel({ as: Tag = 'div', strong, sheen, padded, className = '', ...rest }: GlassPanelProps) {
  const cls = ['glass', strong ? 'glass--strong' : '', sheen ? 'glass--sheen' : '', padded ? 'card' : '', className]
    .filter(Boolean)
    .join(' ')
  return <Tag className={cls} {...rest} />
}
