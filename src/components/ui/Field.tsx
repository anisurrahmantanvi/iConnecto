import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

interface FieldShellProps {
  label: string
  error?: string | null
  hint?: ReactNode
  ok?: string | null
}

type TextFieldProps = FieldShellProps & InputHTMLAttributes<HTMLInputElement>

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, ok, id, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  const describedBy = error ? `${fid}-err` : hint || ok ? `${fid}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <input ref={ref} id={fid} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {error ? (
        <span id={`${fid}-err`} className="field-error" role="alert">{error}</span>
      ) : ok ? (
        <span id={`${fid}-hint`} className="field-ok">{ok}</span>
      ) : hint ? (
        <span id={`${fid}-hint`} className="field-hint">{hint}</span>
      ) : null}
    </div>
  )
})

type TextAreaFieldProps = FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, id, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      <textarea ref={ref} id={fid} className="textarea" aria-invalid={error ? true : undefined} {...rest} />
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
})
