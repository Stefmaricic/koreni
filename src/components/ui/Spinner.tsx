import clsx from 'clsx'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'h-6 w-6 animate-spin rounded-full border-2 border-root-300 border-t-root-600',
        className,
      )}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
