import type { InputHTMLAttributes, ReactNode } from 'react'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: ReactNode
}

/** Accessible toggle: a real checkbox with role="switch", so keyboard and screen readers work natively. */
export function Switch({ label, description, ...rest }: SwitchProps) {
  return (
    <label className="switch-row">
      <span className="grow">
        <span className="switch-row__label">{label}</span>
        {description ? <span className="small muted" style={{ display: 'block' }}>{description}</span> : null}
      </span>
      <span className="switch">
        <input type="checkbox" role="switch" {...rest} />
        <span className="switch__track" aria-hidden />
      </span>
    </label>
  )
}
