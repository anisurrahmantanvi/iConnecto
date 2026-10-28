import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { IconButton } from './Button'

interface PageHeaderProps {
  title: ReactNode
  /** true = go back in history; a string = go to that path. */
  back?: boolean | string
  actions?: ReactNode
}

export function PageHeader({ title, back, actions }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      {back ? (
        <IconButton label="Back" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
          <ArrowLeft size={22} />
        </IconButton>
      ) : null}
      <h1 className="truncate">{title}</h1>
      {actions}
    </header>
  )
}
