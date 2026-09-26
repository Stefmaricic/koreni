import clsx from 'clsx'
import type { MemberGender } from '@/types/models'

interface AvatarProps {
  photoUrl?: string | null
  firstName?: string
  lastName?: string | null
  gender?: MemberGender
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
  xl: 'h-28 w-28 text-3xl',
}

const genderTint: Record<MemberGender, string> = {
  female: 'bg-earth-100 text-earth-600 dark:bg-earth-600/30 dark:text-earth-200',
  male: 'bg-root-100 text-root-700 dark:bg-root-900/50 dark:text-root-300',
  other: 'bg-cream-200 text-ink-600',
  unknown: 'bg-cream-200 text-ink-600',
}

function initials(firstName?: string, lastName?: string | null) {
  const a = firstName?.[0] ?? ''
  const b = lastName?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export function Avatar({ photoUrl, firstName, lastName, gender = 'unknown', size = 'md' }: AvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={clsx('rounded-full object-cover ring-2 ring-white', sizeClasses[size])}
      />
    )
  }
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full font-semibold ring-2 ring-white',
        genderTint[gender],
        sizeClasses[size],
      )}
    >
      {initials(firstName, lastName)}
    </div>
  )
}
