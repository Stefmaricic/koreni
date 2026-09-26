import clsx from 'clsx'
import { useToastStore } from '@/stores/toastStore'

const variantClasses = {
  success: 'bg-root-600 text-white',
  error: 'bg-red-600 text-white',
  // root-900 (not ink-700) on purpose: ink-* flips light/dark with the
  // theme, but this chip must always read as a dark surface with light text.
  info: 'bg-root-900 text-white',
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={clsx(
            'w-full max-w-sm rounded-xl px-4 py-3 text-left text-sm shadow-lg',
            variantClasses[toast.variant],
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
