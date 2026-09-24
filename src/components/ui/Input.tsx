import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from 'react'
import clsx from 'clsx'

const fieldClasses =
  'w-full rounded-xl border border-cream-300 bg-cream-50 px-3.5 py-2.5 text-sm text-ink-700 ' +
  'placeholder:text-ink-500/50 focus:border-root-400 focus:outline-none focus:ring-2 focus:ring-root-200 ' +
  'disabled:opacity-60'

interface FieldWrapProps {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, required, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-ink-600">
          {label}
          {required && <span className="text-earth-500"> *</span>}
        </label>
      )}
      <input ref={ref} id={fieldId} className={clsx(fieldClasses, className)} {...props} />
      {hint && !error && <span className="text-xs text-ink-500/70">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapProps {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, required, className, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-ink-600">
          {label}
          {required && <span className="text-earth-500"> *</span>}
        </label>
      )}
      <textarea ref={ref} id={fieldId} rows={rows} className={clsx(fieldClasses, 'resize-none', className)} {...props} />
      {hint && !error && <span className="text-xs text-ink-500/70">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends FieldWrapProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  id?: string
  disabled?: boolean
}

export function Select({ label, error, hint, required, value, onChange, options, id, disabled }: SelectProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-ink-600">
          {label}
          {required && <span className="text-earth-500"> *</span>}
        </label>
      )}
      <select
        id={fieldId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(fieldClasses, 'appearance-none bg-cream-50')}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <span className="text-xs text-ink-500/70">{hint}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
