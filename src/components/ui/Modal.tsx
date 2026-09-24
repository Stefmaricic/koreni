import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' }

/**
 * Renders as a bottom sheet on narrow viewports and a centered dialog from
 * `sm:` up, so mobile users get thumb-reachable controls without a second
 * component to maintain.
 */
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink-700/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'safe-bottom relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-card bg-cream-50 p-5 shadow-2xl sm:m-4 sm:max-h-[85vh] sm:rounded-card',
          sizeClasses[size],
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-cream-300 sm:hidden" />
        {title && <h2 className="mb-4 text-xl font-semibold text-ink-700">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
